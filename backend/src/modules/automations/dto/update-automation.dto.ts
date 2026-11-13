import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { WorkflowDefinition } from '../schema/flow-node.types';

export class UpdateAutomationDto {
  @ApiPropertyOptional({
    description: 'Nome atualizado da automação',
    example: 'Atendimento Comercial e Suporte',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Descrição atualizada',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Novo rascunho (currentDraft) com os nós, arestas e variáveis',
  })
  @IsOptional()
  currentDraft?: WorkflowDefinition;
}
