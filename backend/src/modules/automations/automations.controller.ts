import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ValidateFlowDto } from './dto/validate-flow.dto';
import { PublishFlowDto } from './dto/publish-flow.dto';
import { DuplicateAutomationDto } from './dto/duplicate-automation.dto';
import { AutomationResponseDto } from './dto/automation-response.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AutomationStatus } from '@prisma/client';

@ApiTags('Automations')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Identificador do Tenant (Multi-tenancy obrigatório)',
  required: true,
})
@UseGuards(TenantGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova automação / fluxo' })
  @ApiResponse({ status: 201, description: 'Automação criada com sucesso.', type: AutomationResponseDto })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.automationsService.create(tenantId, user?.id || 'system-user', dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as automações do tenant' })
  @ApiQuery({ name: 'status', enum: AutomationStatus, required: false })
  @ApiResponse({ status: 200, description: 'Lista de automações.', type: [AutomationResponseDto] })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: AutomationStatus,
  ) {
    return this.automationsService.findAll(tenantId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalhes de uma automação por ID' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Dados da automação.', type: AutomationResponseDto })
  @ApiResponse({ status: 404, description: 'Automação não encontrada.' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.automationsService.findOne(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar informações ou salvar rascunho de uma automação' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Automação atualizada.', type: AutomationResponseDto })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir ou arquivar uma automação' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Automação excluída ou arquivada.' })
  async delete(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.automationsService.delete(tenantId, id);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar a integridade estrutural do fluxo' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Resultado da validação com erros e advertências estruturadas.' })
  async validate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto?: ValidateFlowDto,
  ) {
    return this.automationsService.validate(tenantId, id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publicar o fluxo gerando uma nova versão imutável' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 201, description: 'Versão publicada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Fluxo inválido para publicação.' })
  async publish(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto?: PublishFlowDto,
  ) {
    return this.automationsService.publish(tenantId, id, user?.id || 'system-user', dto);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pausar/desativar uma automação publicada' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Automação pausada.' })
  async pause(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.automationsService.pause(tenantId, id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Listar o histórico de versões da automação' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Lista de versões publicadas.' })
  async getVersions(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.automationsService.getVersions(tenantId, id);
  }

  @Post(':id/restore/:versionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar uma versão anterior para o rascunho de trabalho' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiParam({ name: 'versionId', description: 'ID da versão a restaurar' })
  @ApiResponse({ status: 200, description: 'Rascunho restaurado com sucesso.' })
  async restoreVersion(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.automationsService.restoreVersion(tenantId, id, versionId);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Consultar histórico de execuções da automação' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Lista de execuções com logs e nós visitados.' })
  async getExecutions(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.automationsService.getExecutions(tenantId, id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicar uma automação e seus nós' })
  @ApiParam({ name: 'id', description: 'ID da automação a duplicar' })
  @ApiResponse({ status: 201, description: 'Cópia criada com sucesso.', type: AutomationResponseDto })
  async duplicate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto?: DuplicateAutomationDto,
  ) {
    return this.automationsService.duplicate(tenantId, id, dto);
  }
}
