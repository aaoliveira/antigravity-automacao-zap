import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutomationStatus } from '@prisma/client';

export class FlowVersionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  versionNumber: number;

  @ApiProperty()
  schemaVersion: string;

  @ApiProperty()
  isPublished: boolean;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  publishedAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class AutomationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: AutomationStatus })
  status: AutomationStatus;

  @ApiPropertyOptional()
  activeVersionId?: string;

  @ApiPropertyOptional()
  currentDraft?: any;

  @ApiPropertyOptional({ type: () => FlowVersionSummaryDto })
  activeVersion?: FlowVersionSummaryDto;

  @ApiProperty()
  versionCount: number;

  @ApiProperty()
  executionCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
