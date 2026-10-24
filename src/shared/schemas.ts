import { z } from 'zod';

export const SupportedLanguageSchema = z.enum(['en', 'bn']);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const SummaryFormatSchema = z.enum([
  'short',
  'detailed',
  'takeaways',
  'step_by_step',
  'bn_summary',
  'en_summary',
]);
export type SummaryFormat = z.infer<typeof SummaryFormatSchema>;

export const SelectionOperationSchema = z.enum([
  'explain_simply',
  'translate_bn',
  'translate_en',
  'give_example',
  'explain_code',
  'short_notes',
]);
export type SelectionOperation = z.infer<typeof SelectionOperationSchema>;

export const QuizTypeSchema = z.enum(['mcq', 'mixed_study']);
export type QuizType = z.infer<typeof QuizTypeSchema>;

export const ThemePreferenceSchema = z.enum(['dark', 'light', 'system']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const ExtractedBlockSchema = z.object({
  id: z.string().min(1).max(32),
  heading: z.string().max(300).optional(),
  tag: z.enum(['h1', 'h2', 'h3', 'p', 'li', 'pre', 'blockquote']),
  text: z.string().min(1).max(4000),
  charCount: z.number().int().nonnegative(),
});
export type ExtractedBlock = z.infer<typeof ExtractedBlockSchema>;

export const PageContextPayloadSchema = z.object({
  pageUrl: z.string().url().max(2048),
  pageTitle: z.string().min(1).max(500),
  hostname: z.string().min(1).max(255),
  blocks: z.array(ExtractedBlockSchema).min(1).max(120),
  totalCharacters: z.number().int().nonnegative(),
  wasTruncated: z.boolean(),
  capturedAt: z.string(),
  consentConfirmed: z.literal(true),
  contentHash: z.string().min(6).max(128),
});
export type PageContextPayload = z.infer<typeof PageContextPayloadSchema>;

export const SourceReferenceSchema = z.object({
  blockId: z.string().min(1).max(32),
  heading: z.string().optional(),
  excerpt: z.string().min(1).max(600),
  relevanceReason: z.string().max(300).optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const SummarizeRequestSchema = z.object({
  pageContext: PageContextPayloadSchema,
  format: SummaryFormatSchema,
  language: SupportedLanguageSchema,
});
export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;

export const SummarizeResponseSchema = z.object({
  summaryTitle: z.string().min(1),
  summary: z.string().min(1),
  mainIdeas: z.array(z.string()).min(1),
  keyTakeaways: z.array(z.string()).min(1),
  importantTerms: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    })
  ),
  sourceReferences: z.array(SourceReferenceSchema),
  wasTruncated: z.boolean(),
  securityNotice: z.string().optional(),
  usage: z.object({
    provider: z.string(),
    model: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
});
export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;

export const ConversationMessageInputSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

export const AskRequestSchema = z.object({
  pageContext: PageContextPayloadSchema,
  question: z.string().trim().min(2).max(1500),
  conversationId: z.string().max(100).optional(),
  previousMessages: z.array(ConversationMessageInputSchema).max(16).default([]),
  language: SupportedLanguageSchema,
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({
  conversationId: z.string(),
  answer: z.string().min(1),
  inferenceNote: z.string().optional(),
  evidenceSufficient: z.boolean(),
  sourceReferences: z.array(SourceReferenceSchema),
  securityNotice: z.string().optional(),
  usage: z.object({
    provider: z.string(),
    model: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

export const ExplainSelectionRequestSchema = z.object({
  selectedText: z.string().trim().min(2).max(5000),
  operation: SelectionOperationSchema,
  language: SupportedLanguageSchema,
  pageContext: PageContextPayloadSchema.optional(),
});
export type ExplainSelectionRequest = z.infer<typeof ExplainSelectionRequestSchema>;

export const ExplainSelectionResponseSchema = z.object({
  operation: SelectionOperationSchema,
  explanation: z.string().min(1),
  examples: z.array(z.string()),
  bulletNotes: z.array(z.string()),
  sourceReferences: z.array(SourceReferenceSchema),
  securityNotice: z.string().optional(),
  usage: z.object({
    provider: z.string(),
    model: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
});
export type ExplainSelectionResponse = z.infer<typeof ExplainSelectionResponseSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  supportedByPage: z.boolean(),
  sourceBlockId: z.string().optional(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string().min(1),
  back: z.string().min(1),
  sourceBlockId: z.string().optional(),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const GenerateQuizRequestSchema = z.object({
  pageContext: PageContextPayloadSchema,
  questionCount: z.number().int().min(3).max(10).default(5),
  quizType: QuizTypeSchema.default('mcq'),
  language: SupportedLanguageSchema,
});
export type GenerateQuizRequest = z.infer<typeof GenerateQuizRequestSchema>;

export const GenerateQuizResponseSchema = z.object({
  quizTitle: z.string().min(1),
  questions: z.array(QuizQuestionSchema).min(1),
  flashcards: z.array(FlashcardSchema),
  revisionNotes: z.array(z.string()),
  sourceReferences: z.array(SourceReferenceSchema),
  usage: z.object({
    provider: z.string(),
    model: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
});
export type GenerateQuizResponse = z.infer<typeof GenerateQuizResponseSchema>;

export const CreateLibraryItemRequestSchema = z.object({
  workspaceId: z.string().nullable().optional(),
  pageUrl: z.string().url().max(2048),
  pageTitle: z.string().min(1).max(500),
  hostname: z.string().min(1).max(255),
  summary: z.string().min(1).max(20000),
  personalNotes: z.string().max(10000).default(''),
  contentHash: z.string().max(128).optional(),
  sourceReferences: z.array(SourceReferenceSchema).max(30).default([]),
});
export type CreateLibraryItemRequest = z.infer<typeof CreateLibraryItemRequestSchema>;

export const UpdateLibraryItemRequestSchema = z.object({
  personalNotes: z.string().max(10000).optional(),
  workspaceId: z.string().nullable().optional(),
  pageTitle: z.string().min(1).max(500).optional(),
});
export type UpdateLibraryItemRequest = z.infer<typeof UpdateLibraryItemRequestSchema>;

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WEBPILOT_GET_TAB_STATUS'),
  }),
  z.object({
    type: z.literal('WEBPILOT_CAPTURE_PAGE'),
    consentConfirmed: z.literal(true),
  }),
  z.object({
    type: z.literal('WEBPILOT_SUBMIT_SELECTION'),
    selectedText: z.string().min(2).max(5000),
    operation: SelectionOperationSchema,
  }),
  z.object({
    type: z.literal('WEBPILOT_CLEAR_CONTEXT'),
  }),
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;
