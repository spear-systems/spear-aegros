import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ReportArtifactV2 } from '@spearsystems/aegros-core';
import type { WebhookSubscriptionRow } from '../prisma/db-row.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyJobCompleted(jobId: string, report: ReportArtifactV2): Promise<void> {
    const hooks = (await this.prisma.webhookSubscription.findMany({
      where: { revokedAt: null },
    })) as WebhookSubscriptionRow[];
    if (hooks.length === 0) return;
    const bodyObj = {
      event: 'job.completed',
      jobId,
      status: report.status,
      domains: report.domains,
      summary: report.summary,
      generatedAt: report.generatedAt,
    };
    const body = JSON.stringify(bodyObj);
    await Promise.all(
      hooks.map(async (h: WebhookSubscriptionRow) => {
        const events = JSON.parse(h.eventsJson) as string[];
        if (!events.includes('job.completed')) return;
        const sig = createHmac('sha256', h.secret).update(body).digest('hex');
        try {
          const res = await fetch(h.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Aegros-Signature': `sha256=${sig}`,
              'X-Aegros-Event': 'job.completed',
            },
            body,
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) {
            this.log.warn(`Webhook ${h.id} HTTP ${res.status}`);
          }
        } catch (e) {
          this.log.warn(`Webhook ${h.id} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }),
    );
  }
}
