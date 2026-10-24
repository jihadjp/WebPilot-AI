import { buildPageContextFromHtml } from '../../../src/shared/extractor';

declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (
        cb: (
          msg: { type?: string },
          sender: unknown,
          sendResponse: (resp: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
};

/**
 * On-demand Content Script.
 * Never injected automatically on page load. Executed strictly via chrome.scripting.executeScript
 * when the user clicks "Use this page" in the Side Panel.
 * Never collects form inputs, password fields, cookies, or tokens.
 */
export function registerOnDemandContentExtractor() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'WEBPILOT_EXTRACT_DOM_NOW') {
      try {
        const mainRoot =
          document.querySelector('article') ||
          document.querySelector('main') ||
          document.body;

        const cloned = mainRoot.cloneNode(true) as HTMLElement;
        // Strip sensitive or noisy elements before serialization
        const forbiddenSelectors = [
          'script',
          'style',
          'noscript',
          'nav',
          'footer',
          'aside',
          'form',
          'input',
          'textarea',
          'select',
          'button',
          '[aria-hidden="true"]',
          '[type="password"]',
        ];
        for (const sel of forbiddenSelectors) {
          cloned.querySelectorAll(sel).forEach((el) => el.remove());
        }

        const payload = buildPageContextFromHtml({
          pageUrl: window.location.href,
          pageTitle: document.title || window.location.hostname,
          html: cloned.innerHTML,
        });

        sendResponse({
          ok: true,
          payload,
          selectedText: window.getSelection()?.toString()?.trim() || '',
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'EXTRACTION_FAILED',
        });
      }
      return true;
    }
    return false;
  });
}

registerOnDemandContentExtractor();
