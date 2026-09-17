/**
 * Worker entrypoint.
 * Sprint 3+: document-extraction queue, calc queue, export-generation queue.
 * Sprint 0: placeholder — connects to Redis and logs readiness.
 */
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port) || 6379 };
}

const connection = parseRedisUrl(REDIS_URL);

// Queue declarations — workers wired up in Sprint 3+
export const extractionQueue = new Queue('extraction', { connection });
export const calcQueue = new Queue('calculation', { connection });
export const exportQueue = new Queue('export', { connection });

console.log('[worker] queues registered — waiting for Sprint 3 workers');
