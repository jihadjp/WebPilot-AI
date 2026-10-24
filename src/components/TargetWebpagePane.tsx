import React, { useState } from 'react';
import { Globe, FileText, Code, Highlighter } from 'lucide-react';
import { SAMPLE_WEB_PAGES, SimulatedWebPage } from '../shared/samplePages';
import { ExtractedBlock, PageContextPayload } from '../shared/schemas';

interface TargetWebpagePaneProps {
  activePage: SimulatedWebPage;
  onSelectSamplePage: (page: SimulatedWebPage) => void;
  onUpdateCustomPage: (url: string, title: string, html: string) => void;
  capturedContext: PageContextPayload | null;
  highlightedBlockId: string | null;
  onSelectHighlightedBlock: (blockId: string | null) => void;
  onSendSelectionToExplain: (selectedText: string) => void;
  isDark: boolean;
}

export const TargetWebpagePane: React.FC<TargetWebpagePaneProps> = ({
  activePage,
  onSelectSamplePage,
  onUpdateCustomPage,
  capturedContext,
  highlightedBlockId,
  onSelectHighlightedBlock,
  onSendSelectionToExplain,
  isDark,
}) => {
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState(activePage.url);
  const [customTitle, setCustomTitle] = useState(activePage.title);
  const [customHtml, setCustomHtml] = useState(activePage.html);
  const [selectedSnippet, setSelectedSnippet] = useState(activePage.sampleSelection);

  const handleMouseUp = () => {
    const sel = window.getSelection()?.toString()?.trim();
    if (sel && sel.length >= 3) {
      setSelectedSnippet(sel.slice(0, 1200));
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customTitle.trim()) return;
    onUpdateCustomPage(customUrl.trim(), customTitle.trim(), customHtml);
    setCustomEditorOpen(false);
  };

  return (
    <section
      aria-label="Target Browser Tab Viewport"
      className={`flex flex-col h-full border-r ${
        isDark
          ? 'bg-[#0D2121] border-[#1E4441] text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Simulated Browser Address & Tab Selector Bar */}
      <div
        className={`px-5 py-3.5 border-b ${
          isDark ? 'bg-[#102B2B] border-[#1E4441]' : 'bg-[#F6F8F7] border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Globe className="w-3.5 h-3.5 text-[#0C8176]" />
            <span>Active Browser Tab Context</span>
            <span aria-hidden="true">·</span>
            <span>{activePage.category}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{activePage.readTime}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setCustomUrl(activePage.url);
              setCustomTitle(activePage.title);
              setCustomHtml(activePage.html);
              setCustomEditorOpen(!customEditorOpen);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
              isDark
                ? 'border-[#255450] text-[#8DE1D0] hover:bg-[#173735]'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {customEditorOpen ? 'Close Custom URL Editor' : 'Load Custom URL / HTML'}
          </button>
        </div>

        {/* Sample Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Sample Webpages">
          {SAMPLE_WEB_PAGES.map((page) => {
            const isActive = activePage.id === page.id;
            return (
              <button
                key={page.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => {
                  onSelectSamplePage(page);
                  setSelectedSnippet(page.sampleSelection);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#0C8176] text-white'
                    : isDark
                    ? 'bg-[#173735] text-slate-300 hover:text-white'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {page.id === 'raft-consensus' && '01. Raft Consensus Spec'}
                {page.id === 'postgres-mvcc' && '02. PostgreSQL MVCC Docs'}
                {page.id === 'adversarial-injection-test' && '03. Prompt-Injection Test'}
                {page.id === 'restricted-chrome-internal' && '04. Restricted chrome:// URL'}
              </button>
            );
          })}
        </div>

        {/* Address Bar Display */}
        <div
          className={`mt-2.5 flex items-center gap-2 px-3 py-1.5 rounded border font-mono text-xs ${
            isDark
              ? 'bg-[#091818] border-[#1E4441] text-slate-300'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-[#0C8176] shrink-0" />
          <span className="truncate" data-testid="active-tab-url">
            {activePage.url}
          </span>
        </div>
      </div>

      {/* Optional Custom URL / HTML Form */}
      {customEditorOpen && (
        <form
          onSubmit={handleApplyCustom}
          className={`p-4 border-b space-y-3 ${
            isDark ? 'bg-[#13302E] border-[#1E4441]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="custom-page-url"
                className="block text-xs font-medium mb-1"
              >
                Page URL
              </label>
              <input
                id="custom-page-url"
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs rounded border font-mono ${
                  isDark
                    ? 'bg-[#091818] border-[#255450] text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
                required
              />
            </div>
            <div>
              <label
                htmlFor="custom-page-title"
                className="block text-xs font-medium mb-1"
              >
                Page Title
              </label>
              <input
                id="custom-page-title"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs rounded border ${
                  isDark
                    ? 'bg-[#091818] border-[#255450] text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="custom-page-html"
              className="block text-xs font-medium mb-1"
            >
              Article HTML Content
            </label>
            <textarea
              id="custom-page-html"
              rows={4}
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded border font-mono ${
                isDark
                  ? 'bg-[#091818] border-[#255450] text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCustomEditorOpen(false)}
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-[#255450] whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium rounded bg-[#0C8176] text-white hover:bg-[#096960] whitespace-nowrap shrink-0"
            >
              Apply Custom Webpage
            </button>
          </div>
        </form>
      )}

      {/* Selected Text Quick Action Bar */}
      {selectedSnippet && (
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-[#173735]/80 border-[#1E4441]'
              : 'bg-[#8DE1D0]/20 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <Highlighter className="w-3.5 h-3.5 text-[#0C8176] shrink-0" />
            <span className="font-medium shrink-0">Active Selection:</span>
            <span className="truncate font-mono opacity-85">
              "{selectedSnippet}"
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSendSelectionToExplain(selectedSnippet)}
            className="px-3 py-1 text-xs font-medium rounded bg-[#0C8176] text-white hover:bg-[#096960] transition-colors whitespace-nowrap shrink-0"
          >
            Explain Selection in Side Panel
          </button>
        </div>
      )}

      {/* Article Body & Captured Source Blocks View */}
      <div
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto p-6 space-y-6"
      >
        {capturedContext ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-[#1E4441]">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {capturedContext.pageTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {capturedContext.hostname} · {capturedContext.blocks.length} extracted source blocks ·{' '}
                  {capturedContext.totalCharacters} characters
                </p>
              </div>
              {highlightedBlockId && (
                <button
                  type="button"
                  onClick={() => onSelectHighlightedBlock(null)}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-[#255450] whitespace-nowrap shrink-0"
                >
                  Clear Highlight ({highlightedBlockId})
                </button>
              )}
            </div>

            <div className="space-y-3">
              {capturedContext.blocks.map((block: ExtractedBlock) => {
                const isHighlighted = highlightedBlockId === block.id;
                const isHeading =
                  block.tag === 'h1' || block.tag === 'h2' || block.tag === 'h3';
                const isCode = block.tag === 'pre';

                return (
                  <div
                    key={block.id}
                    id={`webpage-block-${block.id}`}
                    onClick={() => onSelectHighlightedBlock(block.id)}
                    className={`p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      isHighlighted
                        ? isDark
                          ? 'bg-[#173735] border-[#8DE1D0] ring-1 ring-[#8DE1D0]'
                          : 'bg-[#8DE1D0]/25 border-[#0C8176] ring-1 ring-[#0C8176]'
                        : isDark
                        ? 'bg-[#102B2B]/60 border-[#1E4441] hover:border-[#2A5C57]'
                        : 'bg-[#F6F8F7]/70 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-[#0C8176] dark:text-[#8DE1D0] tabular-nums">
                        [{block.id}] · &lt;{block.tag}&gt;
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSnippet(block.text);
                          onSendSelectionToExplain(block.text);
                        }}
                        className="text-xs underline hover:text-[#0C8176] whitespace-nowrap shrink-0"
                      >
                        Send block to Explain
                      </button>
                    </div>

                    {isCode ? (
                      <pre className="text-xs font-mono overflow-x-auto p-2.5 rounded bg-slate-900 text-slate-100">
                        {block.text}
                      </pre>
                    ) : (
                      <p
                        className={
                          isHeading
                            ? 'text-base font-semibold tracking-tight'
                            : 'text-sm leading-relaxed'
                        }
                      >
                        {block.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg border text-xs ${
                isDark
                  ? 'bg-[#102B2B] border-[#1E4441] text-slate-300'
                  : 'bg-[#F6F8F7] border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white mb-1">
                <Code className="w-4 h-4 text-[#0C8176]" />
                <span>Unextracted Webpage Preview (Zero Automatic Collection)</span>
              </div>
              <p>
                WebPilot AI has not extracted this webpage yet. Click{' '}
                <strong>"Use this page"</strong> inside the Side Panel on the right to
                approve content extraction and map source blocks (S1, S2, ...). You can
                also highlight any sentence below to test selected-text explanation.
              </p>
            </div>

            <div
              className="article-preview max-w-none space-y-3 leading-relaxed overflow-x-hidden"
              dangerouslySetInnerHTML={{ __html: activePage.html }}
            />
          </div>
        )}
      </div>
    </section>
  );
};
