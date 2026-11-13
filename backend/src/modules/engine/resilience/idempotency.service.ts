import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6382,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.redis.connect().catch((err) => {
      this.logger.warn(`Redis connection warning in IdempotencyService: ${err.message}`);
    });
  }

  /**
   * Verifica se a mensagem já foi processada. Se for inédita, grava a trava de idempotência.
   * Retorna true se for a primeira vez que a mensagem é vista; false se for duplicada.
   */
  async checkAndSet(tenantId: string, messageId: string, ttlSeconds = 86400): Promise<boolean> {
    if (!messageId) return true;

    const key = `dedup:msg:${tenantId}:${messageId}`;
    try {
      const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.error(`Erro ao consultar idempotência no Redis: ${err.message}`);
      // Fallback permissivo em caso de indisponibilidade momentânea do Redis
      return true;
    }
  }

  async clear(tenantId: string, messageId: string): Promise<void> {
    const key = `dedup:msg:${tenantId}:${messageId}`;
    try {
      await this.redis.del(key);
    } catch {
      // Ignora erro de limpeza
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
