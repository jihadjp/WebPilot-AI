import { SupportedLanguage } from './schemas';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  navAssistant: string;
  navLibrary: string;
  navSettings: string;
  statusCaptured: string;
  statusUncaptured: string;
  statusUnsupported: string;
  useThisPage: string;
  recapturePage: string;
  clearCapture: string;
  cancelAction: string;
  consentDisclosure: string;
  privacyGuarantee: string;
  quickSummarize: string;
  quickTakeaways: string;
  quickExplainSelection: string;
  quickStudyMode: string;
  summaryShort: string;
  summaryDetailed: string;
  summaryTakeaways: string;
  summaryStepByStep: string;
  summaryBengali: string;
  summaryEnglish: string;
  generateSummaryBtn: string;
  mainIdeasHeading: string;
  keyTakeawaysHeading: string;
  importantTermsHeading: string;
  sourceReferencesHeading: string;
  copyAction: string;
  copiedFeedback: string;
  saveToLibrary: string;
  savedFeedback: string;
  retryAction: string;
  askPlaceholder: string;
  askSendBtn: string;
  askContextNotice: string;
  evidenceSufficientBadge: string;
  evidenceInsufficientBadge: string;
  selectionHeading: string;
  selectionInputLabel: string;
  selectionRunBtn: string;
  studyGenerateBtn: string;
  studyQuestionsTab: string;
  studyFlashcardsTab: string;
  studyNotesTab: string;
  librarySearchPlaceholder: string;
  libraryEmptyTitle: string;
  libraryEmptyBody: string;
  libraryOpenOriginal: string;
  libraryEditNotes: string;
  librarySaveNotes: string;
  libraryDeleteConfirm: string;
  libraryAllWorkspaces: string;
  settingsLanguageLabel: string;
  settingsThemeLabel: string;
  settingsAccountHeading: string;
  settingsUsageHeading: string;
  settingsPrivacyHeading: string;
  settingsDeleteDataBtn: string;
  settingsExportDataBtn: string;
  settingsSignOutBtn: string;
  settingsExtensionGuideHeading: string;
  truncationNotice: string;
}

export const DICTIONARY: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: 'WebPilot AI',
    tagline: 'Understand the web. Take smarter action.',
    navAssistant: 'Assistant',
    navLibrary: 'Library',
    navSettings: 'Settings',
    statusCaptured: 'Page Captured',
    statusUncaptured: 'Awaiting Consent',
    statusUnsupported: 'Restricted Page',
    useThisPage: 'Use this page',
    recapturePage: 'Re-capture page',
    clearCapture: 'Release page context',
    cancelAction: 'Cancel',
    consentDisclosure:
      'Readable article text from this page will be sent to the configured AI server only when you submit an action below.',
    privacyGuarantee:
      'Never collects passwords, cookies, form values, authentication tokens, or background browsing history.',
    quickSummarize: 'Summarize',
    quickTakeaways: 'Key takeaways',
    quickExplainSelection: 'Explain selection',
    quickStudyMode: 'Study mode',
    summaryShort: 'Short summary',
    summaryDetailed: 'Detailed summary',
    summaryTakeaways: 'Key takeaways',
    summaryStepByStep: 'Step-by-step explanation',
    summaryBengali: 'Bengali summary',
    summaryEnglish: 'English summary',
    generateSummaryBtn: 'Generate Summary',
    mainIdeasHeading: 'Main Ideas',
    keyTakeawaysHeading: 'Key Takeaways',
    importantTermsHeading: 'Important Terms',
    sourceReferencesHeading: 'Verified Source References',
    copyAction: 'Copy',
    copiedFeedback: 'Copied',
    saveToLibrary: 'Save to Library',
    savedFeedback: 'Saved',
    retryAction: 'Retry',
    askPlaceholder: 'Ask a source-grounded question about this page...',
    askSendBtn: 'Ask WebPilot',
    askContextNotice: 'Grounded strictly in captured page sections',
    evidenceSufficientBadge: 'Supported by page source',
    evidenceInsufficientBadge: 'Insufficient page evidence',
    selectionHeading: 'Explain Selected Text',
    selectionInputLabel: 'Selected webpage excerpt (treated as untrusted data)',
    selectionRunBtn: 'Analyze Selection',
    studyGenerateBtn: 'Generate 5-Question Quiz & Study Pack',
    studyQuestionsTab: 'Multiple-Choice Quiz',
    studyFlashcardsTab: 'Flashcards',
    studyNotesTab: 'Revision Notes',
    librarySearchPlaceholder: 'Search saved items by title or hostname...',
    libraryEmptyTitle: 'No saved research items yet',
    libraryEmptyBody:
      'Capture a webpage in the Assistant tab and save a summary or study note to build your personal knowledge library.',
    libraryOpenOriginal: 'Open Original URL',
    libraryEditNotes: 'Edit Notes',
    librarySaveNotes: 'Save Notes',
    libraryDeleteConfirm: 'Confirm Delete',
    libraryAllWorkspaces: 'All Workspaces',
    settingsLanguageLabel: 'Interface & Output Language',
    settingsThemeLabel: 'Appearance Theme',
    settingsAccountHeading: 'Authenticated Session & Ownership',
    settingsUsageHeading: 'AI Quota & Token Accounting',
    settingsPrivacyHeading: 'Privacy & Data Controls',
    settingsDeleteDataBtn: 'Delete All My Saved Data',
    settingsExportDataBtn: 'Export My Data (JSON)',
    settingsSignOutBtn: 'Sign Out',
    settingsExtensionGuideHeading: 'Manifest V3 Unpacked Extension Build',
    truncationNotice:
      'Long document truncated deterministically to fit context safety budget.',
  },
  bn: {
    appName: 'ওয়েবপাইলট এআই (WebPilot AI)',
    tagline: 'ওয়েবকে বুঝুন। আরও বিচক্ষণ পদক্ষেপ নিন।',
    navAssistant: 'অ্যাসিস্ট্যান্ট',
    navLibrary: 'লাইব্রেরি',
    navSettings: 'সেটিংস',
    statusCaptured: 'পেজ ক্যাপচার করা হয়েছে',
    statusUncaptured: 'অনুমতির অপেক্ষায়',
    statusUnsupported: 'সীমাবদ্ধ পেজ',
    useThisPage: 'এই পেজটি ব্যবহার করুন',
    recapturePage: 'পুনরায় ক্যাপচার করুন',
    clearCapture: 'পেজ কনটেক্সট মুছুন',
    cancelAction: 'বাতিল করুন',
    consentDisclosure:
      'আপনি নিচে কোনো এআই অ্যাকশন সাবমিট করলেই কেবল এই পেজের পঠনযোগ্য অংশ কনফিগার করা এআই সার্ভারে পাঠানো হবে।',
    privacyGuarantee:
      'কখনোই পাসওয়ার্ড, কুকিজ, ফর্মের তথ্য, টোকেন বা ব্রাউজিং হিস্ট্রি সংগ্রহ করে না।',
    quickSummarize: 'সারাংশ',
    quickTakeaways: 'মূল পয়েন্ট',
    quickExplainSelection: 'নির্বাচিত অংশ ব্যাখ্যা',
    quickStudyMode: 'স্টাডি মোড',
    summaryShort: 'সংক্ষিপ্ত সারাংশ',
    summaryDetailed: 'বিস্তারিত সারাংশ',
    summaryTakeaways: 'মূল টেকঅ্যাওয়ে',
    summaryStepByStep: 'ধাপে ধাপে ব্যাখ্যা',
    summaryBengali: 'বাংলা সারাংশ',
    summaryEnglish: 'ইংরেজি সারাংশ',
    generateSummaryBtn: 'সারাংশ তৈরি করুন',
    mainIdeasHeading: 'প্রধান ধারণা',
    keyTakeawaysHeading: 'মূল শিক্ষণীয় বিষয়',
    importantTermsHeading: 'গুরুত্বপূর্ণ পরিভাষা',
    sourceReferencesHeading: 'যাচাইকৃত সোর্স রেফারেন্স',
    copyAction: 'কপি করুন',
    copiedFeedback: 'কপি হয়েছে',
    saveToLibrary: 'লাইব্রেরিতে সংরক্ষণ করুন',
    savedFeedback: 'সংরক্ষিত',
    retryAction: 'পুনরায় চেষ্টা করুন',
    askPlaceholder: 'এই পেজ সম্পর্কে তথ্যভিত্তিক প্রশ্ন করুন...',
    askSendBtn: 'প্রশ্ন পাঠান',
    askContextNotice: 'ক্যাপচার করা পেজের তথ্যের ওপর ভিত্তি করে উত্তর দেওয়া হয়',
    evidenceSufficientBadge: 'পেজের তথ্য দ্বারা সমর্থিত',
    evidenceInsufficientBadge: 'পেজে পর্যাপ্ত তথ্য নেই',
    selectionHeading: 'নির্বাচিত টেক্সট ব্যাখ্যা করুন',
    selectionInputLabel: 'নির্বাচিত ওয়েবপেজ অংশ (আনট্রাস্টেড ডেটা হিসেবে প্রক্রিয়াজাত)',
    selectionRunBtn: 'ব্যাখ্যা তৈরি করুন',
    studyGenerateBtn: '৫টি প্রশ্নের কুইজ ও স্টাডি প্যাক তৈরি করুন',
    studyQuestionsTab: 'বহুনির্বাচনী কুইজ',
    studyFlashcardsTab: 'ফ্ল্যাশকার্ড',
    studyNotesTab: 'রিভিশন নোট',
    librarySearchPlaceholder: 'শিরোনাম বা হোস্টনেম দিয়ে খুঁজুন...',
    libraryEmptyTitle: 'এখনো কোনো আইটেম সংরক্ষণ করা হয়নি',
    libraryEmptyBody:
      'অ্যাসিস্ট্যান্ট ট্যাবে একটি ওয়েবপেজ ক্যাপচার করুন এবং আপনার ব্যক্তিগত লাইব্রেরিতে সারাংশ সংরক্ষণ করুন।',
    libraryOpenOriginal: 'মূল পেজ খুলুন',
    libraryEditNotes: 'নোট সম্পাদনা',
    librarySaveNotes: 'নোট সংরক্ষণ',
    libraryDeleteConfirm: 'মুছে ফেলা নিশ্চিত করুন',
    libraryAllWorkspaces: 'সকল ওয়ার্কস্পেস',
    settingsLanguageLabel: 'ভাষা নির্বাচন (Language)',
    settingsThemeLabel: 'থিম (Theme)',
    settingsAccountHeading: 'অ্যাকাউন্ট ও সেশন',
    settingsUsageHeading: 'এআই ব্যবহার ও কোটা',
    settingsPrivacyHeading: 'গোপনীয়তা ও ডেটা নিয়ন্ত্রণ',
    settingsDeleteDataBtn: 'আমার সকল সংরক্ষিত ডেটা মুছে ফেলুন',
    settingsExportDataBtn: 'ডেটা এক্সপোর্ট করুন (JSON)',
    settingsSignOutBtn: 'সাইন আউট',
    settingsExtensionGuideHeading: 'ম্যানিফেস্ট ভি৩ এক্সটেনশন বিল্ড গাইড',
    truncationNotice:
      'নিরাপদ কনটেক্সট সীমার মধ্যে রাখতে দীর্ঘ ডকুমেন্টটি সংক্ষিপ্ত করা হয়েছে।',
  },
};

export function t(lang: SupportedLanguage, key: keyof TranslationDictionary): string {
  return DICTIONARY[lang]?.[key] ?? DICTIONARY.en[key];
}
