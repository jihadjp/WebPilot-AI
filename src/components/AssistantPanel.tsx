import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  HelpCircle,
  Highlighter,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ExplainSelectionResponse,
  GenerateQuizResponse,
  PageContextPayload,
  SelectionOperation,
  SourceReference,
  SummarizeResponse,
  SummaryFormat,
  SupportedLanguage,
} from '../shared/schemas';
import { UrlSupportStatus } from '../shared/extractor';
import { t } from '../shared/i18n';
import { apiClient, WorkspaceItem } from '../services/apiClient';

export type AssistantToolMode = 'summarize' | 'qa' | 'selection' | 'study';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inferenceNote?: string;
  evidenceSufficient?: boolean;
  sourceReferences?: SourceReference[];
  securityNotice?: string;
}

interface AssistantPanelProps {
  lang: SupportedLanguage;
  isDark: boolean;
  pageTitle: string;
  pageUrl: string;
  urlStatus: UrlSupportStatus;
  capturedContext: PageContextPayload | null;
  onCapturePage: () => void;
  onClearCapture: () => void;
  activeTool: AssistantToolMode;
  onSelectTool: (tool: AssistantToolMode) => void;
  selectedTextDraft: string;
  onChangeSelectedTextDraft: (text: string) => void;
  onHighlightBlock: (blockId: string) => void;
  workspaces: WorkspaceItem[];
  onSavedToLibrary: () => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  lang,
  isDark,
  pageTitle,
  pageUrl,
  urlStatus,
  capturedContext,
  onCapturePage,
  onClearCapture,
  activeTool,
  onSelectTool,
  selectedTextDraft,
  onChangeSelectedTextDraft,
  onHighlightBlock,
  workspaces,
  onSavedToLibrary,
}) => {
  // Summarize state
  const [summaryFormat, setSummaryFormat] = useState<SummaryFormat>('short');
  const [summaryResult, setSummaryResult] = useState<SummarizeResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Q&A state
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [lastAskedQuestion, setLastAskedQuestion] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // Selection Explanation state
  const [selectionOp, setSelectionOp] = useState<SelectionOperation>('explain_simply');
  const [selectionResult, setSelectionResult] =
    useState<ExplainSelectionResponse | null>(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Study Mode state
  const [quizResult, setQuizResult] = useState<GenerateQuizResponse | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [studySubTab, setStudySubTab] = useState<'questions' | 'flashcards' | 'notes'>(
    'questions'
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // Shared UI feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    workspaces[0]?.id || ''
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSaveContent = async (
    id: string,
    summaryText: string,
    refs: SourceReference[]
  ) => {
    try {
      await apiClient.saveLibraryItem({
        workspaceId: selectedWorkspaceId || null,
        pageUrl: capturedContext?.pageUrl || pageUrl,
        pageTitle: capturedContext?.pageTitle || pageTitle,
        hostname: capturedContext?.hostname || urlStatus.hostname,
        summary: summaryText,
        personalNotes: '',
        contentHash: capturedContext?.contentHash,
        sourceReferences: refs,
      });
      setSavedId(id);
      onSavedToLibrary();
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : 'Failed to save item to library.'
      );
    }
  };

  const runSummarize = async (overrideFormat?: SummaryFormat) => {
    if (!capturedContext || summaryLoading) return;
    const fmt = overrideFormat ?? summaryFormat;
    if (overrideFormat) setSummaryFormat(overrideFormat);
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await apiClient.summarize({
        pageContext: capturedContext,
        format: fmt,
        language: lang,
      });
      setSummaryResult(res);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : 'Unable to generate summary.'
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const runAsk = async (questionToAsk?: string) => {
    const q = (questionToAsk ?? questionInput).trim();
    if (!capturedContext || !q || qaLoading) return;

    setLastAskedQuestion(q);
    if (!questionToAsk) setQuestionInput('');
    setQaLoading(true);
    setQaError(null);

    const userTurn: ChatTurn = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: q,
    };

    const previousMessages = chatHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (!questionToAsk) {
      setChatHistory((prev) => [...prev, userTurn]);
    }

    try {
      const res = await apiClient.ask({
        pageContext: capturedContext,
        question: q,
        conversationId,
        previousMessages,
        language: lang,
      });
      setConversationId(res.conversationId);
      setChatHistory((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          inferenceNote: res.inferenceNote,
          evidenceSufficient: res.evidenceSufficient,
          sourceReferences: res.sourceReferences,
          securityNotice: res.securityNotice,
        },
      ]);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Question request failed.');
    } finally {
      setQaLoading(false);
    }
  };

  const runExplainSelection = async () => {
    const clean = selectedTextDraft.trim();
    if (!clean || selectionLoading) return;
    setSelectionLoading(true);
    setSelectionError(null);
    try {
      const res = await apiClient.explainSelection({
        selectedText: clean,
        operation: selectionOp,
        language: lang,
        pageContext: capturedContext ?? undefined,
      });
      setSelectionResult(res);
    } catch (err) {
      setSelectionError(
        err instanceof Error ? err.message : 'Selection explanation failed.'
      );
    } finally {
      setSelectionLoading(false);
    }
  };

  const runGenerateQuiz = async () => {
    if (!capturedContext || quizLoading) return;
    setQuizLoading(true);
    setQuizError(null);
    setSelectedAnswers({});
    setFlippedCards({});
    try {
      const res = await apiClient.generateQuiz({
        pageContext: capturedContext,
        questionCount: 5,
        quizType: 'mcq',
        language: lang,
      });
      setQuizResult(res);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Quiz generation failed.');
    } finally {
      setQuizLoading(false);
    }
  };

  const surfaceClass = isDark
    ? 'bg-[#173735] border-[#255450] text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="space-y-5">
      {/* Current Page Context Card */}
      <div className={`p-4 rounded-xl border ${surfaceClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="text-sm font-bold tracking-tight truncate"
              title={pageTitle}
            >
              {pageTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-300 tabular-nums">
              <span className="font-mono">{urlStatus.hostname}</span>
              <span aria-hidden="true">·</span>
              <span>
                {!urlStatus.supported
                  ? t(lang, 'statusUnsupported')
                  : capturedContext
                  ? t(lang, 'statusCaptured')
                  : t(lang, 'statusUncaptured')}
              </span>
              {capturedContext && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{capturedContext.blocks.length} blocks</span>
                  <span aria-hidden="true">·</span>
                  <span>{capturedContext.totalCharacters} chars</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {urlStatus.supported && !capturedContext && (
              <button
                type="button"
                onClick={onCapturePage}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white hover:bg-[#096960] transition-colors whitespace-nowrap shrink-0"
              >
                {t(lang, 'useThisPage')}
              </button>
            )}
            {urlStatus.supported && capturedContext && (
              <>
                <button
                  type="button"
                  onClick={onCapturePage}
                  aria-label={t(lang, 'recapturePage')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A5E59] hover:bg-slate-100 dark:hover:bg-[#102B2B] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t(lang, 'recapturePage')}</span>
                </button>
                <button
                  type="button"
                  onClick={onClearCapture}
                  aria-label={t(lang, 'clearCapture')}
                  className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-[#2A5E59] hover:bg-slate-100 dark:hover:bg-[#102B2B] transition-colors shrink-0"
                  title={t(lang, 'clearCapture')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Unsupported Page Banner */}
        {!urlStatus.supported && (
          <div className="mt-3 pt-3 border-t border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {urlStatus.reasonCode}: Extension Extraction Restricted
              </p>
              <p className="mt-0.5 opacity-90">{urlStatus.reasonMessage}</p>
            </div>
          </div>
        )}

        {/* Explicit Consent & Privacy Disclosure when uncaptured */}
        {urlStatus.supported && !capturedContext && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#255450] text-xs space-y-1.5">
            <p className="text-slate-600 dark:text-slate-300">
              {t(lang, 'consentDisclosure')}
            </p>
            <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0C8176] dark:text-[#8DE1D0] shrink-0" />
              <span>{t(lang, 'privacyGuarantee')}</span>
            </p>
          </div>
        )}

        {/* Truncation Notice */}
        {capturedContext?.wasTruncated && (
          <p className="mt-2.5 text-xs text-amber-700 dark:text-amber-300">
            {t(lang, 'truncationNotice')}
          </p>
        )}
      </div>

      {/* Quick Actions / Mode Selector */}
      <div
        role="tablist"
        aria-label="Assistant Quick Actions"
        className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl border ${
          isDark
            ? 'bg-[#102B2B] border-[#255450]'
            : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          role="tab"
          aria-selected={activeTool === 'summarize'}
          type="button"
          onClick={() => onSelectTool('summarize')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTool === 'summarize'
              ? 'bg-[#0C8176] text-white'
              : 'hover:text-[#0C8176] dark:hover:text-[#8DE1D0]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>{t(lang, 'quickSummarize')}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTool === 'qa'}
          type="button"
          onClick={() => onSelectTool('qa')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTool === 'qa'
              ? 'bg-[#0C8176] text-white'
              : 'hover:text-[#0C8176] dark:hover:text-[#8DE1D0]'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Contextual Q&amp;A</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTool === 'selection'}
          type="button"
          onClick={() => onSelectTool('selection')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTool === 'selection'
              ? 'bg-[#0C8176] text-white'
              : 'hover:text-[#0C8176] dark:hover:text-[#8DE1D0]'
          }`}
        >
          <Highlighter className="w-3.5 h-3.5 shrink-0" />
          <span>{t(lang, 'quickExplainSelection')}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTool === 'study'}
          type="button"
          onClick={() => onSelectTool('study')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTool === 'study'
              ? 'bg-[#0C8176] text-white'
              : 'hover:text-[#0C8176] dark:hover:text-[#8DE1D0]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>{t(lang, 'quickStudyMode')}</span>
        </button>
      </div>

      {/* TOOL 1: AI SUMMARY */}
      {activeTool === 'summarize' && (
        <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="summary-format-select"
              className="text-xs font-semibold"
            >
              Summary Format
            </label>
            <div className="flex items-center gap-2">
              <select
                id="summary-format-select"
                value={summaryFormat}
                onChange={(e) => setSummaryFormat(e.target.value as SummaryFormat)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${
                  isDark
                    ? 'bg-[#102B2B] border-[#255450] text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="short">{t(lang, 'summaryShort')}</option>
                <option value="detailed">{t(lang, 'summaryDetailed')}</option>
                <option value="takeaways">{t(lang, 'summaryTakeaways')}</option>
                <option value="step_by_step">{t(lang, 'summaryStepByStep')}</option>
                <option value="bn_summary">{t(lang, 'summaryBengali')}</option>
                <option value="en_summary">{t(lang, 'summaryEnglish')}</option>
              </select>

              <button
                type="button"
                disabled={!capturedContext || summaryLoading}
                onClick={() => runSummarize()}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white hover:bg-[#096960] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {summaryLoading ? 'Generating...' : t(lang, 'generateSummaryBtn')}
              </button>
            </div>
          </div>

          {!capturedContext && (
            <p className="text-xs text-slate-500 dark:text-slate-300 py-3">
              Approve webpage extraction above by clicking{' '}
              <strong>"{t(lang, 'useThisPage')}"</strong> before generating a
              source-grounded summary.
            </p>
          )}

          {summaryError && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
              <span>{summaryError}</span>
              <button
                type="button"
                onClick={() => runSummarize()}
                className="px-2.5 py-1 font-medium rounded border border-red-500/40 whitespace-nowrap shrink-0"
              >
                {t(lang, 'retryAction')}
              </button>
            </div>
          )}

          {summaryResult && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-[#255450]">
              {summaryResult.securityNotice && (
                <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
                  {summaryResult.securityNotice}
                </div>
              )}

              <div>
                <h3 className="text-base font-bold tracking-tight">
                  {summaryResult.summaryTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                  Provider: {summaryResult.usage.provider} · Model:{' '}
                  {summaryResult.usage.model} · {summaryResult.usage.inputTokens} in /{' '}
                  {summaryResult.usage.outputTokens} out tokens
                </p>
              </div>

              <div className="text-sm leading-relaxed whitespace-pre-line">
                {summaryResult.summary}
              </div>

              {/* Main Ideas */}
              {summaryResult.mainIdeas.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-[#8DE1D0] mb-1.5">
                    {t(lang, 'mainIdeasHeading')}
                  </h4>
                  <ul className="space-y-1.5 text-xs list-disc pl-4">
                    {summaryResult.mainIdeas.map((idea, i) => (
                      <li key={i}>{idea}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Takeaways */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-[#8DE1D0] mb-1.5">
                  {t(lang, 'keyTakeawaysHeading')}
                </h4>
                <ul className="space-y-1.5 text-xs list-disc pl-4">
                  {summaryResult.keyTakeaways.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Important Terms */}
              {summaryResult.importantTerms.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-[#8DE1D0] mb-1.5">
                    {t(lang, 'importantTermsHeading')}
                  </h4>
                  <dl className="space-y-1.5 text-xs">
                    {summaryResult.importantTerms.map((termObj, idx) => (
                      <div key={idx}>
                        <dt className="font-mono font-semibold inline">
                          {termObj.term}:{' '}
                        </dt>
                        <dd className="inline text-slate-600 dark:text-slate-300">
                          {termObj.definition}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Verified Source References */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-[#8DE1D0] mb-2">
                  {t(lang, 'sourceReferencesHeading')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {summaryResult.sourceReferences.map((ref) => (
                    <button
                      key={ref.blockId}
                      type="button"
                      onClick={() => onHighlightBlock(ref.blockId)}
                      className="px-2.5 py-1 text-xs font-mono rounded border border-[#0C8176]/50 hover:bg-[#0C8176] hover:text-white transition-colors whitespace-nowrap shrink-0"
                      title={ref.excerpt}
                    >
                      Cite [{ref.blockId}]
                      {ref.heading ? ` · ${ref.heading.slice(0, 26)}` : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Bar: Copy, Workspace Select, Save to Library, Retry */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#255450] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy('summary', summaryResult.summary)
                    }
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#255450] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {copiedId === 'summary' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedId === 'summary'
                        ? t(lang, 'copiedFeedback')
                        : t(lang, 'copyAction')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => runSummarize()}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#255450] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t(lang, 'retryAction')}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {workspaces.length > 0 && (
                    <select
                      aria-label="Target Workspace"
                      value={selectedWorkspaceId}
                      onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                        isDark
                          ? 'bg-[#102B2B] border-[#255450] text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleSaveContent(
                        'summary',
                        summaryResult.summary,
                        summaryResult.sourceReferences
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white hover:bg-[#096960] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {savedId === 'summary' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {savedId === 'summary'
                        ? t(lang, 'savedFeedback')
                        : t(lang, 'saveToLibrary')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOOL 2: CONTEXTUAL Q&A */}
      {activeTool === 'qa' && (
        <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Contextual Page Q&amp;A</h3>
            <span className="text-xs text-slate-500 dark:text-slate-300">
              {t(lang, 'askContextNotice')}
            </span>
          </div>

          {!capturedContext ? (
            <p className="text-xs text-slate-500 dark:text-slate-300 py-2">
              Click <strong>"{t(lang, 'useThisPage')}"</strong> above so WebPilot AI
              can ground answers in the page's extracted blocks.
            </p>
          ) : (
            <>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {chatHistory.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-300 space-y-2">
                    <p>
                      Ask any question about <strong>{capturedContext.pageTitle}</strong>.
                      Try one of these grounded prompts:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          runAsk(
                            'How does leader election prevent split votes?'
                          )
                        }
                        className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-[#255450] hover:border-[#0C8176] whitespace-nowrap shrink-0"
                      >
                        How does leader election prevent split votes?
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAsk('What is the boiling point of titanium?')
                        }
                        className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-[#255450] hover:border-[#0C8176] whitespace-nowrap shrink-0"
                      >
                        Test unsupported question (outside page)
                      </button>
                    </div>
                  </div>
                )}

                {chatHistory.map((turn) => (
                  <div
                    key={turn.id}
                    className={`p-3 rounded-lg border text-xs space-y-2 ${
                      turn.role === 'user'
                        ? isDark
                          ? 'bg-[#102B2B] border-[#255450]'
                          : 'bg-slate-50 border-slate-200'
                        : isDark
                        ? 'bg-[#0D2121] border-[#2A5E59]'
                        : 'bg-[#F6F8F7] border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">
                        {turn.role === 'user' ? 'You' : 'WebPilot AI'}
                      </span>
                      {turn.role === 'assistant' &&
                        turn.evidenceSufficient !== undefined && (
                          <span>
                            {turn.evidenceSufficient
                              ? t(lang, 'evidenceSufficientBadge')
                              : t(lang, 'evidenceInsufficientBadge')}
                          </span>
                        )}
                    </div>

                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {turn.content}
                    </p>

                    {turn.inferenceNote && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Note: {turn.inferenceNote}
                      </p>
                    )}

                    {turn.sourceReferences && turn.sourceReferences.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {turn.sourceReferences.map((ref) => (
                          <button
                            key={ref.blockId}
                            type="button"
                            onClick={() => onHighlightBlock(ref.blockId)}
                            className="px-2 py-0.5 text-xs font-mono rounded border border-[#0C8176]/50 hover:bg-[#0C8176] hover:text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            Cite [{ref.blockId}]
                          </button>
                        ))}
                      </div>
                    )}

                    {turn.role === 'assistant' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(turn.id, turn.content)}
                          className="text-xs underline hover:text-[#0C8176] whitespace-nowrap shrink-0"
                        >
                          {copiedId === turn.id
                            ? t(lang, 'copiedFeedback')
                            : t(lang, 'copyAction')}
                        </button>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveContent(
                              turn.id,
                              turn.content,
                              turn.sourceReferences || []
                            )
                          }
                          className="text-xs underline hover:text-[#0C8176] whitespace-nowrap shrink-0"
                        >
                          {savedId === turn.id
                            ? t(lang, 'savedFeedback')
                            : t(lang, 'saveToLibrary')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {qaError && (
                <div className="p-2.5 rounded border border-red-500/40 text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
                  <span>{qaError}</span>
                  {lastAskedQuestion && (
                    <button
                      type="button"
                      onClick={() => runAsk(lastAskedQuestion)}
                      className="underline whitespace-nowrap shrink-0"
                    >
                      {t(lang, 'retryAction')}
                    </button>
                  )}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAsk();
                }}
                className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#255450]"
              >
                <label htmlFor="qa-question-input" className="sr-only">
                  {t(lang, 'askPlaceholder')}
                </label>
                <textarea
                  id="qa-question-input"
                  rows={2}
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={t(lang, 'askPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      runAsk();
                    }
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-lg border ${
                    isDark
                      ? 'bg-[#102B2B] border-[#255450] text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Press Enter to send, Shift+Enter for new line
                  </span>
                  <button
                    type="submit"
                    disabled={qaLoading || !questionInput.trim()}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white hover:bg-[#096960] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{qaLoading ? 'Thinking...' : t(lang, 'askSendBtn')}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* TOOL 3: EXPLAIN SELECTED TEXT */}
      {activeTool === 'selection' && (
        <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
          <h3 className="text-sm font-bold">{t(lang, 'selectionHeading')}</h3>

          <div>
            <label
              htmlFor="selected-text-textarea"
              className="block text-xs font-medium mb-1 text-slate-500 dark:text-slate-300"
            >
              {t(lang, 'selectionInputLabel')}
            </label>
            <textarea
              id="selected-text-textarea"
              rows={3}
              value={selectedTextDraft}
              onChange={(e) => onChangeSelectedTextDraft(e.target.value)}
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                isDark
                  ? 'bg-[#102B2B] border-[#255450] text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              aria-label="Selection Explanation Operation"
              value={selectionOp}
              onChange={(e) => setSelectionOp(e.target.value as SelectionOperation)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${
                isDark
                  ? 'bg-[#102B2B] border-[#255450] text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="explain_simply">Explain simply</option>
              <option value="translate_bn">Translate into Bengali (বাংলা)</option>
              <option value="translate_en">Translate into English</option>
              <option value="give_example">Give an example</option>
              <option value="explain_code">Explain code</option>
              <option value="short_notes">Create short notes</option>
            </select>

            <button
              type="button"
              disabled={!selectedTextDraft.trim() || selectionLoading}
              onClick={runExplainSelection}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white hover:bg-[#096960] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {selectionLoading ? 'Analyzing...' : t(lang, 'selectionRunBtn')}
            </button>
          </div>

          {selectionError && (
            <p className="text-xs text-red-600 dark:text-red-300">{selectionError}</p>
          )}

          {selectionResult && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#255450] text-xs">
              {selectionResult.securityNotice && (
                <div className="p-2.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                  {selectionResult.securityNotice}
                </div>
              )}

              <div className="text-sm leading-relaxed whitespace-pre-line">
                {selectionResult.explanation}
              </div>

              {selectionResult.examples.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-500 dark:text-[#8DE1D0] mb-1">
                    Practical Examples
                  </h4>
                  <ul className="list-disc pl-4 space-y-1">
                    {selectionResult.examples.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectionResult.bulletNotes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-500 dark:text-[#8DE1D0] mb-1">
                    Revision Bullet Notes
                  </h4>
                  <ul className="list-disc pl-4 space-y-1">
                    {selectionResult.bulletNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TOOL 4: STUDY MODE (QUIZ, FLASHCARDS, NOTES) */}
      {activeTool === 'study' && (
        <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Source-Grounded Study Mode</h3>
            <button
              type="button"
              disabled={!capturedContext || quizLoading}
              onClick={runGenerateQuiz}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white hover:bg-[#096960] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {quizLoading ? 'Generating Quiz...' : t(lang, 'studyGenerateBtn')}
            </button>
          </div>

          {!capturedContext && (
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Capture the webpage first using <strong>"{t(lang, 'useThisPage')}"</strong>{' '}
              to generate a schema-validated 5-question quiz and flashcards.
            </p>
          )}

          {quizError && (
            <p className="text-xs text-red-600 dark:text-red-300">{quizError}</p>
          )}

          {quizResult && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-[#255450]">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#255450] pb-2">
                <button
                  type="button"
                  onClick={() => setStudySubTab('questions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                    studySubTab === 'questions'
                      ? 'bg-[#0C8176] text-white'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  {t(lang, 'studyQuestionsTab')} ({quizResult.questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudySubTab('flashcards')}
                  className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                    studySubTab === 'flashcards'
                      ? 'bg-[#0C8176] text-white'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  {t(lang, 'studyFlashcardsTab')} ({quizResult.flashcards.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudySubTab('notes')}
                  className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                    studySubTab === 'notes'
                      ? 'bg-[#0C8176] text-white'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  {t(lang, 'studyNotesTab')}
                </button>
              </div>

              {studySubTab === 'questions' && (
                <div className="space-y-4">
                  {quizResult.questions.map((q, qIdx) => {
                    const userPick = selectedAnswers[q.id];
                    const isAnswered = userPick !== undefined;

                    return (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-lg border border-slate-200 dark:border-[#255450] space-y-2.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">
                            {qIdx + 1}. {q.question}
                          </p>
                          {q.sourceBlockId && (
                            <button
                              type="button"
                              onClick={() => onHighlightBlock(q.sourceBlockId!)}
                              className="font-mono text-xs underline text-[#0C8176] dark:text-[#8DE1D0] whitespace-nowrap shrink-0"
                            >
                              [{q.sourceBlockId}]
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = userPick === optIdx;
                            const isCorrect = q.correctIndex === optIdx;
                            let btnStyle = isDark
                              ? 'border-[#255450] hover:bg-[#102B2B]'
                              : 'border-slate-200 hover:bg-slate-50';

                            if (isAnswered) {
                              if (isCorrect) {
                                btnStyle =
                                  'border-emerald-600 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-medium';
                              } else if (isSelected) {
                                btnStyle =
                                  'border-red-500 bg-red-500/15 text-red-900 dark:text-red-200';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: optIdx,
                                  }))
                                }
                                className={`w-full text-left px-3 py-2 rounded border transition-colors ${btnStyle}`}
                              >
                                <span className="font-mono mr-2">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {isAnswered && (
                          <div className="pt-2 border-t border-slate-200 dark:border-[#255450] text-xs space-y-1">
                            <p className="font-semibold">
                              {userPick === q.correctIndex
                                ? 'Correct — Verified against page context'
                                : `Incorrect — Correct option is ${String.fromCharCode(
                                    65 + q.correctIndex
                                  )}`}
                            </p>
                            <p className="text-slate-600 dark:text-slate-300">
                              {q.explanation}
                            </p>
                            {!q.supportedByPage && (
                              <p className="text-amber-600 dark:text-amber-300">
                                Note: This item requires domain inference beyond explicit page text.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {studySubTab === 'flashcards' && (
                <div className="grid grid-cols-1 gap-3">
                  {quizResult.flashcards.map((fc) => {
                    const isFlipped = Boolean(flippedCards[fc.id]);
                    return (
                      <button
                        key={fc.id}
                        type="button"
                        onClick={() =>
                          setFlippedCards((prev) => ({
                            ...prev,
                            [fc.id]: !prev[fc.id],
                          }))
                        }
                        className="p-4 text-left rounded-lg border border-slate-200 dark:border-[#255450] hover:border-[#0C8176] transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{isFlipped ? 'Answer / Back' : 'Prompt / Front'}</span>
                          <span>Click to flip</span>
                        </div>
                        <p className="text-sm font-medium">
                          {isFlipped ? fc.back : fc.front}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {studySubTab === 'notes' && (
                <ul className="space-y-2 text-xs list-disc pl-4">
                  {quizResult.revisionNotes.map((note, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
