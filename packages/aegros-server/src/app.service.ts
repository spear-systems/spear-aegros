import { Injectable } from '@nestjs/common';
import { AEGROS_CORE_VERSION } from '@spearsystems/aegros-core';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let database: 'ok' | 'error' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }
    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      coreVersion: AEGROS_CORE_VERSION,
      aiProvider: process.env.AEGROS_AI_PROVIDER?.trim() ?? 'noop',
    };
  }
}
