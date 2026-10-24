import {
  AskRequest,
  AskResponse,
  CreateLibraryItemRequest,
  ExplainSelectionRequest,
  ExplainSelectionResponse,
  GenerateQuizRequest,
  GenerateQuizResponse,
  SourceReference,
  SummarizeRequest,
  SummarizeResponse,
  SupportedLanguage,
  UpdateLibraryItemRequest,
} from '../shared/schemas';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  preferredLanguage: SupportedLanguage;
  planIdentifier: 'free_researcher' | 'pro_scholar';
}

export interface WorkspaceItem {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
}

export interface SavedLibraryItem {
  id: string;
  ownerUserId: string;
  workspaceId: string | null;
  pageUrl: string;
  pageTitle: string;
  hostname: string;
  summary: string;
  personalNotes: string;
  contentHash: string | null;
  sourceReferences: SourceReference[];
  createdAt: string;
  updatedAt: string;
}

export interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number;
  dailyQuotaLimit: number;
  dailyRequestsUsed: number;
  recentEvents: Array<{
    id: string;
    operation: string;
    modelIdentifier: string;
    inputTokenCount: number;
    outputTokenCount: number;
    estimatedCost: number;
    requestStatus: string;
    createdAt: string;
  }>;
}

const TOKEN_STORAGE_KEY = 'webpilot_session_token';

export function getStoredSessionToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || 'wp_sess_primary_default';
  } catch {
    return 'wp_sess_primary_default';
  }
}

export function setStoredSessionToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage quota errors
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMessage =
      data?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errMessage) as Error & {
      status?: number;
      code?: string;
    };
    err.status = response.status;
    err.code = data?.error?.code;
    throw err;
  }

  return data as T;
}

export const apiClient = {
  getMe() {
    return requestJson<{
      user: UserProfile;
      workspaces: WorkspaceItem[];
      aiProvider: { name: string; model: string };
    }>('/me');
  },

  updateMe(payload: { preferredLanguage?: SupportedLanguage; displayName?: string }) {
    return requestJson<{ user: UserProfile }>('/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getUsage() {
    return requestJson<UsageSummary>('/me/usage');
  },

  exportData() {
    return requestJson<Record<string, unknown>>('/me/export');
  },

  deleteAllData() {
    return requestJson<{
      status: string;
      deletedItems: number;
      deletedConversations: number;
    }>('/me/data', {
      method: 'DELETE',
    });
  },

  switchSession(profile: 'primary' | 'secondary') {
    return requestJson<{
      token: string;
      expiresAt: string;
      user: UserProfile;
    }>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ profile }),
    });
  },

  logout() {
    return requestJson<{ status: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  createWorkspace(name: string) {
    return requestJson<{ workspace: WorkspaceItem }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  summarize(payload: SummarizeRequest) {
    return requestJson<SummarizeResponse>('/ai/summarize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  ask(payload: AskRequest) {
    return requestJson<AskResponse>('/ai/ask', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  explainSelection(payload: ExplainSelectionRequest) {
    return requestJson<ExplainSelectionResponse>('/ai/explain-selection', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateQuiz(payload: GenerateQuizRequest) {
    return requestJson<GenerateQuizResponse>('/ai/generate-quiz', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getLibrary(params?: { search?: string; workspaceId?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.workspaceId && params.workspaceId !== 'all') {
      query.set('workspaceId', params.workspaceId);
    }
    const qs = query.toString();
    return requestJson<{ items: SavedLibraryItem[]; total: number }>(
      `/library${qs ? `?${qs}` : ''}`
    );
  },

  saveLibraryItem(payload: CreateLibraryItemRequest) {
    return requestJson<{ item: SavedLibraryItem }>('/library', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateLibraryItem(id: string, payload: UpdateLibraryItemRequest) {
    return requestJson<{ item: SavedLibraryItem }>(`/library/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteLibraryItem(id: string) {
    return requestJson<{ status: string; id: string }>(`/library/${id}`, {
      method: 'DELETE',
    });
  },
};
