import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../security/crypto.service';

@Injectable()
export class WhatsAppWebhookGuard implements CanActivate {
  private readonly logger = new Logger(WhatsAppWebhookGuard.name);
  private readonly globalApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {
    this.globalApiKey =
      this.configService.get<string>('EVOLUTION_API_KEY') ||
      'evolution_dev_global_api_key_change_in_prod';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const instanceName = request.params?.instanceName || request.body?.instance;

    // Extrai chave de autenticação do cabeçalho ou query param
    const providedKey =
      request.headers['apikey'] ||
      request.headers['x-api-key'] ||
      (request.headers['authorization']?.startsWith('Bearer ')
        ? request.headers['authorization'].substring(7)
        : null) ||
      request.query?.apikey ||
      request.body?.apikey;

    if (!providedKey) {
      this.logger.warn(`Tentativa de acesso ao webhook sem chave de autenticação para instância ${instanceName}`);
      throw new UnauthorizedException('Chave de autenticação ausente');
    }

    // 1. Chave global de sistema sempre autorizada (para desenvolvimento ou webhook unificado)
    if (providedKey === this.globalApiKey) {
      return true;
    }

    // 2. Se informada a instância, valida contra a chave específica cadastrada na conexão
    if (instanceName) {
      const instance = await this.prisma.whatsAppInstance.findFirst({
        where: { instanceName },
      });

      if (instance) {
        if (instance.webhookSecret && providedKey === instance.webhookSecret) {
          return true;
        }

        if (instance.apiKeyEncrypted) {
          try {
            const decryptedKey = this.cryptoService.decrypt(instance.apiKeyEncrypted);
            if (decryptedKey === providedKey) {
              return true;
            }
          } catch (e) {
            this.logger.error(`Erro ao decriptografar chave da instância ${instanceName}`);
          }
        }
      }
    }

    this.logger.warn(`Falha na autenticação do webhook para instância: ${instanceName}`);
    throw new UnauthorizedException('Chave de autenticação inválida');
  }
}
