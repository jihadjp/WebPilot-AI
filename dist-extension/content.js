(() => {
  // src/shared/extractor.ts
  var MAX_EXTRACTED_CHARS = 24e3;
  var MAX_BLOCKS = 80;
  var MAX_BLOCK_CHARS = 1600;
  var RESTRICTED_PROTOCOLS = /* @__PURE__ */ new Set([
    "chrome:",
    "chrome-extension:",
    "edge:",
    "about:",
    "view-source:",
    "devtools:",
    "javascript:",
    "data:",
    "mailto:",
    "file:"
  ]);
  var RESTRICTED_HOSTS = /* @__PURE__ */ new Set([
    "chromewebstore.google.com",
    "chrome.google.com",
    "microsoftedge.microsoft.com",
    "addons.mozilla.org"
  ]);
  function validatePageUrl(rawUrl) {
    if (!rawUrl || !rawUrl.trim()) {
      return {
        supported: false,
        hostname: "unknown",
        reasonCode: "EMPTY_URL",
        reasonMessage: "No active webpage URL is available in this tab."
      };
    }
    let parsed;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return {
        supported: false,
        hostname: "invalid-url",
        reasonCode: "INVALID_URL",
        reasonMessage: "The current tab address is not a valid web URL."
      };
    }
    if (RESTRICTED_PROTOCOLS.has(parsed.protocol)) {
      return {
        supported: false,
        hostname: parsed.hostname || parsed.protocol.replace(":", ""),
        reasonCode: parsed.protocol === "file:" ? "LOCAL_FILE_UNPERMITTED" : "BROWSER_INTERNAL",
        reasonMessage: parsed.protocol === "file:" ? "Local file:// URLs require explicit file access permission in extension settings." : `Browser-internal pages (${parsed.protocol}//) block extension scripts for security.`
      };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        supported: false,
        hostname: parsed.hostname || "unsupported",
        reasonCode: "BROWSER_INTERNAL",
        reasonMessage: `Unsupported protocol (${parsed.protocol}). Only HTTP and HTTPS pages are supported.`
      };
    }
    const cleanHost = parsed.hostname.toLowerCase();
    if (RESTRICTED_HOSTS.has(cleanHost)) {
      return {
        supported: false,
        hostname: cleanHost,
        reasonCode: "EXTENSION_STORE",
        reasonMessage: "Browser extension stores restrict content scripts to protect browser integrity."
      };
    }
    return {
      supported: true,
      hostname: cleanHost
    };
  }
  function normalizeText(raw) {
    return raw.replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000E-\u001F]/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  function computeContentHash(input) {
    let h1 = 3735928559 ^ input.length;
    let h2 = 1103547991 ^ input.length;
    for (let i = 0, ch; i < input.length; i++) {
      ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
    h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
    return "wp_" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function extractStructuredBlocks(segments, maxChars = MAX_EXTRACTED_CHARS, maxBlocks = MAX_BLOCKS) {
    const blocks = [];
    let totalCharacters = 0;
    let wasTruncated = false;
    let currentHeading;
    let blockCounter = 1;
    for (const seg of segments) {
      if (seg.isExcludedContainer) continue;
      const clean = normalizeText(seg.text);
      if (!clean) continue;
      const isHeading = seg.tag === "h1" || seg.tag === "h2" || seg.tag === "h3";
      if (!isHeading && clean.length < 18) continue;
      if (isHeading) {
        currentHeading = clean.slice(0, 200);
      }
      if (blocks.length >= maxBlocks || totalCharacters >= maxChars) {
        wasTruncated = true;
        break;
      }
      const remainingBudget = maxChars - totalCharacters;
      const effectiveLimit = Math.min(MAX_BLOCK_CHARS, remainingBudget);
      let blockText = clean;
      if (blockText.length > effectiveLimit) {
        blockText = blockText.slice(0, Math.max(1, effectiveLimit - 3)).trimEnd() + "...";
        wasTruncated = true;
      }
      const id = `S${blockCounter++}`;
      blocks.push({
        id,
        heading: currentHeading,
        tag: seg.tag,
        text: blockText,
        charCount: blockText.length
      });
      totalCharacters += blockText.length;
    }
    return {
      blocks,
      totalCharacters,
      wasTruncated
    };
  }
  function parseHtmlToSegments(html) {
    const stripped = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|iframe|canvas|form|input|textarea|select|button|nav|footer|aside|header)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<(input|meta|link|img|br|hr)[^>]*\/?>/gi, " ");
    const articleMatch = stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const targetHtml = articleMatch ? articleMatch[1] : stripped;
    const segments = [];
    const blockRegex = /<(h1|h2|h3|p|li|pre|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = blockRegex.exec(targetHtml)) !== null) {
      const tag = match[1].toLowerCase();
      const innerText = match[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const normalized = normalizeText(innerText);
      if (normalized) {
        segments.push({ tag, text: normalized });
      }
    }
    if (segments.length === 0) {
      const fallbackText = normalizeText(targetHtml.replace(/<[^>]+>/g, " "));
      if (fallbackText.length >= 20) {
        const paragraphs = fallbackText.split(/\n\n+/);
        for (const p of paragraphs) {
          if (p.trim().length >= 18) {
            segments.push({ tag: "p", text: p.trim() });
          }
        }
      }
    }
    return segments;
  }
  function buildPageContextFromHtml(params) {
    const urlCheck = validatePageUrl(params.pageUrl);
    if (!urlCheck.supported) {
      throw new Error(urlCheck.reasonMessage || "Unsupported URL");
    }
    const segments = parseHtmlToSegments(params.html);
    const { blocks, totalCharacters, wasTruncated } = extractStructuredBlocks(
      segments,
      params.maxChars ?? MAX_EXTRACTED_CHARS
    );
    if (blocks.length === 0) {
      throw new Error("No readable article content could be extracted from this page.");
    }
    const concatenated = blocks.map((b) => `${b.id}:${b.text}`).join("|");
    return {
      pageUrl: params.pageUrl,
      pageTitle: normalizeText(params.pageTitle) || urlCheck.hostname,
      hostname: urlCheck.hostname,
      blocks,
      totalCharacters,
      wasTruncated,
      capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
      consentConfirmed: true,
      contentHash: computeContentHash(concatenated)
    };
  }

  // apps/extension/entrypoints/content.ts
  function registerOnDemandContentExtractor() {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "WEBPILOT_EXTRACT_DOM_NOW") {
        try {
          const mainRoot = document.querySelector("article") || document.querySelector("main") || document.body;
          const cloned = mainRoot.cloneNode(true);
          const forbiddenSelectors = [
            "script",
            "style",
            "noscript",
            "nav",
            "footer",
            "aside",
            "form",
            "input",
            "textarea",
            "select",
            "button",
            '[aria-hidden="true"]',
            '[type="password"]'
          ];
          for (const sel of forbiddenSelectors) {
            cloned.querySelectorAll(sel).forEach((el) => el.remove());
          }
          const payload = buildPageContextFromHtml({
            pageUrl: window.location.href,
            pageTitle: document.title || window.location.hostname,
            html: cloned.innerHTML
          });
          sendResponse({
            ok: true,
            payload,
            selectedText: window.getSelection()?.toString()?.trim() || ""
          });
        } catch (err) {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : "EXTRACTION_FAILED"
          });
        }
        return true;
      }
      return false;
    });
  }
  registerOnDemandContentExtractor();
})();
