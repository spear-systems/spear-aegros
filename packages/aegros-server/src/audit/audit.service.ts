import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    action: string;
    resource: string;
    meta?: unknown;
    jobId?: string;
    apiKeyId?: string | null;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        metaJson: input.meta !== undefined ? JSON.stringify(input.meta) : null,
        jobId: input.jobId,
        apiKeyId: input.apiKeyId ?? undefined,
      },
    });
  }
}
