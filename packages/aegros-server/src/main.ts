import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

function parseCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') {
    return true;
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const corsRaw = process.env.CORS_ORIGIN?.trim();
  if (process.env.NODE_ENV === 'production' && (!corsRaw || corsRaw === '*')) {
    logger.warn(
      'CORS_ORIGIN is unset or * in production — set explicit origins (comma-separated) before exposing this host to the internet.',
    );
  }
  app.enableCors({
    origin: parseCorsOrigin(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  const portalDist =
    process.env.AEGROS_PORTAL_DIST?.trim() ||
    (existsSync(join(__dirname, '..', 'portal'))
      ? join(__dirname, '..', 'portal')
      : join(__dirname, '..', '..', 'aegros-portal', 'dist'));
  app.useStaticAssets(portalDist, { prefix: '/portal/' });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(/^\/portal(\/.*)?$/, (req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    if (req.path.startsWith('/portal/assets/')) {
      next();
      return;
    }
    if (/\.\w+$/.test(req.path)) {
      next();
      return;
    }
    res.sendFile(join(portalDist, 'index.html'));
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}

void bootstrap();
