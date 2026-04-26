import { Global, Module } from '@nestjs/common';
import { DockerScannerService } from './docker-scanner.service';

@Global()
@Module({
  providers: [DockerScannerService],
  exports: [DockerScannerService],
})
export class DockerModule {}
