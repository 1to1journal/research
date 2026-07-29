const express = require("express");
const router = express.Router();
const { load, save, id, slugify } = require("../db");
const { verifyPassword, hashPassword } = require("../auth");
const { requireAdmin } = require("../middleware/auth");
const { ARTICLE_TYPES, SUBMISSION_STATUSES, submissionStatusLabel } = require("../constants");
const { sendMail } = require("../mailer");

// ---------- Auth ----------
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin/dashboard");
  res.render("admin-login", { title: "অ্যাডমিন লগইন" });
});

router.post("/login", (req, res) => {
  const data = load();
  const { username, password } = req.body;
  if (
    username === data.admin.username &&
    data.admin.passwordHash &&
    verifyPassword(password, data.admin.passwordHash)
  ) {
    req.session.isAdmin = true;
    req.session.username = username;
    return res.redirect("/admin/dashboard");
  }
  req.flash("error", "ভুল ইউজারনেম বা পাসওয়ার্ড");
  res.redirect("/admin/login");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// everything below requires admin session
router.use(requireAdmin);

// ---------- Dashboard ----------
router.get("/dashboard", (req, res) => {
  const data = load();

  const totalReads = data.readLogs.length;
  const totalReaders = data.readers.length;
  const totalComments = data.comments.length;
  const totalArticles = data.articles.length;

  // reads per article (all-time) + today
  const today = new Date().toISOString().slice(0, 10);
  const readsByArticle = {};
  for (const log of data.readLogs) {
    readsByArticle[log.articleId] = readsByArticle[log.articleId] || { total: 0, today: 0 };
    readsByArticle[log.articleId].total += 1;
    if (log.date === today) readsByArticle[log.articleId].today += 1;
  }

  const articleStats = data.articles
    .map((a) => ({
      ...a,
      categoryName: (data.categories.find((c) => c.id === a.categoryId) || {}).name || "-",
      reads: readsByArticle[a.id] || { total: 0, today: 0 },
      commentCount: data.comments.filter((c) => c.articleId === a.id).length,
    }))
    .sort((a, b) => (b.reads.total || 0) - (a.reads.total || 0));

  res.render("admin-dashboard", {
    title: "অ্যাডমিন ড্যাশবোর্ড",
    tab: "overview",
    totalReads,
    totalReaders,
    totalComments,
    totalArticles,
    articleStats,
    categories: data.categories,
    types: ARTICLE_TYPES,
  });
});

// ---------- Articles ----------
router.get("/articles", (req, res) => {
  const data = load();
  res.render("admin-articles", {
    title: "প্রবন্ধ ব্যবস্থাপনা",
    tab: "articles",
    articles: data.articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    categories: data.categories,
    types: ARTICLE_TYPES,
    editArticle: null,
  });
});

router.get("/articles/:id/edit", (req, res) => {
  const data = load();
  const article = data.articles.find((a) => a.id === req.params.id);
  if (!article) {
    req.flash("error", "প্রবন্ধ পাওয়া যায়নি");
    return res.redirect("/admin/articles");
  }
  res.render("admin-articles", {
    title: "প্রবন্ধ সম্পাদনা",
    tab: "articles",
    articles: data.articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    categories: data.categories,
    types: ARTICLE_TYPES,
    editArticle: article,
  });
});

router.post("/articles", (req, res) => {
  const data = load();
  const { title, abstractEn, type, categoryId, driveLink, author, publishedAt } = req.body;
  if (!title || !abstractEn || !type || !categoryId || !driveLink || !author) {
    req.flash("error", "সবগুলো আবশ্যক ঘর পূরণ করুন");
    return res.redirect("/admin/articles");
  }
  data.articles.push({
    id: id(),
    title,
    abstractEn,
    type,
    categoryId,
    driveLink,
    author,
    publishedAt: publishedAt || new Date().toISOString().slice(0, 10),
    slug: slugify(title),
  });
  save(data);
  req.flash("success", "প্রবন্ধ যোগ করা হয়েছে");
  res.redirect("/admin/articles");
});

router.post("/articles/:id", (req, res) => {
  const data = load();
  const article = data.articles.find((a) => a.id === req.params.id);
  if (!article) {
    req.flash("error", "প্রবন্ধ পাওয়া যায়নি");
    return res.redirect("/admin/articles");
  }
  const { title, abstractEn, type, categoryId, driveLink, author, publishedAt } = req.body;
  Object.assign(article, {
    title,
    abstractEn,
    type,
    categoryId,
    driveLink,
    author,
    publishedAt,
    slug: slugify(title),
  });
  save(data);
  req.flash("success", "প্রবন্ধ হালনাগাদ করা হয়েছে");
  res.redirect("/admin/articles");
});

router.post("/articles/:id/delete", (req, res) => {
  const data = load();
  data.articles = data.articles.filter((a) => a.id !== req.params.id);
  data.comments = data.comments.filter((c) => c.articleId !== req.params.id);
  data.readLogs = data.readLogs.filter((l) => l.articleId !== req.params.id);
  save(data);
  req.flash("success", "প্রবন্ধ মুছে ফেলা হয়েছে");
  res.redirect("/admin/articles");
});

// ---------- Categories ----------
router.get("/categories", (req, res) => {
  const data = load();
  res.render("admin-categories", {
    title: "ক্যাটাগরি ব্যবস্থাপনা",
    tab: "categories",
    categories: data.categories,
  });
});

router.post("/categories", (req, res) => {
  const data = load();
  const name = (req.body.name || "").trim();
  if (!name) {
    req.flash("error", "ক্যাটাগরির নাম দিন");
    return res.redirect("/admin/categories");
  }
  if (data.categories.some((c) => c.name === name)) {
    req.flash("error", "এই ক্যাটাগরি আগে থেকেই আছে");
    return res.redirect("/admin/categories");
  }
  data.categories.push({ id: id(), name, slug: slugify(name) });
  save(data);
  req.flash("success", "ক্যাটাগরি যোগ করা হয়েছে");
  res.redirect("/admin/categories");
});

router.post("/categories/:id/delete", (req, res) => {
  const data = load();
  const inUse = data.articles.some((a) => a.categoryId === req.params.id);
  if (inUse) {
    req.flash("error", "এই ক্যাটাগরিতে প্রবন্ধ আছে, তাই মুছা যাবে না");
    return res.redirect("/admin/categories");
  }
  data.categories = data.categories.filter((c) => c.id !== req.params.id);
  save(data);
  req.flash("success", "ক্যাটাগরি মুছে ফেলা হয়েছে");
  res.redirect("/admin/categories");
});

// ---------- Readers ----------
router.get("/readers", (req, res) => {
  const data = load();
  const readers = data.readers
    .map((r) => ({
      ...r,
      readCount: data.readLogs.filter((l) => l.readerId === r.id).length,
      commentCount: data.comments.filter((c) => c.readerId === r.id).length,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render("admin-readers", {
    title: "নিবন্ধিত ইউজার তালিকা",
    tab: "readers",
    readers,
  });
});

// ---------- Reads analytics per article ----------
router.get("/analytics/:articleId", (req, res) => {
  const data = load();
  const article = data.articles.find((a) => a.id === req.params.articleId);
  if (!article) {
    req.flash("error", "প্রবন্ধ পাওয়া যায়নি");
    return res.redirect("/admin/dashboard");
  }
  const logs = data.readLogs
    .filter((l) => l.articleId === article.id)
    .map((l) => ({ ...l, reader: data.readers.find((r) => r.id === l.readerId) }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const byDate = {};
  for (const l of logs) {
    byDate[l.date] = (byDate[l.date] || 0) + 1;
  }

  res.render("admin-analytics", {
    title: `পাঠ পরিসংখ্যান: ${article.title}`,
    tab: "articles",
    article,
    logs,
    byDate,
  });
});

// ---------- Comments moderation ----------
router.get("/comments", (req, res) => {
  const data = load();
  const grouped = data.articles.map((a) => ({
    article: a,
    comments: data.comments
      .filter((c) => c.articleId === a.id)
      .map((c) => ({ ...c, reader: data.readers.find((r) => r.id === c.readerId) }))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)),
  })).filter((g) => g.comments.length > 0);

  res.render("admin-comments", {
    title: "প্রবন্ধ অনুযায়ী কমেন্ট",
    tab: "comments",
    grouped,
  });
});

router.post("/comments/:id/delete", (req, res) => {
  const data = load();
  data.comments = data.comments.filter((c) => c.id !== req.params.id);
  save(data);
  req.flash("success", "কমেন্ট মুছে ফেলা হয়েছে");
  res.redirect("back");
});

// ---------- Submissions (user-submitted articles/conference papers/books) ----------
router.get("/submissions", (req, res) => {
  const data = load();
  const submissions = data.submissions
    .map((s) => ({
      ...s,
      reader: data.readers.find((r) => r.id === s.readerId),
      categoryName: (data.categories.find((c) => c.id === s.categoryId) || {}).name || "-",
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render("admin-submissions", {
    title: "সাবমিশন ব্যবস্থাপনা",
    tab: "submissions",
    submissions,
    types: ARTICLE_TYPES,
    statuses: SUBMISSION_STATUSES,
  });
});

router.post("/submissions/:id/status", (req, res) => {
  const data = load();
  const submission = data.submissions.find((s) => s.id === req.params.id);
  if (!submission) {
    req.flash("error", "সাবমিশন পাওয়া যায়নি");
    return res.redirect("/admin/submissions");
  }

  const { status, note } = req.body;
  if (!SUBMISSION_STATUSES.some((s) => s.key === status)) {
    req.flash("error", "সঠিক স্ট্যাটাস বাছাই করুন");
    return res.redirect("/admin/submissions");
  }

  submission.status = status;
  submission.statusHistory.push({
    status,
    note: note || "",
    date: new Date().toISOString(),
  });
  save(data);

  // Let the researcher know their progress updated - by email, if SMTP is set up.
  const reader = data.readers.find((r) => r.id === submission.readerId);
  if (reader) {
    sendMail({
      to: reader.email,
      subject: `আপনার সাবমিশনের অগ্রগতি হালনাগাদ হয়েছে: ${submission.title}`,
      text: [
        `আপনার "${submission.title}" শীর্ষক সাবমিশনের বর্তমান অবস্থা: ${submissionStatusLabel(status)}`,
        note ? `মন্তব্য: ${note}` : "",
        "",
        "বিস্তারিত অগ্রগতি দেখতে ওয়েবসাইটে 'আমার সাবমিশন' পাতায় যান।",
      ]
        .filter(Boolean)
        .join("\n"),
    }).catch(() => {});
  }

  req.flash("success", "সাবমিশনের অবস্থা হালনাগাদ করা হয়েছে");
  res.redirect("/admin/submissions");
});

// ---------- Settings ----------
router.get("/settings", (req, res) => {
  const data = load();
  res.render("admin-settings", {
    title: "সেটিংস",
    tab: "settings",
    username: data.admin.username,
  });
});

router.post("/settings", (req, res) => {
  const data = load();
  const { username, currentPassword, newPassword } = req.body;

  if (!verifyPassword(currentPassword, data.admin.passwordHash)) {
    req.flash("error", "বর্তমান পাসওয়ার্ড ভুল");
    return res.redirect("/admin/settings");
  }
  if (username) data.admin.username = username;
  if (newPassword) data.admin.passwordHash = hashPassword(newPassword);
  save(data);
  req.flash("success", "সেটিংস আপডেট হয়েছে");
  res.redirect("/admin/settings");
});

module.exports = router;
