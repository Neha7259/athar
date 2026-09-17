import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.EVIDENCE_STORAGE_PATH ?? '.athar-storage/evidence');

export async function persistEvidence(buffer: Buffer, originalFilename: string) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const extension = path
    .extname(originalFilename)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, '');
  const storageKey = `${sha256}${extension}`;
  const destination = path.join(root, storageKey);
  await mkdir(root, { recursive: true });
  try {
    await writeFile(destination, buffer, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return { sha256, storageKey };
}
