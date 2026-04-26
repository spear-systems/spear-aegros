import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  it('returns health', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: () => Promise.resolve([1]),
          },
        },
      ],
    }).compile();

    const app = moduleRef.get(AppController);
    const h = await app.getHealth();
    expect(h.status).toBe('ok');
    expect(h.database).toBe('ok');
  });
});
