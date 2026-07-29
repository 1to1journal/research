require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const flash = require("connect-flash");

const siteRoutes = require("./routes/site");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1); // needed on most free hosts (Render/Railway) behind a proxy, for secure cookies

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    store: new FileStore({ path: path.join(__dirname, "data", "sessions"), retries: 0, logFn: () => {} }),
    secret: process.env.SESSION_SECRET || "please-change-this-secret-in-.env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, // 12 hours - admin session
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);
app.use(flash());

// Make basic values available in every view
app.use((req, res, next) => {
  res.locals.siteName = "One to One Journal";
  res.locals.issn = "3006-8088";
  res.locals.currentPath = req.path;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.use("/", siteRoutes);
app.use("/admin", adminRoutes);
app.use("/api", apiRoutes);

// robots.txt & sitemap.xml for search engine indexing
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get("host")}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (req, res) => {
  const { load } = require("./db");
  const data = load();
  const base = `${req.protocol}://${req.get("host")}`;
  const urls = [
    `${base}/`,
    `${base}/search`,
    ...data.articles.map((a) => `${base}/article/${a.slug || a.id}`),
  ];
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join("\n")}\n</urlset>`
  );
});

app.use((req, res) => {
  res.status(404).render("404", { title: "পাতা পাওয়া যায়নি" });
});

app.listen(PORT, () => {
  console.log(`One to One Journal running at http://localhost:${PORT}`);
});
