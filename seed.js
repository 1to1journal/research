// seed.js - run once with `npm run seed` to set up the admin account and
// default categories. Safe to run again later (it won't duplicate categories
// and will only reset the admin password if you pass --reset-admin).

require("dotenv").config();
const { load, save, id, slugify } = require("./db");
const { hashPassword } = require("./auth");

const data = load();

// --- Admin account ---
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";
const resetAdmin = process.argv.includes("--reset-admin");

if (!data.admin.passwordHash || resetAdmin) {
  data.admin.username = adminUsername;
  data.admin.passwordHash = hashPassword(adminPassword);
  console.log(`Admin account set. username="${adminUsername}" password="${adminPassword}"`);
  console.log("IMPORTANT: change this password after your first login (Admin Dashboard > Settings).");
} else {
  console.log("Admin account already exists, skipping. Use --reset-admin to overwrite.");
}

// --- Default categories ---
const defaultCategories = [
  "রাজনীতি",     // Politics
  "অর্থনীতি",     // Economics
  "ধর্ম",         // Religion
  "ভাষা",         // Language
  "সাহিত্য",       // Literature
  "আইন",         // Law
  "শিক্ষা",       // Education
  "সমাজবিজ্ঞান",   // Sociology
  "ইতিহাস",       // History
  "অন্যান্য",      // Others
];

const existingNames = new Set(data.categories.map((c) => c.name));
for (const name of defaultCategories) {
  if (!existingNames.has(name)) {
    data.categories.push({ id: id(), name, slug: slugify(name) });
  }
}

save(data);
console.log(`Categories ready (${data.categories.length} total).`);
console.log("Seeding complete.");
