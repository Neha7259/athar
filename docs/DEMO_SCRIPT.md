# Athar seven-minute demo script

## 0:00–0:30 — The problem

Open the Athar workspace for a UAE industrial facility. Explain that the plant's evidence is spread across electricity bills, fuel invoices, cooling bills, refrigerant logs, and meter exports.

## 0:30–2:00 — Evidence Vault

Register the demo organization, add a facility, and upload a synthetic Arabic/English utility bill. Show the SHA-256, retention date, document type, and source reference metadata. Emphasize that the file is retained immutably and remains linked to every number derived from it.

## 2:00–3:20 — Source Register and extraction

Ask the Source Register assistant about a DEWA electricity bill. Show the proposed category, scope, unit, confidence, and confirmation questions. Confirm the source only after reviewing the proposal. Start extraction using the configured Anthropic key and show the page/snippet reference.

## 3:20–4:20 — Ledger and calculation

Preview the calculation for activity quantity multiplied by a versioned factor. Open the traceability chain: activity, evidence, factor ID/set, calculation version, and confirming user. Call out provisional factors until official UAE values are confirmed.

## 4:20–5:10 — Data quality

Run the DQ preview with a missing month and a year-on-year jump. Show the deterministic rule code and explanation. Explain that rules decide the flag; AI may explain it but cannot override it.

## 5:10–6:10 — Reduction plan

Open the reduction preview for electricity and cooling sources. Show proposed measures, screening savings ranges, capex ranges, and the explicit estimate basis. Mark every measure proposed until a facility owner validates it.

## 6:10–7:00 — Verifier pack

Generate the canonical inventory CSV and HTML verifier pack. Show the evidence index, SHA-256, methodology, factor set, and change log. State that IEQT/EAD-specific mappings remain pending official regulator templates and are never guessed.

## Demo prerequisites

- Docker Desktop running
- `pnpm install`
- `pnpm db:migrate`
- API and web dev servers running
- Synthetic documents only unless the facility owner approves real evidence
- Anthropic key set locally for the live extraction segment
