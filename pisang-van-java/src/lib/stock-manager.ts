import { redis } from "@/lib/redis";
import * as Sentry from "@sentry/nextjs";

/**
 * ─── LUA SCRIPT: ATOMIC RESERVATION ──────────────────────────────────────────
 * Executes inside Redis's single-threaded event loop.
 * - Returns 1 if reservation succeeds (stock >= qty)
 * - Returns 0 if insufficient stock (stock < qty)
 * - Returns -1 if stock key does not exist (Cache Miss)
 */
const RESERVE_LUA = `
local stockStr = redis.call("GET", KEYS[1])
if not stockStr then 
    return -1 
end

local stock = tonumber(stockStr)
local qty = tonumber(ARGV[1])

if stock >= qty then
    redis.call("DECRBY", KEYS[1], qty)
    return 1
else
    return 0
end
`;

export class StockManager {
  /**
   * Generates a consistent Redis key for a variant's stock.
   */
  private static getKey(variantId: string): string {
    return `stock:variant:${variantId}`;
  }

  /**
   * Atomically reserves stock via Redis Lua Script.
   * Prevents any race conditions during High-Concurrency Flash Sales.
   * 
   * @param variantId Product/Variant ID
   * @param quantity Amount to deduct
   * @returns "SUCCESS" | "INSUFFICIENT_STOCK" | "CACHE_MISS"
   */
  static async reserve(variantId: string, quantity: number): Promise<"SUCCESS" | "INSUFFICIENT_STOCK" | "CACHE_MISS"> {
    try {
      if (quantity <= 0) throw new Error("Quantity must be greater than zero.");

      const key = this.getKey(variantId);
      
      // Upstash Redis eval syntax: eval(script, keys array, args array)
      const result = await redis.eval(RESERVE_LUA, [key], [quantity]);

      if (result === 1) return "SUCCESS";
      if (result === 0) return "INSUFFICIENT_STOCK";
      
      return "CACHE_MISS";

    } catch (error) {
      Sentry.captureException(error, { tags: { module: "stock-manager", action: "reserve" } });
      console.error("[StockManager] Failed to reserve stock for %s:", variantId, error);
      // Fail closed: Do not allow checkout if Redis throws an exception
      throw new Error("Internal Service Error: Unable to process stock at this time.");
    }
  }

  /**
   * Compensating Transaction: Rolls back stock if the downstream DB/Payment fails.
   * Executed to prevent "Ghost Stock" (stock trapped in limbo).
   * 
   * @param variantId Product/Variant ID
   * @param quantity Amount to return to the pool
   */
  static async rollback(variantId: string, quantity: number): Promise<void> {
    try {
      if (quantity <= 0) return;

      const key = this.getKey(variantId);
      await redis.incrby(key, quantity);
    } catch (error) {
      // If this fails, we have Ghost Stock. Alerting is critical.
      Sentry.captureException(error, { 
        tags: { module: "stock-manager", action: "rollback" },
        extra: { variantId, quantity }
      });
      console.error("[StockManager] CRITICAL: Failed to rollback stock for %s. Potential ghost stock!", variantId, error);
    }
  }

  /**
   * Warms up the Redis Cache with the Absolute Truth from PostgreSQL.
   * Must be called by a cache-miss handler or CRON job before a flash sale.
   * 
   * @param variantId Product/Variant ID
   * @param actualStock Exact stock from Postgres
   */
  static async syncStockFromDB(variantId: string, actualStock: number): Promise<void> {
    try {
      const key = this.getKey(variantId);
      // Set the stock, expires in 24 hours to ensure eventual consistency if left stale
      await redis.set(key, actualStock, { ex: 60 * 60 * 24 });
    } catch (error) {
      Sentry.captureException(error, { tags: { module: "stock-manager", action: "syncStock" } });
      console.error("[StockManager] Failed to sync stock to Redis for %s:", variantId, error);
    }
  }
}
