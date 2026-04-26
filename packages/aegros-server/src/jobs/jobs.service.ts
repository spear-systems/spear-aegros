import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { JobTableRow } from '../prisma/db-row.types';
import {
  executePipeline,
  normalizeDomainsToScope,
  parseScanPolicy,
  type JobStatus,
  type ReportArtifactV2,
  type StageStateMap,
} from '@spearsystems/aegros-core';
import type { AiService } from '@spearsystems/aegros-core';
import { createFsArtifactWriter, resolveArtifactsDir } from '../artifacts/fs-artifact-writer';
import { AuditService } from '../audit/audit.service';
import { DockerScannerService } from '../docker/docker-scanner.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

export interface JobRecord {
  readonly id: string;
  status: JobStatus;
  readonly domains: readonly string[];
  readonly policy: string;
  report: ReportArtifactV2 | null;
  readonly createdAt: string;
  updatedAt: string;
  readonly currentStage: string | null;
  readonly stages: StageStateMap | null;
  readonly errorMessage: string | null;
}

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docker: DockerScannerService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    @Inject('AI_SERVICE') private readonly ai: AiService,
  ) {}

  async onModuleInit(): Promise<void> {
    const n = await this.prisma.job.updateMany({
      where: { status: 'running' },
      data: { status: 'queued', errorMessage: 'Recovered after restart — re-run pending' },
    });
    if (n.count > 0) {
      this.log.warn(`Reset ${n.count} running job(s) to queued for recovery`);
    }
    const recovered = await this.prisma.job.findMany({
      where: { status: 'queued', errorMessage: { contains: 'Recovered after restart' } },
      select: { id: true },
    });
    for (const j of recovered) {
      void this.runJob(j.id);
    }
  }

  async create(
    domains: string[],
    policyRaw?: string,
    ackAuthorized?: boolean,
    apiKeyId?: string | null,
  ): Promise<JobRecord> {
    if (process.env.AEGROS_ENFORCE_ACK?.trim() === 'true' && !ackAuthorized) {
      throw new BadRequestException('ackAuthorized must be true when AEGROS_ENFORCE_ACK=true');
    }
    const scope = normalizeDomainsToScope(domains);
    if (scope.length === 0) {
      throw new BadRequestException('No valid domains after normalization');
    }
    const policy = parseScanPolicy(policyRaw);
    const row = await this.prisma.job.create({
      data: {
        status: 'queued',
        domainsJson: JSON.stringify(scope),
        policy,
      },
    });
    await this.audit.log({
      action: 'job.create',
      resource: row.id,
      meta: { domains: scope, policy },
      jobId: row.id,
      apiKeyId: apiKeyId ?? null,
    });
    void this.runJob(row.id);
    return this.toRecord(row as JobTableRow);
  }

  async get(id: string): Promise<JobRecord> {
    const row = await this.prisma.job.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return this.toRecord(row as JobTableRow);
  }

  async list(): Promise<JobRecord[]> {
    const rows = await this.prisma.job.findMany({ orderBy: { createdAt: 'desc' } });
    return (rows as JobTableRow[]).map((r) => this.toRecord(r));
  }

  private toRecord(row: JobTableRow): JobRecord {
    const domains = JSON.parse(row.domainsJson) as string[];
    let report: ReportArtifactV2 | null = null;
    if (row.reportJson) {
      try {
        report = JSON.parse(row.reportJson) as ReportArtifactV2;
      } catch {
        report = null;
      }
    }
    let stages: StageStateMap | null = null;
    if (row.stagesJson) {
      try {
        stages = JSON.parse(row.stagesJson) as StageStateMap;
      } catch {
        stages = null;
      }
    }
    return {
      id: row.id,
      status: row.status as JobStatus,
      domains,
      policy: row.policy,
      report,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      currentStage: row.currentStage,
      stages,
      errorMessage: row.errorMessage,
    };
  }

  private async persistStages(id: string, stages: StageStateMap, current?: string): Promise<void> {
    await this.prisma.job.update({
      where: { id },
      data: {
        stagesJson: JSON.stringify(stages),
        currentStage: current ?? null,
        updatedAt: new Date(),
      },
    });
  }

  private async runJob(id: string): Promise<void> {
    const stages: StageStateMap = {};
    try {
      await this.prisma.job.update({
        where: { id },
        data: { status: 'running', errorMessage: null },
      });
      const row = await this.prisma.job.findUniqueOrThrow({ where: { id } });
      const domains = JSON.parse(row.domainsJson) as string[];
      const policy = parseScanPolicy(row.policy);
      const writer = createFsArtifactWriter(resolveArtifactsDir(), id);
      const useAi = Boolean(process.env.AEGROS_AI_PROVIDER?.trim());
      const report = await executePipeline({
        jobId: id,
        domains,
        policy,
        writer,
        fetchImpl: fetch,
        budgets: {
          maxHttpRequests: Number(process.env.AEGROS_MAX_HTTP ?? 40),
          maxSubdomains: Number(process.env.AEGROS_MAX_SUBDOMAINS ?? 80),
          wallMs: Number(process.env.AEGROS_WALL_MS ?? 120_000),
        },
        linuxScanner:
          policy === 'aggressive' && this.docker.isConfigured()
            ? (req) => this.docker.run(req)
            : undefined,
        ai: useAi ? this.ai : undefined,
        onStage: (stage, status, detail) => {
          const now = new Date().toISOString();
          if (status === 'started') {
            stages[stage] = { status: 'running', startedAt: now };
          } else if (status === 'finished') {
            stages[stage] = {
              status: 'succeeded',
              startedAt: stages[stage]?.startedAt,
              finishedAt: now,
            };
          } else {
            stages[stage] = {
              status: 'failed',
              startedAt: stages[stage]?.startedAt,
              finishedAt: now,
              detail,
            };
          }
          void this.persistStages(id, stages, stage);
        },
      });
      await this.prisma.job.update({
        where: { id },
        data: {
          status: 'succeeded',
          reportJson: JSON.stringify(report),
          stagesJson: JSON.stringify(stages),
          currentStage: 'report_synthesis',
          errorMessage: null,
        },
      });
      await this.audit.log({ action: 'job.succeeded', resource: id, jobId: id });
      await this.webhooks.notifyJobCompleted(id, report);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Job ${id} failed: ${msg}`);
      await this.prisma.job.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage: msg,
          stagesJson: JSON.stringify(stages),
        },
      });
      await this.audit.log({ action: 'job.failed', resource: id, meta: { error: msg }, jobId: id });
    }
  }
}
