import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Default resolves to <repo-root>/.athar-storage/evidence regardless of the
// process's cwd, so this stays in sync with apps/worker/src/storage.ts's
// reader even though the two apps are started from different directories.
const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const root = path.resolve(
  process.env.EVIDENCE_STORAGE_PATH ?? path.join(repoRoot, '.athar-storage/evidence'),
);

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
