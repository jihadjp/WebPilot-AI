# Privacy Policy & Data Handling Disclosure — WebPilot AI

## 1. Explicit User Consent First

WebPilot AI **never** automatically reads, extracts, or transmits webpage content when you browse the web. Page text is extracted only when you explicitly click **"Use this page"** or submit a selected-text action inside the WebPilot AI Side Panel.

## 2. Categories of Data Processed

- **Permitted Webpage Context**: Readable article headings and paragraphs (`h1`, `h2`, `h3`, `p`, `li`, `pre`, `blockquote`), page title, and URL of the tab you explicitly approve.
- **Strictly Excluded Data**: WebPilot AI never collects passwords, `<input>` or `<form>` values, cookies, authentication headers, or background browsing history.
- **Remote AI Processing Disclosure**: When you trigger an AI action (Summarize, Ask, Explain Selection, or Study Quiz), the bounded extracted text blocks are transmitted to the configured backend server and processed by the configured AI provider (OpenAI Responses API or Google Gemini API). Content is **not** processed locally by an in-browser LLM unless running in deterministic offline test mode.

## 3. Data Retention, Export & Deletion

- **Transient Context**: Captured webpage blocks are used solely to fulfill your requested summary, Q&A, or quiz and are not stored permanently unless you explicitly click **"Save to Library"**.
- **Saved Library & Workspaces**: Items you explicitly save are stored in your private account database (`saved_items`) and protected by strict user-ownership checks.
- **Full Export & One-Click Deletion**: Inside **Settings -> Privacy & Data Controls**, you can export all of your saved data as JSON (`GET /api/v1/me/export`) or permanently delete all saved library items and conversations (`DELETE /api/v1/me/data`).
