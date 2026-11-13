import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { WorkflowDefinition } from '../schema/flow-node.types';

export class ValidateFlowDto {
  @ApiPropertyOptional({
    description: 'Definição do fluxo a validar. Se omitido, valida o rascunho salvo no banco.',
  })
  @IsOptional()
  definition?: WorkflowDefinition;
}
