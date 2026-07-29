// reader-gate.js
// Shared logic for the "one-time contact info, then remembered by cookie"
// gate used for reading full articles, commenting, and submitting content.

const { id } = require("./db");

const READER_COOKIE = "reader_id";
const READER_COOKIE_OPTS = {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

function findOrCreateReader(data, { whatsapp, address, affiliation, email }) {
  let reader = data.readers.find(
    (r) => r.whatsapp === whatsapp && r.email.toLowerCase() === email.toLowerCase()
  );
  if (!reader) {
    reader = {
      id: id(),
      whatsapp,
      address,
      affiliation,
      email,
      createdAt: new Date().toISOString(),
    };
    data.readers.push(reader);
  }
  return reader;
}

// Resolves the reader for this request: from the cookie if present,
// otherwise from the WhatsApp/address/affiliation/email fields in the body.
// Returns { reader } on success, or { error: "..." } if info is required but missing.
function resolveReader(req, res, data) {
  const existingReaderId = req.cookies[READER_COOKIE];
  let reader = existingReaderId ? data.readers.find((r) => r.id === existingReaderId) : null;

  if (reader) return { reader };

  const { whatsapp, address, affiliation, email } = req.body;
  if (!whatsapp || !address || !affiliation || !email) {
    return { error: "সবগুলো ঘর পূরণ করুন" };
  }
  reader = findOrCreateReader(data, { whatsapp, address, affiliation, email });
  res.cookie(READER_COOKIE, reader.id, READER_COOKIE_OPTS);
  return { reader };
}

// Looks up a reader without creating one - used for the "my submissions"
// cross-device lookup (only whatsapp + email needed, since that's the dedup key).
function findReaderByContact(data, { whatsapp, email }) {
  if (!whatsapp || !email) return null;
  return (
    data.readers.find(
      (r) => r.whatsapp === whatsapp && r.email.toLowerCase() === String(email).toLowerCase()
    ) || null
  );
}

module.exports = { resolveReader, findOrCreateReader, findReaderByContact, READER_COOKIE, READER_COOKIE_OPTS };
