import { useEffect, useState } from 'react';
import {
  PageContextPayload,
  SupportedLanguage,
  ThemePreference,
} from './shared/schemas';
import { buildPageContextFromHtml, validatePageUrl } from './shared/extractor';
import { SAMPLE_WEB_PAGES, SimulatedWebPage } from './shared/samplePages';
import { t } from './shared/i18n';
import { apiClient, UserProfile, WorkspaceItem } from './services/apiClient';
import { TargetWebpagePane } from './components/TargetWebpagePane';
import { AssistantPanel, AssistantToolMode } from './components/AssistantPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { SettingsPanel } from './components/SettingsPanel';

type MainTab = 'assistant' | 'library' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('assistant');
  const [lang, setLang] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem('webpilot_lang');
      return saved === 'bn' ? 'bn' : 'en';
    } catch {
      return 'en';
    }
  });
  const [theme, setTheme] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('webpilot_theme');
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
      return 'light';
    } catch {
      return 'light';
    }
  });

  const [activePage, setActivePage] = useState<SimulatedWebPage>(SAMPLE_WEB_PAGES[0]);
  const [capturedContext, setCapturedContext] = useState<PageContextPayload | null>(
    null
  );
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AssistantToolMode>('summarize');
  const [selectedTextDraft, setSelectedTextDraft] = useState<string>(
    SAMPLE_WEB_PAGES[0].sampleSelection
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [aiProviderInfo, setAiProviderInfo] = useState<{
    name: string;
    model: string;
  }>({
    name: 'deterministic-grounded',
    model: 'webpilot-extractive-v1',
  });
  const [libraryRefreshCounter, setLibraryRefreshCounter] = useState(0);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const fetchAccountState = async () => {
    try {
      const data = await apiClient.getMe();
      setUser(data.user);
      setWorkspaces(data.workspaces);
      setAiProviderInfo(data.aiProvider);
    } catch {
      setUser(null);
      setWorkspaces([]);
    }
  };

  useEffect(() => {
    fetchAccountState();
  }, []);

  const handleChangeLang = (nextLang: SupportedLanguage) => {
    setLang(nextLang);
    try {
      localStorage.setItem('webpilot_lang', nextLang);
    } catch {
      // Ignore
    }
    apiClient.updateMe({ preferredLanguage: nextLang }).catch(() => {});
  };

  const handleChangeTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    try {
      localStorage.setItem('webpilot_theme', nextTheme);
    } catch {
      // Ignore
    }
  };

  const urlStatus = validatePageUrl(activePage.url);

  const handleCapturePage = () => {
    if (!urlStatus.supported) return;
    try {
      const ctx = buildPageContextFromHtml({
        pageUrl: activePage.url,
        pageTitle: activePage.title,
        html: activePage.html,
      });
      setCapturedContext(ctx);
      setHighlightedBlockId(null);
    } catch {
      setCapturedContext(null);
    }
  };

  const handleSelectSamplePage = (page: SimulatedWebPage) => {
    setActivePage(page);
    // Reset capture state when navigating to a new page so consent is always explicit per page
    setCapturedContext(null);
    setHighlightedBlockId(null);
    setSelectedTextDraft(page.sampleSelection);
  };

  const handleUpdateCustomPage = (url: string, title: string, html: string) => {
    setActivePage({
      id: 'custom-user-page',
      url,
      title,
      category: 'Custom Webpage',
      readTime: 'Live DOM',
      sampleSelection: '',
      html,
    });
    setCapturedContext(null);
    setHighlightedBlockId(null);
  };

  const handleSendSelectionToExplain = (text: string) => {
    setSelectedTextDraft(text);
    setActiveTab('assistant');
    setActiveTool('selection');
  };

  const handleHighlightBlock = (blockId: string) => {
    setHighlightedBlockId(blockId);
    const el = document.getElementById(`webpage-block-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDark ? 'dark bg-[#102B2B] text-slate-100' : 'bg-[#F6F8F7] text-slate-900'
      }`}
    >
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header
        className={`flex items-center justify-between gap-8 px-6 py-3.5 border-b ${
          isDark ? 'bg-[#102B2B] border-[#1E4441]' : 'bg-white border-slate-200'
        }`}
      >
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('assistant');
          }}
          className="text-lg font-bold tracking-tight font-display text-[#0C8176] dark:text-[#8DE1D0] whitespace-nowrap shrink-0"
        >
          WebPilot AI
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Main Navigation"
          className="flex items-center gap-6 text-sm font-medium"
        >
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'assistant'
                ? 'text-[#0C8176] dark:text-[#8DE1D0] underline underline-offset-8 decoration-2'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(lang, 'navAssistant')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'library'
                ? 'text-[#0C8176] dark:text-[#8DE1D0] underline underline-offset-8 decoration-2'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(lang, 'navLibrary')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'settings'
                ? 'text-[#0C8176] dark:text-[#8DE1D0] underline underline-offset-8 decoration-2'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(lang, 'navSettings')}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              setActiveTab(activeTab === 'library' ? 'assistant' : 'library')
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0C8176] rounded-lg hover:bg-[#096960] transition-colors whitespace-nowrap shrink-0"
          >
            {activeTab === 'library' ? t(lang, 'navAssistant') : t(lang, 'navLibrary')}
          </button>
        </div>
      </header>

      {/* Main Split Viewport: Target Webpage on Left + WebPilot AI Side Panel on Right */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Column: Active Browser Tab Viewport (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col min-h-[420px] lg:h-[calc(100vh-57px)]">
          <TargetWebpagePane
            activePage={activePage}
            onSelectSamplePage={handleSelectSamplePage}
            onUpdateCustomPage={handleUpdateCustomPage}
            capturedContext={capturedContext}
            highlightedBlockId={highlightedBlockId}
            onSelectHighlightedBlock={setHighlightedBlockId}
            onSendSelectionToExplain={handleSendSelectionToExplain}
            isDark={isDark}
          />
        </div>

        {/* Right Column: WebPilot AI Chrome/Edge Side Panel (5 cols on desktop) */}
        <aside
          aria-label="WebPilot AI Side Panel"
          className={`lg:col-span-5 flex flex-col lg:h-[calc(100vh-57px)] overflow-y-auto p-5 ${
            isDark ? 'bg-[#102B2B]' : 'bg-[#F6F8F7]'
          }`}
        >
          {activeTab === 'assistant' && (
            <AssistantPanel
              lang={lang}
              isDark={isDark}
              pageTitle={activePage.title}
              pageUrl={activePage.url}
              urlStatus={urlStatus}
              capturedContext={capturedContext}
              onCapturePage={handleCapturePage}
              onClearCapture={() => {
                setCapturedContext(null);
                setHighlightedBlockId(null);
              }}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              selectedTextDraft={selectedTextDraft}
              onChangeSelectedTextDraft={setSelectedTextDraft}
              onHighlightBlock={handleHighlightBlock}
              workspaces={workspaces}
              onSavedToLibrary={() => setLibraryRefreshCounter((c) => c + 1)}
            />
          )}

          {activeTab === 'library' && (
            <LibraryPanel
              lang={lang}
              isDark={isDark}
              workspaces={workspaces}
              onWorkspacesUpdated={fetchAccountState}
              refreshTrigger={libraryRefreshCounter}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              lang={lang}
              onChangeLang={handleChangeLang}
              theme={theme}
              onChangeTheme={handleChangeTheme}
              isDark={isDark}
              user={user}
              aiProviderInfo={aiProviderInfo}
              onAuthChanged={() => {
                fetchAccountState();
                setLibraryRefreshCounter((c) => c + 1);
              }}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
