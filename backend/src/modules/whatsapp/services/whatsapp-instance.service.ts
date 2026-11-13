import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { WhatsAppCapabilitiesService } from '../capabilities/whatsapp-capabilities.service';
import { CreateWhatsAppInstanceDto, UpdateWhatsAppInstanceDto } from '../dto/whatsapp-instance.dto';
import { WhatsAppProvider, WHATSAPP_PROVIDER } from '../providers/whatsapp-provider.interface';
import { ProviderCapabilities } from '../capabilities/whatsapp-capabilities.types';

@Injectable()
export class WhatsAppInstanceService {
  private readonly logger = new Logger(WhatsAppInstanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly capabilitiesService: WhatsAppCapabilitiesService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  /**
   * Registra uma nova conexão/instância com criptografia segura da chave
   */
  async create(tenantId: string, dto: CreateWhatsAppInstanceDto) {
    const existing = await this.prisma.whatsAppInstance.findUnique({
      where: {
        tenantId_instanceName: {
          tenantId,
          instanceName: dto.instanceName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Uma instância com o nome "${dto.instanceName}" já existe nesta empresa.`);
    }

    const apiKeyEncrypted = dto.apiKey ? this.cryptoService.encrypt(dto.apiKey) : null;
    const capabilities = this.capabilitiesService.getCapabilities(dto.providerType || 'BAILEYS');

    const instance = await this.prisma.whatsAppInstance.create({
      data: {
        tenantId,
        instanceName: dto.instanceName,
        phoneNumber: dto.phoneNumber,
        providerType: dto.providerType || 'BAILEYS',
        serverUrl: dto.serverUrl,
        apiKeyEncrypted,
        webhookSecret: dto.webhookSecret,
        capabilities: capabilities as any,
        status: 'CONNECTED',
      },
    });

    return this.sanitize(instance);
  }

  /**
   * Lista todas as conexões da empresa com chaves devidamente mascaradas
   */
  async findAll(tenantId: string) {
    const instances = await this.prisma.whatsAppInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return instances.map((inst) => this.sanitize(inst));
  }

  /**
   * Busca uma instância por ID garantindo isolamento multi-tenant
   */
  async findOne(tenantId: string, id: string) {
    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { id, tenantId },
    });

    if (!instance) {
      throw new NotFoundException(`Conexão WhatsApp não encontrada.`);
    }

    return this.sanitize(instance);
  }

  /**
   * Atualiza uma conexão
   */
  async update(tenantId: string, id: string, dto: UpdateWhatsAppInstanceDto) {
    await this.findOne(tenantId, id);

    const data: any = {
      phoneNumber: dto.phoneNumber,
      providerType: dto.providerType,
      serverUrl: dto.serverUrl,
      webhookSecret: dto.webhookSecret,
      status: dto.status,
    };

    if (dto.apiKey) {
      data.apiKeyEncrypted = this.cryptoService.encrypt(dto.apiKey);
    }

    if (dto.providerType) {
      data.capabilities = this.capabilitiesService.getCapabilities(dto.providerType) as any;
    }

    const updated = await this.prisma.whatsAppInstance.update({
      where: { id },
      data,
    });

    return this.sanitize(updated);
  }

  /**
   * Retorna a matriz de recursos e capacidades suportados pela conexão
   */
  async getCapabilities(tenantId: string, id: string): Promise<ProviderCapabilities> {
    const instance = await this.findOne(tenantId, id);
    return this.capabilitiesService.getCapabilities(instance.providerType);
  }

  /**
   * Testa a conectividade com a Evolution API
   */
  async testConnection(tenantId: string, id: string): Promise<{ connected: boolean; details?: any }> {
    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { id, tenantId },
    });

    if (!instance) {
      throw new NotFoundException(`Conexão WhatsApp não encontrada.`);
    }

    try {
      // Simulação ou chamada real ao getCapabilities do provedor
      const caps = await this.provider.getCapabilities(instance.providerType);
      return {
        connected: true,
        details: {
          instanceName: instance.instanceName,
          providerType: instance.providerType,
          capabilities: caps,
        },
      };
    } catch (err) {
      return {
        connected: false,
        details: { error: err.message },
      };
    }
  }

  /**
   * Remove credenciais em texto claro e mascara chaves de segurança
   */
  private sanitize(instance: any) {
    let maskedKey = '';
    if (instance.apiKeyEncrypted) {
      try {
        const raw = this.cryptoService.decrypt(instance.apiKeyEncrypted);
        maskedKey = this.cryptoService.maskApiKey(raw);
      } catch {
        maskedKey = '****';
      }
    }

    const { apiKeyEncrypted, ...rest } = instance;
    return {
      ...rest,
      apiKeyMasked: maskedKey,
      hasCustomApiKey: Boolean(apiKeyEncrypted),
    };
  }
}
