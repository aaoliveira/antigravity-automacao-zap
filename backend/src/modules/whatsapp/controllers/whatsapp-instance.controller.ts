import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { WhatsAppInstanceService } from '../services/whatsapp-instance.service';
import { CreateWhatsAppInstanceDto, UpdateWhatsAppInstanceDto } from '../dto/whatsapp-instance.dto';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../../common/guards/tenant.guard';

@ApiTags('WhatsApp Instances')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Identificador do Tenant (Multi-tenancy obrigatório)',
  required: true,
})
@UseGuards(TenantGuard)
@Controller('whatsapp/instances')
export class WhatsAppInstanceController {
  constructor(private readonly instanceService: WhatsAppInstanceService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar nova conexão WhatsApp na plataforma' })
  @ApiResponse({ status: 201, description: 'Instância registrada com sucesso (credenciais criptografadas).' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWhatsAppInstanceDto,
  ) {
    return this.instanceService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as instâncias WhatsApp da empresa' })
  @ApiResponse({ status: 200, description: 'Lista de conexões com chaves mascaradas.' })
  async findAll(@CurrentTenant() tenantId: string) {
    return this.instanceService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalhes de uma instância' })
  @ApiParam({ name: 'id', description: 'ID da conexão WhatsApp' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.instanceService.findOne(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar configurações de uma instância WhatsApp' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWhatsAppInstanceDto,
  ) {
    return this.instanceService.update(tenantId, id, dto);
  }

  @Get(':id/capabilities')
  @ApiOperation({ summary: 'Consultar matriz de capacidades suportadas pela conexão' })
  @ApiParam({ name: 'id', description: 'ID da conexão WhatsApp' })
  async getCapabilities(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.instanceService.getCapabilities(tenantId, id);
  }

  @Post(':id/test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Testar conectividade com a Evolution API para a instância' })
  async testConnection(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.instanceService.testConnection(tenantId, id);
  }
}
