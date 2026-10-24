import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CreateLibraryItemRequest,
  SourceReference,
  SupportedLanguage,
  UpdateLibraryItemRequest,
} from '../shared/schemas';

export interface UserEntity {
  id: string;
  email: string;
  displayName: string;
  preferredLanguage: SupportedLanguage;
  planIdentifier: 'free_researcher' | 'pro_scholar';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceEntity {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedItemEntity {
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

export interface ConversationEntity {
  id: string;
  ownerUserId: string;
  workspaceId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageEntity {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sourceReferences: SourceReference[];
  createdAt: string;
}

export interface UsageEventEntity {
  id: string;
  ownerUserId: string;
  operation: 'summarize' | 'ask' | 'explain_selection' | 'generate_quiz';
  modelIdentifier: string;
  inputTokenCount: number;
  outputTokenCount: number;
  estimatedCost: number;
  requestStatus: 'succeeded' | 'failed' | 'rate_limited';
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: string;
}

interface DatabaseState {
  users: UserEntity[];
  workspaces: WorkspaceEntity[];
  savedItems: SavedItemEntity[];
  conversations: ConversationEntity[];
  messages: MessageEntity[];
  usageEvents: UsageEventEntity[];
  sessions: SessionRecord[];
}

export class WebPilotRepository {
  private filePath: string;
  private state: DatabaseState;

  constructor(customFilePath?: string) {
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = customFilePath || path.join(dataDir, 'webpilot_store.json');
    this.state = this.loadOrSeed();
  }

  private loadOrSeed(): DatabaseState {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw) as DatabaseState;
      } catch {
        // Re-initialize if corrupted
      }
    }

    const now = new Date().toISOString();
    const initial: DatabaseState = {
      users: [
        {
          id: 'usr_primary_researcher',
          email: 'researcher@webpilot.local',
          displayName: 'Primary Researcher (Dev Profile)',
          preferredLanguage: 'en',
          planIdentifier: 'pro_scholar',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'usr_secondary_reviewer',
          email: 'reviewer@webpilot.local',
          displayName: 'Secondary Reviewer (Isolation Test Profile)',
          preferredLanguage: 'bn',
          planIdentifier: 'free_researcher',
          createdAt: now,
          updatedAt: now,
        },
      ],
      workspaces: [
        {
          id: 'ws_systems_engineering',
          ownerUserId: 'usr_primary_researcher',
          name: 'Distributed Systems & DBs',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ws_security_audits',
          ownerUserId: 'usr_primary_researcher',
          name: 'Security & Cryptography',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ws_reviewer_private',
          ownerUserId: 'usr_secondary_reviewer',
          name: 'Reviewer Private Workspace',
          createdAt: now,
          updatedAt: now,
        },
      ],
      savedItems: [
        {
          id: 'item_seed_raft_1',
          ownerUserId: 'usr_primary_researcher',
          workspaceId: 'ws_systems_engineering',
          pageUrl: 'https://systems.stanford.edu/papers/raft-consensus-protocol',
          pageTitle: 'Raft Consensus Algorithm: Leader Election, Log Replication & Safety Invariants',
          hostname: 'systems.stanford.edu',
          summary:
            'Raft decomposes distributed state-machine consensus into Leader Election, Log Replication, and Safety. Randomized election timeouts (150ms–300ms) prevent split votes, while majority quorums guarantee Leader Completeness across terms.',
          personalNotes:
            'Compare Raft Leader Completeness invariant with Multi-Paxos phase-1a quorum intersection.',
          contentHash: 'wp_seed_raft_01',
          sourceReferences: [
            {
              blockId: 'S2',
              heading: '1. Server States and Terms',
              excerpt:
                'At any given time, each server in a Raft cluster is in one of three states: Leader, Follower, or Candidate.',
              relevanceReason: 'Defines core Raft server state machine',
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
      conversations: [],
      messages: [],
      usageEvents: [],
      sessions: [
        {
          token: 'wp_sess_primary_default',
          userId: 'usr_primary_researcher',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
        {
          token: 'wp_sess_secondary_default',
          userId: 'usr_secondary_reviewer',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
      ],
    };

    this.persist(initial);
    return initial;
  }

  private persist(nextState: DatabaseState = this.state): void {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(nextState, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  public getUserBySessionToken(token: string | undefined): UserEntity | null {
    if (!token) return null;
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    const session = this.state.sessions.find((s) => s.token === clean);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }
    return this.state.users.find((u) => u.id === session.userId) || null;
  }

  public createSessionForUser(userId: string): SessionRecord {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found');
    }
    const record: SessionRecord = {
      token: `wp_sess_${crypto.randomBytes(16).toString('hex')}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    };
    this.state.sessions.push(record);
    this.persist();
    return record;
  }

  public revokeSession(token: string): boolean {
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    const before = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter((s) => s.token !== clean);
    this.persist();
    return this.state.sessions.length < before;
  }

  public updateUserPreferences(
    userId: string,
    updates: { preferredLanguage?: SupportedLanguage; displayName?: string }
  ): UserEntity {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    if (updates.preferredLanguage) user.preferredLanguage = updates.preferredLanguage;
    if (updates.displayName) user.displayName = updates.displayName.trim();
    user.updatedAt = new Date().toISOString();
    this.persist();
    return user;
  }

  public listWorkspaces(ownerUserId: string): WorkspaceEntity[] {
    return this.state.workspaces.filter((w) => w.ownerUserId === ownerUserId);
  }

  public createWorkspace(ownerUserId: string, name: string): WorkspaceEntity {
    const now = new Date().toISOString();
    const ws: WorkspaceEntity = {
      id: `ws_${crypto.randomBytes(6).toString('hex')}`,
      ownerUserId,
      name: name.trim().slice(0, 80),
      createdAt: now,
      updatedAt: now,
    };
    this.state.workspaces.push(ws);
    this.persist();
    return ws;
  }

  /**
   * Lists saved library items strictly owned by `ownerUserId`.
   */
  public listSavedItems(params: {
    ownerUserId: string;
    search?: string;
    workspaceId?: string;
    limit?: number;
    offset?: number;
  }): { items: SavedItemEntity[]; total: number } {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);
    const q = params.search?.trim().toLowerCase();

    const filtered = this.state.savedItems
      .filter((item) => item.ownerUserId === params.ownerUserId)
      .filter((item) => {
        if (params.workspaceId && params.workspaceId !== 'all') {
          return item.workspaceId === params.workspaceId;
        }
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return (
          item.pageTitle.toLowerCase().includes(q) ||
          item.hostname.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.personalNotes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  public createSavedItem(
    ownerUserId: string,
    payload: CreateLibraryItemRequest
  ): SavedItemEntity {
    if (payload.workspaceId) {
      const ws = this.state.workspaces.find(
        (w) => w.id === payload.workspaceId && w.ownerUserId === ownerUserId
      );
      if (!ws) {
        throw new Error('FORBIDDEN_WORKSPACE');
      }
    }

    const now = new Date().toISOString();
    const entity: SavedItemEntity = {
      id: `item_${crypto.randomBytes(8).toString('hex')}`,
      ownerUserId,
      workspaceId: payload.workspaceId ?? null,
      pageUrl: payload.pageUrl,
      pageTitle: payload.pageTitle,
      hostname: payload.hostname,
      summary: payload.summary,
      personalNotes: payload.personalNotes ?? '',
      contentHash: payload.contentHash ?? null,
      sourceReferences: payload.sourceReferences ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.state.savedItems.unshift(entity);
    this.persist();
    return entity;
  }

  public updateSavedItem(
    ownerUserId: string,
    itemId: string,
    updates: UpdateLibraryItemRequest
  ): SavedItemEntity {
    const item = this.state.savedItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error('NOT_FOUND');
    }
    if (item.ownerUserId !== ownerUserId) {
      throw new Error('FORBIDDEN_OWNERSHIP');
    }

    if (updates.workspaceId !== undefined && updates.workspaceId !== null) {
      const ws = this.state.workspaces.find(
        (w) => w.id === updates.workspaceId && w.ownerUserId === ownerUserId
      );
      if (!ws) throw new Error('FORBIDDEN_WORKSPACE');
    }

    if (updates.personalNotes !== undefined) {
      item.personalNotes = updates.personalNotes;
    }
    if (updates.pageTitle !== undefined) {
      item.pageTitle = updates.pageTitle;
    }
    if (updates.workspaceId !== undefined) {
      item.workspaceId = updates.workspaceId;
    }
    item.updatedAt = new Date().toISOString();
    this.persist();
    return item;
  }

  public deleteSavedItem(ownerUserId: string, itemId: string): void {
    const item = this.state.savedItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error('NOT_FOUND');
    }
    if (item.ownerUserId !== ownerUserId) {
      throw new Error('FORBIDDEN_OWNERSHIP');
    }
    this.state.savedItems = this.state.savedItems.filter((i) => i.id !== itemId);
    this.persist();
  }

  public recordConversationMessage(params: {
    ownerUserId: string;
    conversationId?: string;
    title: string;
    question: string;
    answer: string;
    sourceReferences: SourceReference[];
  }): ConversationEntity {
    const now = new Date().toISOString();
    let conv = params.conversationId
      ? this.state.conversations.find(
          (c) => c.id === params.conversationId && c.ownerUserId === params.ownerUserId
        )
      : undefined;

    if (!conv) {
      conv = {
        id: `conv_${crypto.randomBytes(8).toString('hex')}`,
        ownerUserId: params.ownerUserId,
        workspaceId: null,
        title: params.title.slice(0, 160),
        createdAt: now,
        updatedAt: now,
      };
      this.state.conversations.push(conv);
    } else {
      conv.updatedAt = now;
    }

    this.state.messages.push(
      {
        id: `msg_${crypto.randomBytes(8).toString('hex')}`,
        conversationId: conv.id,
        role: 'user',
        content: params.question,
        sourceReferences: [],
        createdAt: now,
      },
      {
        id: `msg_${crypto.randomBytes(8).toString('hex')}`,
        conversationId: conv.id,
        role: 'assistant',
        content: params.answer,
        sourceReferences: params.sourceReferences,
        createdAt: now,
      }
    );

    this.persist();
    return conv;
  }

  public recordUsageEvent(event: Omit<UsageEventEntity, 'id' | 'createdAt'>): UsageEventEntity {
    const record: UsageEventEntity = {
      ...event,
      id: `usg_${crypto.randomBytes(8).toString('hex')}`,
      createdAt: new Date().toISOString(),
    };
    this.state.usageEvents.unshift(record);
    this.persist();
    return record;
  }

  public getUserUsageSummary(ownerUserId: string): {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
    dailyQuotaLimit: number;
    dailyRequestsUsed: number;
    recentEvents: UsageEventEntity[];
  } {
    const userEvents = this.state.usageEvents.filter((e) => e.ownerUserId === ownerUserId);
    const oneDayAgo = Date.now() - 1000 * 60 * 60 * 24;
    const dailyRequestsUsed = userEvents.filter(
      (e) => new Date(e.createdAt).getTime() >= oneDayAgo
    ).length;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalEstimatedCostUsd = 0;

    for (const ev of userEvents) {
      totalInputTokens += ev.inputTokenCount;
      totalOutputTokens += ev.outputTokenCount;
      totalEstimatedCostUsd += ev.estimatedCost;
    }

    const user = this.state.users.find((u) => u.id === ownerUserId);
    const dailyQuotaLimit = user?.planIdentifier === 'pro_scholar' ? 250 : 40;

    return {
      totalRequests: userEvents.length,
      totalInputTokens,
      totalOutputTokens,
      totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
      dailyQuotaLimit,
      dailyRequestsUsed,
      recentEvents: userEvents.slice(0, 15),
    };
  }

  public deleteAllUserData(ownerUserId: string): {
    deletedItems: number;
    deletedConversations: number;
  } {
    const userItems = this.state.savedItems.filter((i) => i.ownerUserId === ownerUserId).length;
    const userConvs = this.state.conversations
      .filter((c) => c.ownerUserId === ownerUserId)
      .map((c) => c.id);

    this.state.savedItems = this.state.savedItems.filter((i) => i.ownerUserId !== ownerUserId);
    this.state.conversations = this.state.conversations.filter(
      (c) => c.ownerUserId !== ownerUserId
    );
    this.state.messages = this.state.messages.filter(
      (m) => !userConvs.includes(m.conversationId)
    );
    this.persist();

    return {
      deletedItems: userItems,
      deletedConversations: userConvs.length,
    };
  }

  public exportUserData(ownerUserId: string) {
    const user = this.state.users.find((u) => u.id === ownerUserId);
    const workspaces = this.listWorkspaces(ownerUserId);
    const savedItems = this.state.savedItems.filter((i) => i.ownerUserId === ownerUserId);
    const conversations = this.state.conversations.filter((c) => c.ownerUserId === ownerUserId);
    const usage = this.getUserUsageSummary(ownerUserId);

    return {
      exportedAt: new Date().toISOString(),
      user,
      workspaces,
      savedItems,
      conversations,
      usage,
    };
  }
}
