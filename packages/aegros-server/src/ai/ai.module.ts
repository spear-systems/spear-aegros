import { Global, Module } from '@nestjs/common';
import { AI_SERVICE } from './ai.factory';

@Global()
@Module({
  providers: [AI_SERVICE],
  exports: ['AI_SERVICE'],
})
export class AiModule {}
