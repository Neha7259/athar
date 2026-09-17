import { eq } from 'drizzle-orm';
import { evidenceDocuments, extractions, type Db } from '@athar/db';
import {
  classifyDocument,
  extractFromDocument,
  type ExtractionCompletion,
  type ExtractionRequest,
} from '@athar/extraction';

// Bump when the extraction prompt in packages/extraction changes materially —
// stored on every extraction row so results stay traceable to the prompt
// version that produced them (projectBrief.md section 7).
export const EXTRACTION_PROMPT_VERSION = 'v1';

export interface ExtractionJobDeps {
  db: Db;
  // Separate adapters so the pipeline matches projectBrief.md section 7:
  // classification runs on a cheaper/faster (Haiku) model, extraction on
  // the more capable (Sonnet) model.
  classificationCompletion: ExtractionCompletion;
  extractionCompletion: ExtractionCompletion;
  readEvidence: (storageKey: string) => Promise<Buffer>;
  extractionModel?: string;
}

export interface ExtractionJobPayload {
  evidenceDocumentId: string;
}

export class ExtractionJobError extends Error {}

export async function runExtractionJob(deps: ExtractionJobDeps, payload: ExtractionJobPayload) {
  const {
    db,
    classificationCompletion,
    extractionCompletion,
    readEvidence,
    extractionModel = 'claude-sonnet-4-5',
  } = deps;

  const [document] = await db
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.id, payload.evidenceDocumentId));
  if (!document) {
    throw new ExtractionJobError(`Evidence document ${payload.evidenceDocumentId} not found`);
  }

  const file = await readEvidence(document.storageKey);

  // Classify from actual content — the docType chosen at upload time is
  // only a human hint and may be wrong or left as the 'other' default.
  const classification = await classifyDocument(
    { file, filename: document.originalFilename, mime: document.mime },
    classificationCompletion,
  );
  const [classifiedDocument] = await db
    .update(evidenceDocuments)
    .set({ docType: classification.docType, ocrLang: classification.language })
    .where(eq(evidenceDocuments.id, document.id))
    .returning();
  if (!classifiedDocument) throw new ExtractionJobError('Failed to record classification');

  const request: ExtractionRequest = {
    file,
    filename: document.originalFilename,
    mime: document.mime,
    docType: classifiedDocument.docType,
  };
  const result = await extractFromDocument(request, extractionCompletion);

  const [extraction] = await db
    .insert(extractions)
    .values({
      documentId: document.id,
      model: extractionModel,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      rawJson: result,
      confidence: result.confidence.toString(),
      status: 'proposed',
    })
    .returning();
  if (!extraction) throw new ExtractionJobError('Failed to persist extraction result');
  return extraction;
}
