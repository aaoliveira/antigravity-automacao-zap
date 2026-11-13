import { Module } from '@nestjs/common';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { FlowValidatorService } from './validator/flow-validator.service';

@Module({
  controllers: [AutomationsController],
  providers: [AutomationsService, FlowValidatorService],
  exports: [AutomationsService, FlowValidatorService],
})
export class AutomationsModule {}
