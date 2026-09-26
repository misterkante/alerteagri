import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// Global: every domain module records sensitive actions without importing this module.
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
