import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class DuplicateAutomationDto {
  @ApiPropertyOptional({
    description: 'Novo nome para a automação duplicada (opcional, padrão: Cópia de <nome>)',
    example: 'Atendimento Comercial - Cópia Campanha Black Friday',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  newName?: string;
}
