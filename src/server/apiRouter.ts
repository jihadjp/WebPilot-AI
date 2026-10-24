import express, { Request, Response, NextFunction } from 'express';
import {
  AskRequestSchema,
  CreateLibraryItemRequestSchema,
  ExplainSelectionRequestSchema,
  GenerateQuizRequestSchema,
  SummarizeRequestSchema,
  SupportedLanguageSchema,
  UpdateLibraryItemRequestSchema,
} from '../shared/schemas';
import { AIProvider, resolveAIProvider } from './providers';
import { UserEntity, WebPilotRepository } from './db';
import { SlidingWindowRateLimiter } from './rateLimit';

export interface AuthenticatedRequest extends Request {
  user?: UserEntity;
  sessionToken?: string;
}

export function createApiRouter(options?: {
  repo?: WebPilotRepository;
  aiProvider?: AIProvider;
  rateLimiter?: SlidingWindowRateLimiter;
}): express.Router {
  const router = express.Router();
  const repo = options?.repo ?? new WebPilotRepository();
  const aiProvider = options?.aiProvider ?? resolveAIProvider();
  const rateLimiter = options?.rateLimiter ?? new SlidingWindowRateLimiter(60_000, 30);

  // Health & Provider status endpoint
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'webpilot-ai-backend',
      aiProvider: aiProvider.name,
      aiModel: aiProvider.modelName,
      openAiConfigured: Boolean(
        process.env.OPENAI_API_KEY &&
          process.env.OPENAI_API_KEY !== 'MY_OPENAI_API_KEY' &&
          process.env.OPENAI_API_KEY.startsWith('sk-')
      ),
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
          process.env.GEMINI_API_KEY.length > 10
      ),
      timestamp: new Date().toISOString(),
    });
  });

  // Switch/issue session for testing multi-user ownership isolation
  router.post('/auth/session', (req: Request, res: Response) => {
    const profile = req.body?.profile;
    const targetUserId =
      profile === 'secondary' ? 'usr_secondary_reviewer' : 'usr_primary_researcher';
    try {
      const session = repo.createSessionForUser(targetUserId);
      const user = repo.getUserBySessionToken(session.token);
      res.status(200).json({
        token: session.token,
        expiresAt: session.expiresAt,
        user,
      });
    } catch {
      res.status(400).json({
        error: {
          code: 'AUTH_INVALID_PROFILE',
          message: 'Requested authentication profile does not exist.',
        },
      });
    }
  });

  // Authentication middleware for all protected /api/v1 routes
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const headerToken =
      typeof authHeader === 'string' ? authHeader : (req.headers['x-webpilot-token'] as string);

    const user = repo.getUserBySessionToken(headerToken);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid authentication session token is required.',
        },
      });
      return;
    }

    req.user = user;
    req.sessionToken = headerToken;
    next();
  };

  // Rate limit middleware for AI endpoints
  const enforceRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = req.user?.id || req.ip || 'anonymous';
    const decision = rateLimiter.check(key);
    res.setHeader('X-RateLimit-Remaining', String(decision.remaining));

    if (!decision.allowed) {
      if (req.user) {
        repo.recordUsageEvent({
          ownerUserId: req.user.id,
          operation: 'summarize',
          modelIdentifier: aiProvider.modelName,
          inputTokenCount: 0,
          outputTokenCount: 0,
          estimatedCost: 0,
          requestStatus: 'rate_limited',
        });
      }
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many AI requests. Please retry in ${decision.retryAfterSeconds} seconds.`,
          retryAfterSeconds: decision.retryAfterSeconds,
        },
      });
      return;
    }
    next();
  };

  // Account & Session endpoints
  router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const workspaces = repo.listWorkspaces(user.id);
    res.json({
      user,
      workspaces,
      aiProvider: {
        name: aiProvider.name,
        model: aiProvider.modelName,
      },
    });
  });

  router.patch('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const langParse = SupportedLanguageSchema.safeParse(req.body?.preferredLanguage);
    const updated = repo.updateUserPreferences(req.user!.id, {
      preferredLanguage: langParse.success ? langParse.data : undefined,
      displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
    });
    res.json({ user: updated });
  });

  router.get('/me/usage', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const summary = repo.getUserUsageSummary(req.user!.id);
    res.json(summary);
  });

  router.get('/me/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const bundle = repo.exportUserData(req.user!.id);
    res.json(bundle);
  });

  router.delete('/me/data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = repo.deleteAllUserData(req.user!.id);
    res.json({
      status: 'deleted',
      ...result,
    });
  });

  router.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.sessionToken) {
      repo.revokeSession(req.sessionToken);
    }
    res.json({ status: 'logged_out' });
  });

  // Workspaces endpoints
  router.get('/workspaces', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      workspaces: repo.listWorkspaces(req.user!.id),
    });
  });

  router.post('/workspaces', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 2 || name.length > 80) {
      res.status(400).json({
        error: {
          code: 'INVALID_WORKSPACE_NAME',
          message: 'Workspace name must be between 2 and 80 characters.',
        },
      });
      return;
    }
    const workspace = repo.createWorkspace(req.user!.id, name);
    res.status(201).json({ workspace });
  });

  // AI Endpoints
  router.post(
    '/ai/summarize',
    requireAuth,
    enforceRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = SummarizeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid summarize request payload.',
            details: parsed.error.flatten(),
          },
        });
        return;
      }

      try {
        const result = await aiProvider.summarize(parsed.data);
        repo.recordUsageEvent({
          ownerUserId: req.user!.id,
          operation: 'summarize',
          modelIdentifier: result.usage.model,
          inputTokenCount: result.usage.inputTokens,
          outputTokenCount: result.usage.outputTokens,
          estimatedCost: result.usage.estimatedCostUsd,
          requestStatus: 'succeeded',
        });
        res.json(result);
      } catch (err) {
        repo.recordUsageEvent({
          ownerUserId: req.user!.id,
          operation: 'summarize',
          modelIdentifier: aiProvider.modelName,
          inputTokenCount: 0,
          outputTokenCount: 0,
          estimatedCost: 0,
          requestStatus: 'failed',
        });
        res.status(502).json({
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: err instanceof Error ? err.message : 'Failed to generate summary.',
          },
        });
      }
    }
  );

  router.post(
    '/ai/ask',
    requireAuth,
    enforceRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = AskRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid contextual Q&A request payload.',
            details: parsed.error.flatten(),
          },
        });
        return;
      }

      try {
        const tempConvId = parsed.data.conversationId || `conv_${Date.now()}`;
        const result = await aiProvider.ask(parsed.data, tempConvId);
        const conv = repo.recordConversationMessage({
          ownerUserId: req.user!.id,
          conversationId: parsed.data.conversationId,
          title: parsed.data.pageContext.pageTitle,
          question: parsed.data.question,
          answer: result.answer,
          sourceReferences: result.sourceReferences,
        });

        repo.recordUsageEvent({
          ownerUserId: req.user!.id,
          operation: 'ask',
          modelIdentifier: result.usage.model,
          inputTokenCount: result.usage.inputTokens,
          outputTokenCount: result.usage.outputTokens,
          estimatedCost: result.usage.estimatedCostUsd,
          requestStatus: 'succeeded',
        });

        res.json({
          ...result,
          conversationId: conv.id,
        });
      } catch (err) {
        res.status(502).json({
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: err instanceof Error ? err.message : 'Failed to answer question.',
          },
        });
      }
    }
  );

  router.post(
    '/ai/explain-selection',
    requireAuth,
    enforceRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = ExplainSelectionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid explain-selection payload.',
            details: parsed.error.flatten(),
          },
        });
        return;
      }

      try {
        const result = await aiProvider.explainSelection(parsed.data);
        repo.recordUsageEvent({
          ownerUserId: req.user!.id,
          operation: 'explain_selection',
          modelIdentifier: result.usage.model,
          inputTokenCount: result.usage.inputTokens,
          outputTokenCount: result.usage.outputTokens,
          estimatedCost: result.usage.estimatedCostUsd,
          requestStatus: 'succeeded',
        });
        res.json(result);
      } catch (err) {
        res.status(502).json({
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: err instanceof Error ? err.message : 'Failed to explain selection.',
          },
        });
      }
    }
  );

  router.post(
    '/ai/generate-quiz',
    requireAuth,
    enforceRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      const parsed = GenerateQuizRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid quiz generation payload.',
            details: parsed.error.flatten(),
          },
        });
        return;
      }

      try {
        const result = await aiProvider.generateQuiz(parsed.data);
        repo.recordUsageEvent({
          ownerUserId: req.user!.id,
          operation: 'generate_quiz',
          modelIdentifier: result.usage.model,
          inputTokenCount: result.usage.inputTokens,
          outputTokenCount: result.usage.outputTokens,
          estimatedCost: result.usage.estimatedCostUsd,
          requestStatus: 'succeeded',
        });
        res.json(result);
      } catch (err) {
        res.status(502).json({
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: err instanceof Error ? err.message : 'Failed to generate study quiz.',
          },
        });
      }
    }
  );

  // Saved Library Endpoints (with strict user ownership enforcement)
  router.get('/library', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const workspaceId =
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = repo.listSavedItems({
      ownerUserId: req.user!.id,
      search,
      workspaceId,
      limit,
      offset,
    });
    res.json(result);
  });

  router.post('/library', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateLibraryItemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid library item payload.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    try {
      const item = repo.createSavedItem(req.user!.id, parsed.data);
      res.status(201).json({ item });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'CREATE_FAILED';
      res.status(code.startsWith('FORBIDDEN') ? 403 : 400).json({
        error: {
          code,
          message: 'Not authorized to save item to the specified workspace.',
        },
      });
    }
  });

  router.patch('/library/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const parsed = UpdateLibraryItemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update payload.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    try {
      const updated = repo.updateSavedItem(req.user!.id, req.params.id, parsed.data);
      res.json({ item: updated });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UPDATE_FAILED';
      const status =
        code === 'NOT_FOUND' ? 404 : code.startsWith('FORBIDDEN') ? 403 : 400;
      res.status(status).json({
        error: {
          code,
          message:
            status === 403
              ? 'Access denied: you do not own this library item.'
              : 'Library item not found.',
        },
      });
    }
  });

  router.delete('/library/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      repo.deleteSavedItem(req.user!.id, req.params.id);
      res.status(200).json({ status: 'deleted', id: req.params.id });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'DELETE_FAILED';
      const status =
        code === 'NOT_FOUND' ? 404 : code.startsWith('FORBIDDEN') ? 403 : 400;
      res.status(status).json({
        error: {
          code,
          message:
            status === 403
              ? 'Access denied: you cannot delete an item owned by another user.'
              : 'Library item not found.',
        },
      });
    }
  });

  return router;
}
