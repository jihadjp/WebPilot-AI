import React, { useEffect, useState } from 'react';
import {
  Download,
  LogOut,
  Shield,
  Terminal,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { SupportedLanguage, ThemePreference } from '../shared/schemas';
import { t } from '../shared/i18n';
import {
  apiClient,
  setStoredSessionToken,
  UsageSummary,
  UserProfile,
} from '../services/apiClient';

interface SettingsPanelProps {
  lang: SupportedLanguage;
  onChangeLang: (lang: SupportedLanguage) => void;
  theme: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
  isDark: boolean;
  user: UserProfile | null;
  aiProviderInfo: { name: string; model: string };
  onAuthChanged: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  lang,
  onChangeLang,
  theme,
  onChangeTheme,
  isDark,
  user,
  aiProviderInfo,
  onAuthChanged,
}) => {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const loadUsage = async () => {
    try {
      const data = await apiClient.getUsage();
      setUsage(data);
    } catch {
      setUsage(null);
    }
  };

  useEffect(() => {
    if (user) {
      loadUsage();
    }
  }, [user]);

  const handleSwitchProfile = async (profile: 'primary' | 'secondary') => {
    try {
      const res = await apiClient.switchSession(profile);
      setStoredSessionToken(res.token);
      setStatusBanner(`Switched active session to ${res.user.email}`);
      onAuthChanged();
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Profile switch failed');
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      setStoredSessionToken('logged_out_invalid_token');
      setStatusBanner('Signed out and revoked session token.');
      onAuthChanged();
    } catch {
      setStoredSessionToken('logged_out_invalid_token');
      onAuthChanged();
    }
  };

  const handleExport = async () => {
    try {
      const bundle = await apiClient.exportData();
      setExportedJson(JSON.stringify(bundle, null, 2));
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleDeleteAllData = async () => {
    try {
      const res = await apiClient.deleteAllData();
      setStatusBanner(
        `Deleted ${res.deletedItems} saved items and ${res.deletedConversations} conversations.`
      );
      loadUsage();
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Data deletion failed');
    }
  };

  const surfaceClass = isDark
    ? 'bg-[#173735] border-[#255450] text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="space-y-4">
      {statusBanner && (
        <div className="p-3 rounded-xl border border-[#0C8176] bg-[#0C8176]/10 text-xs font-medium">
          {statusBanner}
        </div>
      )}

      {/* Language & Theme Preferences */}
      <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold">
            {t(lang, 'settingsLanguageLabel')}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeLang('en')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${
                lang === 'en'
                  ? 'bg-[#0C8176] text-white'
                  : 'border border-slate-300 dark:border-[#255450]'
              }`}
            >
              English (EN)
            </button>
            <button
              type="button"
              onClick={() => onChangeLang('bn')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${
                lang === 'bn'
                  ? 'bg-[#0C8176] text-white'
                  : 'border border-slate-300 dark:border-[#255450]'
              }`}
            >
              বাংলা (Bengali)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-[#255450]">
          <span className="text-xs font-semibold">
            {t(lang, 'settingsThemeLabel')}
          </span>
          <div className="flex items-center gap-1.5">
            {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeTheme(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize whitespace-nowrap shrink-0 ${
                  theme === mode
                    ? 'bg-[#0C8176] text-white'
                    : 'border border-slate-300 dark:border-[#255450]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Session & Ownership Isolation */}
      <div className={`p-4 rounded-xl border space-y-3 ${surfaceClass}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#0C8176]" />
            <span>{t(lang, 'settingsAccountHeading')}</span>
          </h3>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1 text-xs font-medium rounded border border-red-500/40 text-red-600 dark:text-red-400 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3 h-3" />
              <span>{t(lang, 'settingsSignOutBtn')}</span>
            </button>
          )}
        </div>

        {user ? (
          <div className="text-xs space-y-1">
            <p>
              <span className="text-slate-500 dark:text-slate-400">Signed in as: </span>
              <strong className="font-mono">{user.email}</strong> ({user.displayName})
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Plan: <span className="font-mono">{user.planIdentifier}</span> · User ID:{' '}
              <span className="font-mono">{user.id}</span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            Session signed out. Select an account profile below to authenticate.
          </p>
        )}

        <div className="pt-2 border-t border-slate-200 dark:border-[#255450] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSwitchProfile('primary')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#255450] hover:border-[#0C8176] whitespace-nowrap shrink-0"
          >
            Sign in: Primary Researcher
          </button>
          <button
            type="button"
            onClick={() => handleSwitchProfile('secondary')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#255450] hover:border-[#0C8176] whitespace-nowrap shrink-0"
          >
            Sign in: Secondary Reviewer (Isolation Test)
          </button>
        </div>
      </div>

      {/* AI Usage & Quota Accounting */}
      <div className={`p-4 rounded-xl border space-y-3 ${surfaceClass}`}>
        <h3 className="text-xs font-bold">{t(lang, 'settingsUsageHeading')}</h3>
        <div className="text-xs text-slate-500 dark:text-slate-300 font-mono tabular-nums">
          Active Server Provider: <strong>{aiProviderInfo.name}</strong> · Model:{' '}
          <strong>{aiProviderInfo.model}</strong>
        </div>

        {usage && (
          <div className="grid grid-cols-3 gap-2 pt-2 text-xs tabular-nums">
            <div className="p-2.5 rounded border border-slate-200 dark:border-[#255450]">
              <div className="text-slate-500 dark:text-slate-400">Daily Quota</div>
              <div className="text-sm font-bold font-mono mt-0.5">
                {usage.dailyRequestsUsed} / {usage.dailyQuotaLimit}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 dark:border-[#255450]">
              <div className="text-slate-500 dark:text-slate-400">Total Tokens</div>
              <div className="text-sm font-bold font-mono mt-0.5">
                {usage.totalInputTokens + usage.totalOutputTokens}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 dark:border-[#255450]">
              <div className="text-slate-500 dark:text-slate-400">Est. Cost</div>
              <div className="text-sm font-bold font-mono mt-0.5">
                ${usage.totalEstimatedCostUsd.toFixed(4)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Privacy & Data Deletion Controls */}
      <div className={`p-4 rounded-xl border space-y-3 ${surfaceClass}`}>
        <h3 className="text-xs font-bold flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#0C8176]" />
          <span>{t(lang, 'settingsPrivacyHeading')}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
          WebPilot AI processes webpage text only after explicit user consent. API keys
          remain strictly server-side. You can export or delete your stored account
          library and conversation history at any time.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#255450] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t(lang, 'settingsExportDataBtn')}</span>
          </button>
          <button
            type="button"
            onClick={handleDeleteAllData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/40 text-red-600 dark:text-red-400 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t(lang, 'settingsDeleteDataBtn')}</span>
          </button>
        </div>

        {exportedJson && (
          <pre className="p-3 rounded bg-slate-900 text-slate-100 text-xs font-mono max-h-40 overflow-y-auto">
            {exportedJson}
          </pre>
        )}
      </div>

      {/* Unpacked Chrome & Edge Extension Instructions */}
      <div className={`p-4 rounded-xl border space-y-2 ${surfaceClass}`}>
        <h3 className="text-xs font-bold flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-[#0C8176]" />
          <span>{t(lang, 'settingsExtensionGuideHeading')}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
          Run <code className="font-mono">npm run package:extension</code> to bundle
          the Manifest V3 service worker (<code className="font-mono">background.js</code>),
          on-demand content script (<code className="font-mono">content.js</code>), and
          Side Panel UI into <code className="font-mono">dist-extension/</code>. Load via{' '}
          <code className="font-mono">chrome://extensions</code> or{' '}
          <code className="font-mono">edge://extensions</code> with Developer Mode enabled.
        </p>
      </div>
    </div>
  );
};
