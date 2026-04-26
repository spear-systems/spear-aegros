import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { DockerModule } from '../docker/docker.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { JobsModule } from './jobs.module';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobsService', () => {
  let prisma: PrismaService;
  let jobs: JobsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        DockerModule,
        AuditModule,
        WebhooksModule,
        AiModule,
        JobsModule,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
    prisma = app.get(PrismaService);
    jobs = app.get(JobsService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await close();
  });

  it('creates a job and completes pipeline', async () => {
    const job = await jobs.create(['Example.COM'], 'passive', true, null);
    expect(job.domains).toEqual(['example.com']);
    expect(['queued', 'running', 'succeeded']).toContain(job.status);
    for (let i = 0; i < 80; i += 1) {
      const j = await jobs.get(job.id);
      if (j.status === 'succeeded' || j.status === 'failed') {
        expect(j.status).toBe('succeeded');
        expect(j.report?.schema).toBe('spear.aegros/report@v2');
        expect(j.report?.findings.length).toBeGreaterThanOrEqual(0);
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('job did not complete in time');
  });
});
