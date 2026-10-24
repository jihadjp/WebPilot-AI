import { ExtensionMessageSchema } from '../../../src/shared/schemas';
import { validatePageUrl } from '../../../src/shared/extractor';

declare const chrome: {
  runtime: {
    onInstalled: { addListener: (cb: () => void) => void };
    onMessage: {
      addListener: (
        cb: (
          msg: unknown,
          sender: { tab?: { id?: number; url?: string } },
          sendResponse: (resp: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
  sidePanel?: {
    setPanelBehavior?: (opts: { openPanelOnActionClick: boolean }) => Promise<void>;
  };
  tabs: {
    query: (
      queryInfo: { active: boolean; currentWindow: boolean },
      cb: (tabs: Array<{ id?: number; url?: string; title?: string }>) => void
    ) => void;
    sendMessage: (tabId: number, msg: unknown, cb: (response: unknown) => void) => void;
  };
  scripting: {
    executeScript: (
      injection: { target: { tabId: number }; files: string[] },
      cb: () => void
    ) => void;
  };
  storage: {
    session: {
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
    };
  };
};

/**
 * Manifest V3 Background Service Worker.
 * Stateless across restarts: persists active tab session context in chrome.storage.session
 * and validates every message boundary with Zod.
 */
export function registerBackgroundServiceWorker() {
  if (typeof chrome === 'undefined' || !chrome.runtime) return;

  chrome.runtime.onInstalled.addListener(() => {
    if (chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    const parsed = ExtensionMessageSchema.safeParse(rawMessage);
    if (!parsed.success) {
      sendResponse({
        ok: false,
        error: 'INVALID_EXTENSION_MESSAGE',
        details: parsed.error.flatten(),
      });
      return false;
    }

    const msg = parsed.data;

    if (msg.type === 'WEBPILOT_GET_TAB_STATUS') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const urlCheck = validatePageUrl(activeTab?.url);
        sendResponse({
          ok: true,
          tabId: activeTab?.id ?? null,
          url: activeTab?.url ?? '',
          title: activeTab?.title ?? 'Untitled Tab',
          supported: urlCheck.supported,
          hostname: urlCheck.hostname,
          reasonMessage: urlCheck.reasonMessage,
        });
      });
      return true;
    }

    if (msg.type === 'WEBPILOT_CAPTURE_PAGE') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab?.id || !activeTab.url) {
          sendResponse({ ok: false, error: 'NO_ACTIVE_TAB' });
          return;
        }
        const urlCheck = validatePageUrl(activeTab.url);
        if (!urlCheck.supported) {
          sendResponse({
            ok: false,
            error: urlCheck.reasonCode || 'UNSUPPORTED_URL',
            message: urlCheck.reasonMessage,
          });
          return;
        }

        // Inject content script on-demand only after explicit user consent
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTab.id },
            files: ['content.js'],
          },
          () => {
            chrome.tabs.sendMessage(
              activeTab.id!,
              { type: 'WEBPILOT_EXTRACT_DOM_NOW' },
              async (extractedResponse) => {
                if (extractedResponse) {
                  await chrome.storage.session.set({
                    [`pageContext_${activeTab.id}`]: extractedResponse,
                  });
                }
                sendResponse({ ok: true, data: extractedResponse });
              }
            );
          }
        );
      });
      return true;
    }

    if (msg.type === 'WEBPILOT_CLEAR_CONTEXT') {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          await chrome.storage.session.remove(`pageContext_${activeTab.id}`);
        }
        sendResponse({ ok: true });
      });
      return true;
    }

    return false;
  });
}

registerBackgroundServiceWorker();
