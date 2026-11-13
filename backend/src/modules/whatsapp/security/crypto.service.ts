import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey =
      this.configService.get<string>('ENCRYPTION_MASTER_KEY') ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Garante que a chave possua exatamente 32 bytes (256 bits)
    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      this.masterKey = Buffer.from(rawKey, 'hex');
    } else {
      this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
    }
  }

  /**
   * Criptografa texto claro com AES-256-GCM gerando IV e authTag
   * Formato retornado: iv.authTag.ciphertext (hexadecimal)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(12); // 96-bit IV para GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}.${authTag}.${encrypted}`;
  }

  /**
   * Decriptografa formato iv.authTag.ciphertext
   */
  decrypt(cipherTextWithMeta: string): string {
    if (!cipherTextWithMeta) return '';
    try {
      const parts = cipherTextWithMeta.split('.');
      if (parts.length !== 3) {
        throw new Error('Formato de dados criptografados inválido');
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      this.logger.error(`Falha ao decriptografar dados sensíveis: ${err.message}`);
      throw new Error('Falha de decriptografia de credenciais');
    }
  }

  /**
   * Mascara chave sensível para exibição segura em APIs e painéis administrativos
   * Exemplo: "evo_live_83948398439483" -> "evo_...9483"
   */
  maskApiKey(apiKey?: string | null): string {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '****';
    const prefix = apiKey.substring(0, 4);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}...${suffix}`;
  }
}
