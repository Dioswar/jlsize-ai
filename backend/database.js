const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, "data", "jlsize.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    sizes TEXT NOT NULL,
    image TEXT NOT NULL,
    description TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function seedProducts() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (count > 0) return;

  const seed = require("./data/seed-products.json");
  const insert = db.prepare(`
    INSERT INTO products (id, category, name, price, sizes, image, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN TRANSACTION;");
  try {
    for (const product of seed) {
      insert.run(
        product.id,
        product.category,
        product.name,
        product.price,
        JSON.stringify(product.sizes),
        product.image,
        product.description
      );
    }
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function normalizeProduct(row) {
  return {
    ...row,
    sizes: JSON.parse(row.sizes || "[]"),
    active: Boolean(row.active)
  };
}

seedProducts();

module.exports = {
  db,
  normalizeProduct
};
