import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import * as fs from 'fs';
import { Request } from 'express';
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

  @Post('media/upload')
  @ApiOperation({
    summary: 'Upload de arquivo de mídia para blocos de mensagens (Recomendado Evolution API)',
    description: 'Armazena a mídia de forma isolada por tenant e retorna a URL acessível e metadados para envio no WhatsApp.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem, vídeo, áudio ou documento a ser anexado',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Arquivo enviado e armazenado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Nenhum arquivo enviado.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tenantId = (req.headers['x-tenant-id'] as string) || '00000000-0000-4000-a000-000000000001';
          const dest = join(process.cwd(), 'uploads', tenantId);
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, `${uniqueSuffix}-${safeName}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // Limite de 50MB (especificação do WhatsApp)
      },
    }),
  )
  async uploadMedia(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado no campo "file".');
    }
    return this.automationsService.handleMediaUpload(tenantId, file, req);
  }

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

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativar uma automação pausada/inativa' })
  @ApiParam({ name: 'id', description: 'ID da automação' })
  @ApiResponse({ status: 200, description: 'Automação reativada.' })
  @ApiResponse({ status: 400, description: 'Automação sem versão publicada para ativação.' })
  async activate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.automationsService.activate(tenantId, id);
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
