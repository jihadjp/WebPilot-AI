import { ExtractedBlock } from './schemas';

export interface PromptInjectionCheckResult {
  suspicious: boolean;
  matchedPatterns: string[];
  sanitizedText: string;
  warningBanner?: string;
}

const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: 'ignore_previous_instructions',
    regex: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|directives)\b/i,
  },
  {
    name: 'system_role_override',
    regex: /\b(you\s+are\s+now|act\s+as\s+a\s+system|new\s+system\s+prompt|system\s*:\s*override)\b/i,
  },
  {
    name: 'exfiltrate_secrets',
    regex: /\b(print|reveal|output|send|exfiltrate)\s+(your\s+)?(api\s*key|secret|system\s+prompt|env|environment\s+variables|cookies|session\s+token)\b/i,
  },
  {
    name: 'delimiter_escape',
    regex: /<\/?(untrusted_webpage_content|system_instruction|trusted_directive)>/i,
  },
  {
    name: 'privileged_tool_invocation',
    regex: /\b(execute_command|chrome\.cookies|chrome\.tabs\.executeScript|fetch\s*\(\s*['"]https?:\/\/)/i,
  },
];

/**
 * Inspects untrusted webpage content or user selection for prompt-injection attempts,
 * neutralizes delimiter escapes, and flags suspicious instructions so the AI provider
 * treats them strictly as passive data.
 */
export function inspectAndSanitizeUntrustedContent(rawText: string): PromptInjectionCheckResult {
  const matchedPatterns: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(rawText)) {
      matchedPatterns.push(pattern.name);
    }
  }

  // Neutralize any XML boundary tags that could attempt to break out of untrusted_webpage_content
  const sanitizedText = rawText
    .replace(/<\/?untrusted_webpage_content>/gi, '[escaped_boundary_tag]')
    .replace(/<\/?system_instruction>/gi, '[escaped_system_tag]')
    .replace(/<\/?trusted_directive>/gi, '[escaped_directive_tag]');

  const suspicious = matchedPatterns.length > 0;
  return {
    suspicious,
    matchedPatterns,
    sanitizedText,
    warningBanner: suspicious
      ? 'Untrusted webpage content contained instruction-like directives. WebPilot AI isolated these directives and processed the text strictly as passive source data.'
      : undefined,
  };
}

/**
 * Formats extracted webpage blocks inside explicit XML data boundaries so the LLM
 * cannot confuse webpage text with system instructions.
 */
export function buildBoundedContextPrompt(blocks: ExtractedBlock[]): {
  formattedContext: string;
  suspicious: boolean;
  warningBanner?: string;
} {
  let anySuspicious = false;
  const serializedBlocks: string[] = [];

  for (const block of blocks) {
    const check = inspectAndSanitizeUntrustedContent(block.text);
    if (check.suspicious) {
      anySuspicious = true;
    }
    const headingAttr = block.heading
      ? ` heading="${block.heading.replace(/"/g, "'")}"`
      : '';
    serializedBlocks.push(
      `<source_block id="${block.id}" tag="${block.tag}"${headingAttr}>\n${check.sanitizedText}\n</source_block>`
    );
  }

  return {
    formattedContext: `<untrusted_webpage_content>\n${serializedBlocks.join('\n')}\n</untrusted_webpage_content>`,
    suspicious: anySuspicious,
    warningBanner: anySuspicious
      ? 'Prompt-injection defense triggered: embedded指令/instruction patterns inside the webpage were neutralized and treated as passive text.'
      : undefined,
  };
}
