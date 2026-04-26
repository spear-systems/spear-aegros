import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    if (process.env.API_KEYS_REQUIRED?.trim() !== 'true') {
      return true;
    }
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const raw =
      req.headers['x-api-key'] ??
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);
    if (!raw) {
      throw new UnauthorizedException('Missing API key (X-API-Key or Authorization: Bearer)');
    }
    const keyHash = createHash('sha256').update(raw, 'utf8').digest('hex');
    const row = await this.prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
    });
    if (!row) {
      throw new UnauthorizedException('Invalid API key');
    }
    (req as { aegrosApiKey?: { id: string; role: string } }).aegrosApiKey = {
      id: row.id,
      role: row.role,
    };
    return true;
  }
}
