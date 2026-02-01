import { Module } from '@nestjs/common';
import { CoreService } from './core.service';

/**
 * Nest module that provides shared core services and utilities for the Umoja gateway.
 * Exports CoreService for use in other modules.
 */
@Module({
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
