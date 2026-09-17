import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { DOC_TYPES, OCR_LANGS, type DocType, type Unit } from '@athar/shared';

export const sourceRefSchema = z.object({
  page: z.number().int().positive(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  snippet: z.string().min(1).max(500),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const extractedFieldSchema = z.object({
  name: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1),
  sourceRef: sourceRefSchema,
});
export type ExtractedField = z.infer<typeof extractedFieldSchema>;

export const extractionResultSchema = z.object({
  docType: z.string(),
  language: z.enum(['ar', 'en', 'mixed']),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  fields: z.array(extractedFieldSchema),
  confidence: z.number().min(0).max(1),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export interface ExtractionRequest {
  file: Buffer;
  filename: string;
  mime: string;
  docType: DocType;
}

export interface ExtractionCompletion {
  complete(prompt: string, image: Buffer, mime: string): Promise<string>;
}

export class ExtractionError extends Error {}
export class ClassificationError extends Error {}

export function redactPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/(?:\+971|00971|0)\s?5\d[\s-]?\d{3}[\s-]?\d{4}/g, '[REDACTED_PHONE]')
    .replace(/\b(?:784|784-)[0-9-]{12,}\b/g, '[REDACTED_ID]');
}

export const classificationResultSchema = z.object({
  docType: z.enum(DOC_TYPES),
  language: z.enum(OCR_LANGS),
});
export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export interface ClassificationRequest {
  file: Buffer;
  filename: string;
  mime: string;
}

/**
 * Classify a document's type and language from its actual content (a Haiku
 * vision call) rather than its filename \u2014 filename hints are unreliable
 * (renamed files, generic names) and were the pre-Sonnet-4.5-era stand-in
 * this replaced. Runs before extractFromDocument in the worker's pipeline
 * (projectBrief.md section 7, step 1).
 */
export async function classifyDocument(
  request: ClassificationRequest,
  completion: ExtractionCompletion,
): Promise<ClassificationResult> {
  const prompt = [
    'Classify this UAE industrial evidence document from its actual content.',
    `Valid docType values: ${DOC_TYPES.join(', ')}.`,
    `Valid language values: ${OCR_LANGS.join(', ')} (use "mixed" when both Arabic and English appear).`,
    'Return JSON only: { "docType": "...", "language": "..." }.',
  ].join(' ');
  const raw = await completion.complete(prompt, request.file, request.mime);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ClassificationError('Model returned invalid JSON');
  }
  const result = classificationResultSchema.safeParse(parsed);
  if (!result.success)
    throw new ClassificationError('Model output did not match the classification schema');
  return result.data;
}

function redactExtractedField(field: ExtractedField): ExtractedField {
  return {
    ...field,
    value: typeof field.value === 'string' ? redactPii(field.value) : field.value,
    sourceRef: { ...field.sourceRef, snippet: redactPii(field.sourceRef.snippet) },
  };
}

// Regex-based redaction cannot run on the document image/PDF bytes sent to
// the vision model below — it only ever sees text. Instead we redact the
// verbatim snippets and values the model returns before the result is
// returned to the caller, since that is the text that would otherwise leak
// PII (emails, UAE phone numbers, Emirates ID numbers) into logs or the DB.
function redactExtractionResult(result: ExtractionResult): ExtractionResult {
  return { ...result, fields: result.fields.map(redactExtractedField) };
}

export async function extractFromDocument(
  request: ExtractionRequest,
  completion: ExtractionCompletion,
): Promise<ExtractionResult> {
  const prompt = [
    'Extract structured activity data from this UAE industrial evidence document.',
    `Document type: ${request.docType}.`,
    'Return JSON only with docType, language, optional periodStart/periodEnd, confidence, and fields.',
    'Every field must include a page, a verbatim short snippet, and confidence between 0 and 1.',
    'Do not infer missing values. Use the document language and preserve Arabic text in snippets.',
  ].join(' ');
  const raw = await completion.complete(prompt, request.file, request.mime);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExtractionError('Model returned invalid JSON');
  }
  const result = extractionResultSchema.safeParse(parsed);
  if (!result.success)
    throw new ExtractionError('Model output did not match the extraction schema');
  return redactExtractionResult(result.data);
}

/**
 * Generic Anthropic-backed completion adapter — used both for classification
 * (pass a Haiku model id) and structured extraction (the Sonnet default).
 */
export function createAnthropicExtractor(apiKey: string, model = 'claude-sonnet-4-5') {
  if (!apiKey.trim()) throw new ExtractionError('ANTHROPIC_API_KEY is required');
  const client = new Anthropic({ apiKey });
  return {
    async complete(prompt: string, image: Buffer, mime: string): Promise<string> {
      const mediaType = mime === 'application/pdf' ? 'application/pdf' : mime;
      const source =
        mediaType === 'application/pdf'
          ? { type: 'base64' as const, media_type: mediaType, data: image.toString('base64') }
          : {
              type: 'base64' as const,
              media_type: mediaType as 'image/jpeg' | 'image/png',
              data: image.toString('base64'),
            };
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: source as never },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });
      const text = response.content.find((block) => block.type === 'text');
      if (!text || text.type !== 'text')
        throw new ExtractionError('Model returned no text content');
      return text.text;
    },
  } satisfies ExtractionCompletion;
}

export function fieldUnit(value: ExtractedField): Unit | undefined {
  const units: readonly Unit[] = [
    'kWh',
    'MWh',
    'litre',
    'm3',
    'kg',
    'tonne',
    'TR_hour',
    'km',
    'GJ',
  ];
  return value.unit && units.includes(value.unit as Unit) ? (value.unit as Unit) : undefined;
}
