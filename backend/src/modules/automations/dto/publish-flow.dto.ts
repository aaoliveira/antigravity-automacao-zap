import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { WorkflowDefinition } from '../schema/flow-node.types';

export class PublishFlowDto {
  @ApiPropertyOptional({
    description: 'Definição a publicar. Se omitido, publica o rascunho atual da automação.',
  })
  @IsOptional()
  definition?: WorkflowDefinition;

  @ApiPropertyOptional({
    description: 'Nota de lançamento ou descrição da versão publicada',
    example: 'Adicionado fluxo de pagamento PIX e captura de e-mail',
  })
  @IsString()
  @IsOptional()
  releaseNotes?: string;
}
