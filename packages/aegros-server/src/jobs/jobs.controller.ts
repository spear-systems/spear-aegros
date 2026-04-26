import {
  Body,
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { from, map, switchMap, takeWhile, timer } from 'rxjs';
import type { Observable } from 'rxjs';
import { reportToSarif } from '../integrations/sarif';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

type ReqWithKey = Request & { aegrosApiKey?: { id: string; role: string } };

@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  create(@Body() body: CreateJobDto, @Req() req: ReqWithKey) {
    return this.jobs.create(
      body.domains,
      body.policy,
      body.ackAuthorized,
      req.aegrosApiKey?.id ?? null,
    );
  }

  @Get()
  list() {
    return this.jobs.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.jobs.get(id);
  }

  @Get(':id/sarif')
  async sarif(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const job = await this.jobs.get(id);
    if (!job.report) {
      throw new NotFoundException('Report not available yet');
    }
    res.setHeader('Content-Type', 'application/sarif+json; charset=utf-8');
    return reportToSarif(job.report);
  }

  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return timer(0, 1500).pipe(
      switchMap(() => from(this.jobs.get(id))),
      map((job) => {
        const data = JSON.stringify({
          id: job.id,
          status: job.status,
          currentStage: job.currentStage,
          stages: job.stages,
          errorMessage: job.errorMessage,
        });
        return { data } satisfies MessageEvent;
      }),
      takeWhile((evt) => {
        const raw = typeof evt.data === 'string' ? evt.data : JSON.stringify(evt.data);
        const j = JSON.parse(raw) as { status: string };
        return j.status === 'queued' || j.status === 'running';
      }, true),
    );
  }
}
