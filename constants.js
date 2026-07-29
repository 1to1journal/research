const ARTICLE_TYPES = [
  { key: "peer_reviewed", label_bn: "পিয়ার রিভিউড আর্টিকেল", label_en: "Peer-Reviewed Article" },
  { key: "conference", label_bn: "কনফারেন্স আর্টিকেল", label_en: "Conference Article" },
  { key: "book", label_bn: "গবেষণা বই", label_en: "Research Book" },
];

function typeLabel(key) {
  const t = ARTICLE_TYPES.find((t) => t.key === key);
  return t ? t.label_bn : key;
}

// Submission progress-tracking stages.
// `order` drives the progress bar (1..4). "revision_requested" sits at the
// same step as "under_review" (2) since it's a sub-state of review, not a
// forward step. "rejected" is a terminal state shown separately (not on the bar).
const SUBMISSION_STATUSES = [
  { key: "received", label_bn: "সাবমিশন গৃহীত হয়েছে", order: 1 },
  { key: "under_review", label_bn: "পর্যালোচনাধীন (Under Review)", order: 2 },
  { key: "revision_requested", label_bn: "সংশোধন প্রয়োজন (Revision Requested)", order: 2 },
  { key: "accepted", label_bn: "গৃহীত হয়েছে (Accepted)", order: 3 },
  { key: "published", label_bn: "প্রকাশিত হয়েছে (Published)", order: 4 },
  { key: "rejected", label_bn: "প্রত্যাখ্যাত হয়েছে (Rejected)", order: -1 },
];

const PROGRESS_STEPS = [
  { order: 1, label_bn: "গৃহীত" },
  { order: 2, label_bn: "পর্যালোচনা" },
  { order: 3, label_bn: "Accepted" },
  { order: 4, label_bn: "প্রকাশিত" },
];

function submissionStatusLabel(key) {
  const s = SUBMISSION_STATUSES.find((s) => s.key === key);
  return s ? s.label_bn : key;
}

module.exports = {
  ARTICLE_TYPES,
  typeLabel,
  SUBMISSION_STATUSES,
  PROGRESS_STEPS,
  submissionStatusLabel,
};
