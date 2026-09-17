import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-side counterpart to apps/api/src/storage.ts's persistEvidence — same
// EVIDENCE_STORAGE_PATH convention and content-addressed storageKey layout.
// The default must resolve to the same <repo-root>/.athar-storage/evidence
// as the API's default, even though the two apps run from different cwds.
const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const root = path.resolve(
  process.env.EVIDENCE_STORAGE_PATH ?? path.join(repoRoot, '.athar-storage/evidence'),
);

export async function readEvidence(storageKey: string): Promise<Buffer> {
  return readFile(path.join(root, storageKey));
}
