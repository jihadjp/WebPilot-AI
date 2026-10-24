import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { SupportedLanguage } from '../shared/schemas';
import { t } from '../shared/i18n';
import {
  apiClient,
  SavedLibraryItem,
  WorkspaceItem,
} from '../services/apiClient';

interface LibraryPanelProps {
  lang: SupportedLanguage;
  isDark: boolean;
  workspaces: WorkspaceItem[];
  onWorkspacesUpdated: () => void;
  refreshTrigger: number;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  lang,
  isDark,
  workspaces,
  onWorkspacesUpdated,
  refreshTrigger,
}) => {
  const [items, setItems] = useState<SavedLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWorkspace, setActiveWorkspace] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getLibrary({
        search: searchQuery,
        workspaceId: activeWorkspace,
      });
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [searchQuery, activeWorkspace, refreshTrigger]);

  const handleSaveNotes = async (id: string) => {
    try {
      await apiClient.updateLibraryItem(id, { personalNotes: notesDraft });
      setEditingId(null);
      fetchItems();
    } catch {
      // Ignore error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteLibraryItem(id);
      setConfirmDeleteId(null);
      fetchItems();
    } catch {
      // Ignore error
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await apiClient.createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setCreatingWorkspace(false);
      onWorkspacesUpdated();
    } catch {
      // Ignore
    }
  };

  const surfaceClass = isDark
    ? 'bg-[#173735] border-[#255450] text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="space-y-4">
      {/* Search & Workspace Filter Bar */}
      <div className={`p-4 rounded-xl border space-y-3 ${surfaceClass}`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label={t(lang, 'librarySearchPlaceholder')}
              placeholder={t(lang, 'librarySearchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border ${
                isDark
                  ? 'bg-[#102B2B] border-[#255450] text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={() => setCreatingWorkspace(!creatingWorkspace)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#255450] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Workspace</span>
          </button>
        </div>

        {creatingWorkspace && (
          <form onSubmit={handleCreateWorkspace} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Workspace name (e.g. Thesis Research)"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border ${
                isDark
                  ? 'bg-[#102B2B] border-[#255450] text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
              required
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0C8176] text-white whitespace-nowrap shrink-0"
            >
              Create
            </button>
          </form>
        )}

        {/* Workspace Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveWorkspace('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeWorkspace === 'all'
                ? 'bg-[#0C8176] text-white'
                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            {t(lang, 'libraryAllWorkspaces')}
          </button>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => setActiveWorkspace(ws.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeWorkspace === ws.id
                  ? 'bg-[#0C8176] text-white'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      </div>

      {/* Saved Items List */}
      {loading ? (
        <div className={`p-6 rounded-xl border text-xs ${surfaceClass}`}>
          Loading saved research items...
        </div>
      ) : items.length === 0 ? (
        <div className={`p-6 rounded-xl border text-center space-y-1.5 ${surfaceClass}`}>
          <h3 className="text-sm font-bold">{t(lang, 'libraryEmptyTitle')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-300 max-w-md mx-auto">
            {t(lang, 'libraryEmptyBody')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const isConfirmingDelete = confirmDeleteId === item.id;

            return (
              <article
                key={item.id}
                className={`p-4 rounded-xl border space-y-3 ${surfaceClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold tracking-tight">
                      {item.pageTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-mono">{item.hostname}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={item.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${t(lang, 'libraryOpenOriginal')} ${item.pageTitle}`}
                      className="p-1.5 rounded border border-slate-300 dark:border-[#255450] hover:border-[#0C8176]"
                      title={t(lang, 'libraryOpenOriginal')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      aria-label={`${t(lang, 'libraryEditNotes')} ${item.pageTitle}`}
                      onClick={() => {
                        setEditingId(item.id);
                        setNotesDraft(item.personalNotes);
                      }}
                      className="p-1.5 rounded border border-slate-300 dark:border-[#255450] hover:border-[#0C8176]"
                      title={t(lang, 'libraryEditNotes')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!isConfirmingDelete ? (
                      <button
                        type="button"
                        aria-label={`Delete ${item.pageTitle}`}
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 rounded border border-slate-300 dark:border-[#255450] hover:border-red-500 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 text-white whitespace-nowrap shrink-0"
                      >
                        {t(lang, 'libraryDeleteConfirm')}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs leading-relaxed whitespace-pre-line">
                  {item.summary}
                </p>

                {isEditing ? (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#255450]">
                    <label
                      htmlFor={`notes-${item.id}`}
                      className="block text-xs font-medium"
                    >
                      Personal Research Notes
                    </label>
                    <textarea
                      id={`notes-${item.id}`}
                      rows={2}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      className={`w-full px-3 py-1.5 text-xs rounded border ${
                        isDark
                          ? 'bg-[#102B2B] border-[#255450] text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-[#255450] whitespace-nowrap shrink-0"
                      >
                        {t(lang, 'cancelAction')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveNotes(item.id)}
                        className="px-3 py-1 text-xs font-semibold rounded bg-[#0C8176] text-white whitespace-nowrap shrink-0"
                      >
                        {t(lang, 'librarySaveNotes')}
                      </button>
                    </div>
                  </div>
                ) : (
                  item.personalNotes && (
                    <div className="pt-2 border-t border-slate-200 dark:border-[#255450] text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">Personal Note: </span>
                      {item.personalNotes}
                    </div>
                  )
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
