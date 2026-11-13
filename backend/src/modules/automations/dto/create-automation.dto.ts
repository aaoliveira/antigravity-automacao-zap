import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { WorkflowDefinition } from '../schema/flow-node.types';

export class CreateAutomationDto {
  @ApiProperty({
    description: 'Nome da automação',
    example: 'Atendimento Comercial WhatsApp',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição detalhada do objetivo do fluxo',
    example: 'Qualifica leads, apresenta catálogo e transfere para vendas.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Definição inicial do fluxo no formato JSON estruturado',
  })
  @IsOptional()
  initialDraft?: WorkflowDefinition;
}
