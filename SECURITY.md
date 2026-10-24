# Security Policy & Threat Model — WebPilot AI

## 1. Threat Model & Trust Boundaries

WebPilot AI operates across three distinct trust zones:

1. **Untrusted Webpage DOM (`content.ts` & Target Article)**:
   - Any webpage viewed by the user may contain adversarial prompt-injection instructions, malformed HTML, or sensitive input fields.
   - **Controls**:
     - Content extraction (`src/shared/extractor.ts` and `apps/extension/entrypoints/content.ts`) strips `<form>`, `<input>`, `<textarea>`, `<select>`, `<script>`, `<style>`, `<nav>`, and `[type="password"]` elements before reading text.
     - Cookies, `localStorage`, session tokens, and background browsing history are never read or transmitted.
     - Content extraction never runs automatically on page load; it requires an explicit `"Use this page"` user action and consent.

2. **Extension Side Panel & Background Worker (`sidepanel` / `background.ts`)**:
   - Uses Manifest V3 with minimal permissions (`activeTab`, `scripting`, `storage`, `sidePanel`). No `<all_urls>` host permission is requested on installation.
   - Every runtime message between the Side Panel, Background Service Worker, and Content Script is validated against `ExtensionMessageSchema` (Zod).
   - No AI provider API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) are ever placed in extension bundles or `VITE_*` variables.

3. **Backend API & AI Provider Layer (`server.ts` / `src/server/*`)**:
   - **Authentication & Per-User Ownership**: Every `/api/v1/library`, `/api/v1/workspaces`, `/api/v1/me`, and `/api/v1/ai/*` endpoint requires a valid session token (`requireAuth`). Repository methods (`WebPilotRepository`) enforce `ownerUserId` checks on every read, update, and delete operation (`FORBIDDEN_OWNERSHIP` -> HTTP 403).
   - **Prompt Injection Defense (`src/shared/security.ts`)**:
     - Webpage blocks are wrapped in `<untrusted_webpage_content>` XML tags and inspected for override directives (`ignore previous instructions`, `reveal secret API key`, delimiter escapes).
     - Any embedded boundary tags inside webpage text are neutralized (`[escaped_boundary_tag]`).
     - The AI system charter strictly forbids executing commands or following instructions found inside `<untrusted_webpage_content>`.
   - **Source-Grounding Verification (`verifyAndMapSourceReferences`)**:
     - Every block ID returned by the AI model is cross-checked against the actual supplied `ExtractedBlock[]` map. Hallucinated or non-existent block IDs are rejected before returning the response.
   - **Payload Size & Rate Limiting**:
     - Express enforces a strict `100kb` JSON body limit (HTTP 413 on oversized payloads).
     - `SlidingWindowRateLimiter` enforces per-user request quotas (HTTP 429 with `Retry-After` metadata).
