import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class ConcurrencyLockService {
  private readonly logger = new Logger(ConcurrencyLockService.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6382,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.redis.connect().catch((err) => {
      this.logger.warn(`Redis connection warning in ConcurrencyLockService: ${err.message}`);
    });
  }

  /**
   * Adquire trava distribuída para a conversa do contato
   * Retorna o lockToken para liberação segura se adquirido com sucesso, ou null se já estiver ocupado.
   */
  async acquireLock(tenantId: string, contactPhone: string, ttlMs = 15000): Promise<string | null> {
    const key = `lock:conversation:${tenantId}:${contactPhone}`;
    const token = randomUUID();

    try {
      const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
      if (acquired === 'OK') {
        return token;
      }
      return null;
    } catch (err) {
      this.logger.error(`Falha ao adquirir trava no Redis para ${contactPhone}: ${err.message}`);
      // Fallback em caso de falha de conexão do Redis para não travar totalmente
      return token;
    }
  }

  /**
   * Libera a trava atômica utilizando script Lua para conferência do token
   */
  async releaseLock(tenantId: string, contactPhone: string, token: string): Promise<boolean> {
    const key = `lock:conversation:${tenantId}:${contactPhone}`;

    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const res = await this.redis.eval(luaScript, 1, key, token);
      return res === 1;
    } catch (err) {
      this.logger.error(`Erro ao liberar trava no Redis para ${contactPhone}: ${err.message}`);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
