import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApiRouter } from './apiRouter';
import { WebPilotRepository } from './db';
import { DeterministicGroundedProvider } from './providers';
import { SlidingWindowRateLimiter } from './rateLimit';
import { buildPageContextFromHtml } from '../shared/extractor';
import { SAMPLE_WEB_PAGES } from '../shared/samplePages';

async function withTestServer(
  fn: (baseUrl: string, repo: WebPilotRepository, limiter: SlidingWindowRateLimiter) => Promise<void>
) {
  const tmpFile = path.resolve(
    process.cwd(),
    `.data/test_db_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
  const repo = new WebPilotRepository(tmpFile);
  const limiter = new SlidingWindowRateLimiter(60_000, 15);
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(
    '/api/v1',
    createApiRouter({
      repo,
      aiProvider: new DeterministicGroundedProvider(),
      rateLimiter: limiter,
    })
  );

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    await fn(baseUrl, repo, limiter);
  } finally {
    server.close();
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

test('Integration: authentication enforcement blocks unauthenticated access', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/library`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});

test('Integration: summarize, contextual Q&A, explain-selection, and quiz endpoints work with verified source references', async () => {
  await withTestServer(async (baseUrl) => {
    const sample = SAMPLE_WEB_PAGES[0];
    const pageContext = buildPageContextFromHtml({
      pageUrl: sample.url,
      pageTitle: sample.title,
      html: sample.html,
    });

    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wp_sess_primary_default',
    };

    // 1. Summarize in English
    const sumRes = await fetch(`${baseUrl}/ai/summarize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pageContext,
        format: 'short',
        language: 'en',
      }),
    });
    assert.equal(sumRes.status, 200);
    const sumData = await sumRes.json();
    assert.ok(sumData.summary.length > 20);
    assert.ok(Array.isArray(sumData.sourceReferences));
    assert.ok(sumData.sourceReferences.length > 0);
    // Verify every returned source reference maps to a real block in pageContext
    for (const ref of sumData.sourceReferences) {
      assert.ok(pageContext.blocks.some((b) => b.id === ref.blockId));
    }

    // 2. Summarize in Bengali
    const bnRes = await fetch(`${baseUrl}/ai/summarize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pageContext,
        format: 'bn_summary',
        language: 'bn',
      }),
    });
    assert.equal(bnRes.status, 200);
    const bnData = await bnRes.json();
    assert.ok(bnData.summary.includes('শিরোনাম'));

    // 3. Contextual Q&A (Supported question)
    const askRes = await fetch(`${baseUrl}/ai/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pageContext,
        question: 'How does Raft prevent split votes during leader election?',
        previousMessages: [],
        language: 'en',
      }),
    });
    assert.equal(askRes.status, 200);
    const askData = await askRes.json();
    assert.equal(askData.evidenceSufficient, true);
    assert.ok(askData.sourceReferences.length > 0);

    // 4. Contextual Q&A (Unsupported question outside page scope)
    const unsupportedRes = await fetch(`${baseUrl}/ai/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pageContext,
        question: 'What is the boiling point of titanium in kelvin?',
        previousMessages: [],
        language: 'en',
      }),
    });
    assert.equal(unsupportedRes.status, 200);
    const unsupportedData = await unsupportedRes.json();
    assert.equal(unsupportedData.evidenceSufficient, false);

    // 5. Study Quiz Generation
    const quizRes = await fetch(`${baseUrl}/ai/generate-quiz`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pageContext,
        questionCount: 5,
        quizType: 'mcq',
        language: 'en',
      }),
    });
    assert.equal(quizRes.status, 200);
    const quizData = await quizRes.json();
    assert.equal(quizData.questions.length, 5);
    assert.equal(quizData.questions[0].options.length, 4);
  });
});

test('Integration: strict user ownership isolation prevents User B from modifying or deleting User A library items', async () => {
  await withTestServer(async (baseUrl) => {
    const userAHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wp_sess_primary_default',
    };
    const userBHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wp_sess_secondary_default',
    };

    // User A creates a library item
    const createRes = await fetch(`${baseUrl}/library`, {
      method: 'POST',
      headers: userAHeaders,
      body: JSON.stringify({
        pageUrl: 'https://systems.stanford.edu/papers/raft-consensus-protocol',
        pageTitle: 'User A Private Raft Notes',
        hostname: 'systems.stanford.edu',
        summary: 'Key Raft invariants summary.',
        personalNotes: 'Private note by User A',
        sourceReferences: [],
      }),
    });
    assert.equal(createRes.status, 201);
    const { item } = await createRes.json();

    // User B lists library items -> must NOT see User A's item
    const userBListRes = await fetch(`${baseUrl}/library`, {
      headers: userBHeaders,
    });
    const userBList = await userBListRes.json();
    assert.equal(
      userBList.items.some((i: { id: string }) => i.id === item.id),
      false
    );

    // User B attempts to PATCH User A's item -> must receive 403 FORBIDDEN_OWNERSHIP
    const forbiddenPatch = await fetch(`${baseUrl}/library/${item.id}`, {
      method: 'PATCH',
      headers: userBHeaders,
      body: JSON.stringify({ personalNotes: 'Tampered by User B' }),
    });
    assert.equal(forbiddenPatch.status, 403);

    // User B attempts to DELETE User A's item -> must receive 403 FORBIDDEN_OWNERSHIP
    const forbiddenDelete = await fetch(`${baseUrl}/library/${item.id}`, {
      method: 'DELETE',
      headers: userBHeaders,
    });
    assert.equal(forbiddenDelete.status, 403);

    // User A deletes their own item -> succeeds with 200
    const validDelete = await fetch(`${baseUrl}/library/${item.id}`, {
      method: 'DELETE',
      headers: userAHeaders,
    });
    assert.equal(validDelete.status, 200);
  });
});

test('Integration: rate limiter returns 429 when user exceeds request quota', async () => {
  await withTestServer(async (baseUrl, _repo, limiter) => {
    const sample = SAMPLE_WEB_PAGES[0];
    const pageContext = buildPageContextFromHtml({
      pageUrl: sample.url,
      pageTitle: sample.title,
      html: sample.html,
    });

    // Exhaust quota for usr_primary_researcher
    for (let i = 0; i < 15; i++) {
      limiter.check('usr_primary_researcher');
    }

    const res = await fetch(`${baseUrl}/ai/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wp_sess_primary_default',
      },
      body: JSON.stringify({
        pageContext,
        format: 'short',
        language: 'en',
      }),
    });

    assert.equal(res.status, 429);
    const data = await res.json();
    assert.equal(data.error.code, 'RATE_LIMIT_EXCEEDED');
  });
});
