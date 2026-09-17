# Source Register assistant guardrails

The assistant proposes a source draft; it never writes directly to `emission_sources`. Every response includes confidence, clarifying questions, and `needsConfirmation: true`. A human must confirm the facility, category, scope, fuel/energy type, and unit before the API creates a source.
