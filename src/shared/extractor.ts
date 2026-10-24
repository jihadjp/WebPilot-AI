import { ExtractedBlock, PageContextPayload, SourceReference } from './schemas';

export const MAX_EXTRACTED_CHARS = 24000;
export const MAX_BLOCKS = 80;
export const MAX_BLOCK_CHARS = 1600;

export interface UrlSupportStatus {
  supported: boolean;
  hostname: string;
  reasonCode?:
    | 'BROWSER_INTERNAL'
    | 'EXTENSION_STORE'
    | 'INVALID_URL'
    | 'LOCAL_FILE_UNPERMITTED'
    | 'EMPTY_URL';
  reasonMessage?: string;
}

const RESTRICTED_PROTOCOLS = new Set([
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'view-source:',
  'devtools:',
  'javascript:',
  'data:',
  'mailto:',
  'file:',
]);

const RESTRICTED_HOSTS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'microsoftedge.microsoft.com',
  'addons.mozilla.org',
]);

/**
 * Validates whether a URL can be safely accessed by a Manifest V3 extension
 * under activeTab/scripting permissions.
 */
export function validatePageUrl(rawUrl: string | undefined | null): UrlSupportStatus {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      supported: false,
      hostname: 'unknown',
      reasonCode: 'EMPTY_URL',
      reasonMessage: 'No active webpage URL is available in this tab.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      supported: false,
      hostname: 'invalid-url',
      reasonCode: 'INVALID_URL',
      reasonMessage: 'The current tab address is not a valid web URL.',
    };
  }

  if (RESTRICTED_PROTOCOLS.has(parsed.protocol)) {
    return {
      supported: false,
      hostname: parsed.hostname || parsed.protocol.replace(':', ''),
      reasonCode:
        parsed.protocol === 'file:' ? 'LOCAL_FILE_UNPERMITTED' : 'BROWSER_INTERNAL',
      reasonMessage:
        parsed.protocol === 'file:'
          ? 'Local file:// URLs require explicit file access permission in extension settings.'
          : `Browser-internal pages (${parsed.protocol}//) block extension scripts for security.`,
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      supported: false,
      hostname: parsed.hostname || 'unsupported',
      reasonCode: 'BROWSER_INTERNAL',
      reasonMessage: `Unsupported protocol (${parsed.protocol}). Only HTTP and HTTPS pages are supported.`,
    };
  }

  const cleanHost = parsed.hostname.toLowerCase();
  if (RESTRICTED_HOSTS.has(cleanHost)) {
    return {
      supported: false,
      hostname: cleanHost,
      reasonCode: 'EXTENSION_STORE',
      reasonMessage:
        'Browser extension stores restrict content scripts to protect browser integrity.',
    };
  }

  return {
    supported: true,
    hostname: cleanHost,
  };
}

/**
 * Normalizes raw DOM text by collapsing whitespace, stripping zero-width control chars,
 * and preserving readable punctuation.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000E-\u001F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Deterministic fast string hash for content deduplication and cache integrity.
 */
export function computeContentHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'wp_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export interface RawContentSegment {
  tag: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'pre' | 'blockquote';
  text: string;
  isExcludedContainer?: boolean;
}

/**
 * Extracts structured, bounded blocks from raw content segments, preferring readable prose
 * and headings while enforcing deterministic size limits.
 */
export function extractStructuredBlocks(
  segments: RawContentSegment[],
  maxChars: number = MAX_EXTRACTED_CHARS,
  maxBlocks: number = MAX_BLOCKS
): {
  blocks: ExtractedBlock[];
  totalCharacters: number;
  wasTruncated: boolean;
} {
  const blocks: ExtractedBlock[] = [];
  let totalCharacters = 0;
  let wasTruncated = false;
  let currentHeading: string | undefined;
  let blockCounter = 1;

  for (const seg of segments) {
    if (seg.isExcludedContainer) continue;

    const clean = normalizeText(seg.text);
    if (!clean) continue;

    // Skip very short boilerplate fragments unless they are headings
    const isHeading = seg.tag === 'h1' || seg.tag === 'h2' || seg.tag === 'h3';
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
      blockText = blockText.slice(0, Math.max(1, effectiveLimit - 3)).trimEnd() + '...';
      wasTruncated = true;
    }

    const id = `S${blockCounter++}`;
    blocks.push({
      id,
      heading: currentHeading,
      tag: seg.tag,
      text: blockText,
      charCount: blockText.length,
    });

    totalCharacters += blockText.length;
  }

  return {
    blocks,
    totalCharacters,
    wasTruncated,
  };
}

/**
 * Parses an HTML string (removing scripts, styles, nav, footer, aside, forms, inputs, hidden nodes)
 * into clean RawContentSegments. Never extracts password/form values or cookies.
 */
export function parseHtmlToSegments(html: string): RawContentSegment[] {
  // Remove dangerous or non-article regions completely
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|canvas|form|input|textarea|select|button|nav|footer|aside|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(input|meta|link|img|br|hr)[^>]*\/?>/gi, ' ');

  // Prefer <article> or <main> if present
  const articleMatch =
    stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

  const targetHtml = articleMatch ? articleMatch[1] : stripped;

  const segments: RawContentSegment[] = [];
  const blockRegex = /<(h1|h2|h3|p|li|pre|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(targetHtml)) !== null) {
    const tag = match[1].toLowerCase() as RawContentSegment['tag'];
    const innerText = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const normalized = normalizeText(innerText);
    if (normalized) {
      segments.push({ tag, text: normalized });
    }
  }

  // Fallback if page has plain text without standard block tags
  if (segments.length === 0) {
    const fallbackText = normalizeText(targetHtml.replace(/<[^>]+>/g, ' '));
    if (fallbackText.length >= 20) {
      const paragraphs = fallbackText.split(/\n\n+/);
      for (const p of paragraphs) {
        if (p.trim().length >= 18) {
          segments.push({ tag: 'p', text: p.trim() });
        }
      }
    }
  }

  return segments;
}

/**
 * Verifies and maps AI-returned source reference IDs strictly against the supplied
 * page context blocks. Any hallucinated blockId is discarded so fake citations never appear.
 */
export function verifyAndMapSourceReferences(
  candidateRefs: Array<{ blockId: string; relevanceReason?: string }>,
  suppliedBlocks: ExtractedBlock[]
): SourceReference[] {
  const blockMap = new Map<string, ExtractedBlock>();
  for (const block of suppliedBlocks) {
    blockMap.set(block.id.toUpperCase(), block);
  }

  const verified: SourceReference[] = [];
  const seen = new Set<string>();

  for (const ref of candidateRefs) {
    if (!ref || typeof ref.blockId !== 'string') continue;
    const normalizedId = ref.blockId.trim().replace(/^\[|\]$/g, '').toUpperCase();
    if (seen.has(normalizedId)) continue;

    const matched = blockMap.get(normalizedId);
    if (!matched) continue; // Reject hallucinated or non-existent block IDs

    seen.add(normalizedId);
    verified.push({
      blockId: matched.id,
      heading: matched.heading,
      excerpt: matched.text.length > 280 ? matched.text.slice(0, 277) + '...' : matched.text,
      relevanceReason: ref.relevanceReason?.slice(0, 240),
    });
  }

  return verified;
}

/**
 * Builds a complete validated PageContextPayload from HTML and URL.
 */
export function buildPageContextFromHtml(params: {
  pageUrl: string;
  pageTitle: string;
  html: string;
  maxChars?: number;
}): PageContextPayload {
  const urlCheck = validatePageUrl(params.pageUrl);
  if (!urlCheck.supported) {
    throw new Error(urlCheck.reasonMessage || 'Unsupported URL');
  }

  const segments = parseHtmlToSegments(params.html);
  const { blocks, totalCharacters, wasTruncated } = extractStructuredBlocks(
    segments,
    params.maxChars ?? MAX_EXTRACTED_CHARS
  );

  if (blocks.length === 0) {
    throw new Error('No readable article content could be extracted from this page.');
  }

  const concatenated = blocks.map((b) => `${b.id}:${b.text}`).join('|');
  return {
    pageUrl: params.pageUrl,
    pageTitle: normalizeText(params.pageTitle) || urlCheck.hostname,
    hostname: urlCheck.hostname,
    blocks,
    totalCharacters,
    wasTruncated,
    capturedAt: new Date().toISOString(),
    consentConfirmed: true,
    contentHash: computeContentHash(concatenated),
  };
}
