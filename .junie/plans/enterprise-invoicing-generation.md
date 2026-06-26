# Enterprise Invoicing — Phase 6: Generation (AI, branding, signature/seal)

Continues `.junie/plans/enterprise-invoicing-upgrade.md` (master Step 6). Steps 1–5b are
complete and deployed. This phase delivers **three** of the four Step 6 features in the
invoice editor; the drag-and-drop template-block editor is deferred to a follow-up.

## Scope (confirmed with user)
- **AI generation** — from a short natural-language brief, generate structured line items
  (description, quantity, price) **+ an optional notes/summary**; fully editable, manual entry
  always available. Server route `POST /api/invoices/ai-generate` → `lib/ai/invoice.ts`
  (Anthropic SDK, `claude-opus-4-6`, **cached system prefix**), gated server-side behind the
  existing `aiAssistant` (Pro+) feature.
- **Branding controls** — logo, accent + secondary color, typography (font family), watermark —
  extending `InvoiceTemplateSettings` (persisted in `metadata.template`).
- **Signature / seal** — a typed/drawn signature plus a **tamper-evident SHA-256 verification
  seal** (deterministic hash over invoice number + total + currency + issue date), rendered as a
  short verification code.
- Branding + signature/seal are **gated behind Enterprise** (`customBranding`) in the UI via the
  existing `FeatureGate`/`UpgradePrompt`; AI is gated server-side.
- All new strings localized across 8 locales (RTL-correct `ar`); Sentry spans; rides the existing
  `invoiceGenerationV2` + `invoiceEditorV2` flags.

## Out of scope
- Drag-and-drop `TemplateBlockEditor` (deferred).
- Any DB migration (branding/signature live in the existing `metadata` JSONB; the seal is derived).

## Delivery Steps

### ✓ Step 1: Seal lib + branding/signature data model
- `lib/invoices/seal.ts`: pure synchronous SHA-256 + `computeInvoiceSeal` (canonical string →
  hash → short grouped verification code), known-answer tested.
- Extend `lib/invoiceTemplate.ts`: `InvoiceFontFamily`, `InvoiceBrandingSettings`,
  `InvoiceSignatureSettings`, extended `InvoiceTemplateSettings` + defaults + backward-compatible
  sanitizer; font-stack helper.

### ✓ Step 2: AI generation (lib + route + assistant component)
- `lib/ai/invoice.ts`: cached-prefix Anthropic call, defensive JSON parsing (`parseGeneratedInvoiceContent`).
- `app/api/invoices/ai-generate/route.ts`: nodejs runtime, cookie-auth, `requireFeature(AI_ASSISTANT)`,
  Sentry span, graceful no-key handling.
- `components/invoices/AILineItemAssistant.tsx`: brief → generate → review → apply (append items +
  optional notes); handles 401/403 (upsell) and errors; a11y + Sentry.

### ✓ Step 3: Branding + signature/seal controls and rendering
- `components/invoices/BrandingControls.tsx` and `components/invoices/SignatureSeal.tsx` editing
  `InvoiceTemplateSettings`; gated behind `customBranding`.
- Extend `LivePreview.tsx` (font, watermark, signature, seal) and `components/pdf/InvoicePDF.tsx`
  (font, watermark, signature, seal) so exports honor the new settings.
- Wire all three into `components/invoices/InvoiceEditor.tsx`.

### ✓ Step 4: i18n, tests, lint/build
- Add `invoices.editor.{ai,branding,signature,seal}.*` to all 8 locales (parity green).
- Tests: seal vectors/determinism, template sanitize backward-compat, AI parse, ai-generate route
  (401/403/200), AILineItemAssistant, BrandingControls/SignatureSeal.
- `npm test`, `npm run lint`, `npm run build`.
