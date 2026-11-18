const crypto = require("crypto");

const sessions = new Map();
const SESSION_HOURS = 12;

function createSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;

  sessions.set(token, { username, expiresAt });
  return token;
}

function validateSession(token) {
  const session = sessions.get(token);

  if (!session) return false;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }

  return true;
}

function requireAdmin(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!validateSession(token)) {
    return res.status(401).json({ error: "Sesión administrativa no válida." });
  }

  next();
}

module.exports = {
  createSession,
  requireAdmin
};
