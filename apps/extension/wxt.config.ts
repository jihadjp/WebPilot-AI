/**
 * WXT Configuration for WebPilot AI (Manifest V3 — Chrome & Edge)
 */
export default {
  srcDir: '.',
  outDir: '../../dist-extension',
  manifestVersion: 3,
  manifest: {
    name: 'WebPilot AI — Source-Grounded Web Assistant',
    short_name: 'WebPilot AI',
    version: '1.0.0',
    description:
      'Understand the web. Take smarter action. Source-grounded AI summaries, contextual Q&A, selected-text explanations, and study quizzes.',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open WebPilot AI Side Panel',
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
};
