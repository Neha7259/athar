/**
 * Worker entrypoint.
 * Sprint 3: extraction queue is consumed here — evidence upload (apps/api)
 * enqueues a job, this processor runs packages/extraction against the
 * stored file and writes a `proposed` extractions row for human review.
 * Calculation/export queues remain placeholders for a later sprint.
 */
import { Queue, Worker } from 'bullmq';
import { createAnthropicExtractor, type ExtractionCompletion } from '@athar/extraction';
import { getDb } from './database.js';
import { readEvidence } from './storage.js';
import { runExtractionJob, type ExtractionJobPayload } from './processors/extraction.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port) || 6379 };
}

const connection = parseRedisUrl(REDIS_URL);

const defaultJobOptions = { removeOnComplete: 100, removeOnFail: 500 };

// Queue declarations — calculation/export workers land in a later sprint.
export const extractionQueue = new Queue('extraction', { connection, defaultJobOptions });
export const calcQueue = new Queue('calculation', { connection, defaultJobOptions });
export const exportQueue = new Queue('export', { connection, defaultJobOptions });

// Constructed lazily per call (not once at module load) so a missing
// ANTHROPIC_API_KEY fails the individual job — visible in BullMQ's failed
// set — instead of crashing the whole worker process at startup.
// Classification uses Haiku (cheap/fast triage); extraction uses the
// Sonnet default — see projectBrief.md section 7.
const classificationCompletion: ExtractionCompletion = {
  complete: (prompt, image, mime) =>
    createAnthropicExtractor(process.env.ANTHROPIC_API_KEY ?? '', 'claude-haiku-4-5-20251001').complete(
      prompt,
      image,
      mime,
    ),
};
const extractionCompletion: ExtractionCompletion = {
  complete: (prompt, image, mime) =>
    createAnthropicExtractor(process.env.ANTHROPIC_API_KEY ?? '').complete(prompt, image, mime),
};

export const extractionWorker = new Worker<ExtractionJobPayload>(
  'extraction',
  async (job) => {
    const extraction = await runExtractionJob(
      { db: getDb(), classificationCompletion, extractionCompletion, readEvidence },
      job.data,
    );
    return { extractionId: extraction.id };
  },
  { connection },
);

extractionWorker.on('completed', (job) => {
  console.log(`[worker] extraction job ${job.id} completed for document ${job.data.evidenceDocumentId}`);
});
extractionWorker.on('failed', (job, err) => {
  console.error(`[worker] extraction job ${job?.id} failed:`, err.message);
});

console.log('[worker] extraction worker running — calculation/export queues still placeholders');
