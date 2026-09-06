import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Redis 服务（组长基座）：
 * - REDIS_URL 未配置或连接失败时**静默降级**：所有方法返回 null/false，
 *   保证离线单测、未启动 Docker 的成员机器上业务不中断（安全降级见 README）；
 * - 用法：限流计数 / JWT 登出黑名单 / 缓存（后续缓存键统一 `wm:` 前缀）。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly url = process.env.REDIS_URL ?? '';

  private ensure(): Redis | null {
    if (!this.url) return null;
    if (!this.client) {
      this.client = new Redis(this.url, {
        // 自动连接 + 离线命令缓冲（连接恢复后自动执行）；maxRetriesPerRequest 控制失败等待时长
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: true,
      });
      this.client.on('error', (err: Error) =>
        this.logger.warn(`redis error (degraded): ${err.message}`),
      );
    }
    return this.client;
  }

  /** 自增计数；首次自增时设 TTL。返回 null = Redis 不可用（调用方跳过限流） */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    const client = this.ensure();
    if (!client) return null;
    try {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds).catch(() => undefined);
      }
      return count;
    } catch (err) {
      this.logger.warn(`redis incr failed: ${err instanceof Error ? err.message : String(err)}`);
      this.reset();
      return null;
    }
  }

  /** 写入带 TTL 的值（登出黑名单等）。返回 false = Redis 不可用 */
  async setEx(key: string, value: string, ttlMs: number): Promise<boolean> {
    const client = this.ensure();
    if (!client) return false;
    try {
      await client.set(key, value, 'PX', Math.max(1, Math.floor(ttlMs)));
      return true;
    } catch (err) {
      this.logger.warn(`redis set failed: ${err instanceof Error ? err.message : String(err)}`);
      this.reset();
      return false;
    }
  }

  /** 键是否存在（黑名单命中）。null = Redis 不可用（按"不命中"处理并告警） */
  async exists(key: string): Promise<boolean | null> {
    const client = this.ensure();
    if (!client) return null;
    try {
      return (await client.exists(key)) > 0;
    } catch (err) {
      this.logger.warn(`redis exists failed: ${err instanceof Error ? err.message : String(err)}`);
      this.reset();
      return null;
    }
  }

  /** 读取整数计数。键不存在返回 0；Redis 不可用或值非法返回 null。 */
  async getNumber(key: string): Promise<number | null> {
    const client = this.ensure();
    if (!client) return null;
    try {
      const value = await client.get(key);
      if (value === null) return 0;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
    } catch (err) {
      this.logger.warn(`redis get failed: ${err instanceof Error ? err.message : String(err)}`);
      this.reset();
      return null;
    }
  }

  /** 就绪检查：仅在 Redis 可连接且 PING 成功时返回 true。 */
  async ping(): Promise<boolean> {
    const client = this.ensure();
    if (!client) return false;
    try {
      return (await client.ping()) === 'PONG';
    } catch (err) {
      this.logger.warn(`redis ping failed: ${err instanceof Error ? err.message : String(err)}`);
      this.reset();
      return false;
    }
  }

  /** 删除键（登录成功清除失败计数）。false = Redis 不可用 */
  async del(key: string): Promise<boolean> {
    const client = this.ensure();
    if (!client) return false;
    try {
      await client.del(key);
      return true;
    } catch {
      this.reset();
      return false;
    }
  }

  /** 自愈：操作失败即销毁连接，下次操作按最新 REDIS_URL 重建（Redis 恢复后无需重启服务） */
  private reset() {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }
}
