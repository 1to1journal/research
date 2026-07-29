// db.js
// A very small, dependency-free JSON-file "database".
// Good enough for a research journal with moderate traffic, and it means
// the whole app can be deployed on any free host without needing a paid
// external database. If the project grows a lot, this can later be
// swapped for a real database (Postgres/MySQL) behind the same functions.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "data", "db.json");

function defaultData() {
  return {
    admin: {
      username: "admin",
      // passwordHash is set by `npm run seed` on first setup (see seed.js)
      passwordHash: null,
    },
    categories: [],
    articles: [],
    readers: [],
    readLogs: [],
    comments: [],
    submissions: [],
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    save(defaultData());
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    // Backfill fields for db.json files created before a feature was added.
    if (!Array.isArray(parsed.submissions)) parsed.submissions = [];
    return parsed;
  } catch (e) {
    console.error("db.json is corrupted, recreating with defaults.", e);
    save(defaultData());
    return defaultData();
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function id() {
  return crypto.randomUUID();
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\u0980-\u09FFa-z0-9]+/g, "-") // keep Bengali unicode range + latin/numbers
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || id().slice(0, 8);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

module.exports = { load, save, id, slugify, todayStr, DB_PATH };
