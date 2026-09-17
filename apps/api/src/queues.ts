import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port) || 6379 };
}

let queue: Queue | undefined;

export function getExtractionQueue() {
  queue ??= new Queue('extraction', {
    connection: parseRedisUrl(REDIS_URL),
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
  });
  return queue;
}

export async function closeQueues() {
  await queue?.close();
  queue = undefined;
}
