const express = require("express");
const router = express.Router();
const { load, save, id, todayStr } = require("../db");
const { resolveReader, findReaderByContact } = require("../reader-gate");
const { sendMail } = require("../mailer");
const { ARTICLE_TYPES, typeLabel } = require("../constants");

function logRead(data, articleId, readerId) {
  const date = todayStr();
  const existing = data.readLogs.find(
    (l) => l.articleId === articleId && l.readerId === readerId && l.date === date
  );
  if (!existing) {
    data.readLogs.push({ id: id(), articleId, readerId, date });
  }
}

// Step 1: gate access to a full article (Google Drive link).
router.post("/access/:articleId", (req, res) => {
  const data = load();
  const article = data.articles.find((a) => a.id === req.params.articleId);
  if (!article) return res.status(404).json({ error: "প্রবন্ধ পাওয়া যায়নি" });

  const { reader, error } = resolveReader(req, res, data);
  if (error) return res.status(400).json({ error });

  logRead(data, article.id, reader.id);
  save(data);

  res.json({ ok: true, driveLink: article.driveLink });
});

// Post a comment. Same gate rules as article access.
router.post("/comment/:articleId", (req, res) => {
  const data = load();
  const article = data.articles.find((a) => a.id === req.params.articleId);
  if (!article) return res.status(404).json({ error: "প্রবন্ধ পাওয়া যায়নি" });

  const content = (req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "কমেন্ট লিখুন" });

  const { reader, error } = resolveReader(req, res, data);
  if (error) return res.status(400).json({ error });

  const comment = {
    id: id(),
    articleId: article.id,
    readerId: reader.id,
    content,
    createdAt: new Date().toISOString(),
  };
  data.comments.push(comment);
  save(data);

  res.json({ ok: true, comment: { ...comment, readerName: reader.affiliation || reader.email } });
});

// Submit a new article/conference paper/research book for consideration.
// Same gate rules as article access & comments (WhatsApp/address/affiliation/email once, then remembered).
router.post("/submissions", async (req, res) => {
  const data = load();
  const { title, type, categoryId, note, manuscriptLink } = req.body;

  if (!title || !type || !ARTICLE_TYPES.some((t) => t.key === type)) {
    return res.status(400).json({ error: "শিরোনাম ও ধরন আবশ্যক" });
  }

  const { reader, error } = resolveReader(req, res, data);
  if (error) return res.status(400).json({ error });

  const submission = {
    id: id(),
    readerId: reader.id,
    title,
    type,
    categoryId: categoryId || null,
    note: note || "",
    manuscriptLink: manuscriptLink || "",
    status: "received",
    statusHistory: [
      { status: "received", note: "সাবমিশন জমা হয়েছে", date: new Date().toISOString() },
    ],
    createdAt: new Date().toISOString(),
  };
  data.submissions.push(submission);
  save(data);

  // Best-effort notification email to the journal's inbox - failure here
  // never blocks the submission from being saved/tracked in the software.
  const notifyTo = process.env.SUBMISSION_NOTIFY_EMAIL || "onetoonejournal@gmail.com";
  sendMail({
    to: notifyTo,
    subject: `নতুন সাবমিশন: ${title}`,
    text: [
      `শিরোনাম: ${title}`,
      `ধরন: ${typeLabel(type)}`,
      `লেখক/এফিলিয়েশন: ${reader.affiliation}`,
      `ইমেইল: ${reader.email}`,
      `হোয়াটসঅ্যাপ: ${reader.whatsapp}`,
      `ঠিকানা: ${reader.address}`,
      manuscriptLink ? `ম্যানুস্ক্রিপ্ট লিংক: ${manuscriptLink}` : `ম্যানুস্ক্রিপ্ট লিংক: (দেওয়া হয়নি)`,
      note ? `নোট: ${note}` : "",
      "",
      "অ্যাডমিন প্যানেল থেকে এই সাবমিশনের অগ্রগতি (progress) আপডেট করুন: /admin/submissions",
    ]
      .filter(Boolean)
      .join("\n"),
  }).catch(() => {});

  res.json({ ok: true, submission });
});

// Look up a reader's submissions - by cookie if present, otherwise by
// whatsapp+email (used when checking progress from a different device).
router.post("/my-submissions", (req, res) => {
  const data = load();
  const existingReaderId = req.cookies.reader_id;
  let reader = existingReaderId ? data.readers.find((r) => r.id === existingReaderId) : null;

  if (!reader) {
    reader = findReaderByContact(data, req.body);
    if (!reader) {
      return res.status(404).json({ error: "এই তথ্য দিয়ে কোনো সাবমিশন পাওয়া যায়নি" });
    }
    res.cookie("reader_id", reader.id, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  const submissions = data.submissions
    .filter((s) => s.readerId === reader.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ ok: true, submissions });
});

module.exports = router;
