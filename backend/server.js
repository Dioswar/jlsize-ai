const path = require("path");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // En Render las variables se reciben directamente del entorno.
}
const express = require("express");
const { db, normalizeProduct } = require("./database");
const { createSession, requireAdmin } = require("./auth");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const docsPath = path.join(__dirname, "..", "docs");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "60kb" }));
app.use(express.static(docsPath));

/* ---------------------- HEALTH ---------------------- */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "jlsize-backend",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: GEMINI_MODEL
  });
});

/* ---------------------- PRODUCTOS ---------------------- */
app.get("/api/products", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM products WHERE active = 1 ORDER BY id")
    .all();

  res.json(rows.map(normalizeProduct));
});

/* ---------------------- CONTACTO ---------------------- */
app.post("/api/contact", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      error: "Completa nombre, correo, tipo de solicitud y mensaje."
    });
  }

  if (name.length > 80 || email.length > 120 || phone.length > 30 || message.length > 700) {
    return res.status(400).json({ error: "Uno de los campos es demasiado largo." });
  }

  const result = db.prepare(`
    INSERT INTO contacts (name, email, phone, subject, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, phone, subject, message);

  res.status(201).json({
    ok: true,
    id: result.lastInsertRowid,
    message: "Solicitud registrada."
  });
});

/* ---------------------- LOGIN ADMIN ---------------------- */
app.post("/api/admin/login", (req, res) => {
  const username = String(req.body?.username || "");
  const password = String(req.body?.password || "");

  const expectedUser = process.env.ADMIN_USER;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return res.status(503).json({ error: "El acceso administrativo no está configurado." });
  }

  if (username !== expectedUser || password !== expectedPassword) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }

  const token = createSession(username);

  res.json({
    ok: true,
    token
  });
});

app.get("/api/admin/session", requireAdmin, (req, res) => {
  res.json({ ok: true });
});

/* ---------------------- ADMIN PRODUCTOS ---------------------- */
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const product = validateProduct(req.body);

  if (!product.ok) {
    return res.status(400).json({ error: product.error });
  }

  const result = db.prepare(`
    INSERT INTO products (category, name, price, sizes, image, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    product.value.category,
    product.value.name,
    product.value.price,
    JSON.stringify(product.value.sizes),
    product.value.image,
    product.value.description
  );

  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const product = validateProduct(req.body);

  if (!product.ok) {
    return res.status(400).json({ error: product.error });
  }

  const result = db.prepare(`
    UPDATE products
    SET category = ?, name = ?, price = ?, sizes = ?, image = ?, description = ?, active = 1
    WHERE id = ?
  `).run(
    product.value.category,
    product.value.name,
    product.value.price,
    JSON.stringify(product.value.sizes),
    product.value.image,
    product.value.description,
    id
  );

  if (!result.changes) {
    return res.status(404).json({ error: "Producto no encontrado." });
  }

  res.json({ ok: true });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const result = db
    .prepare("DELETE FROM products WHERE id = ?")
    .run(Number(req.params.id));

  if (!result.changes) {
    return res.status(404).json({ error: "Producto no encontrado." });
  }

  res.json({ ok: true });
});

/* ---------------------- ADMIN CONTACTOS ---------------------- */
app.get("/api/admin/contacts", requireAdmin, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM contacts ORDER BY id DESC")
    .all();

  res.json(rows);
});

app.put("/api/admin/contacts/:id", requireAdmin, (req, res) => {
  const status = req.body?.status === "Atendido" ? "Atendido" : "Pendiente";

  const result = db
    .prepare("UPDATE contacts SET status = ? WHERE id = ?")
    .run(status, Number(req.params.id));

  if (!result.changes) {
    return res.status(404).json({ error: "Solicitud no encontrada." });
  }

  res.json({ ok: true });
});

/* ---------------------- GEMINI / IA ---------------------- */
app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Gemini no está configurado en el servidor."
      });
    }

    const message = String(req.body?.message || "").trim().slice(0, 700);
    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-8)
      : [];

    if (!message) {
      return res.status(400).json({ error: "Escribe un mensaje." });
    }

    const catalog = db
      .prepare("SELECT id, category, name, price, sizes FROM products WHERE active = 1 ORDER BY id")
      .all()
      .map(row => ({
        ...row,
        sizes: JSON.parse(row.sizes || "[]")
      }));

    const systemInstruction = `
Eres JLSIZE AI, asistente de compras de una tienda de ropa second hand.

REGLAS:
- Responde en español y de forma breve.
- Usa únicamente los productos del catálogo proporcionado.
- No inventes tallas, precios, descuentos ni disponibilidad.
- Puedes recomendar según presupuesto o categoría.
- Si el usuario pide explícitamente agregar un producto al carrito:
  - identifica el producto;
  - confirma una talla válida;
  - si falta talla, pregunta primero.
- Si pide ver el carrito, usa action "open_cart".

CATÁLOGO:
${JSON.stringify(catalog)}

Devuelve ÚNICAMENTE JSON:
{
  "reply": "texto para el usuario",
  "action": "none | open_cart | add_to_cart",
  "productId": 0,
  "size": ""
}
`;

    const contents = history
      .filter(item =>
        item &&
        ["user", "model"].includes(item.role) &&
        typeof item.text === "string"
      )
      .map(item => ({
        role: item.role,
        parts: [{ text: item.text.slice(0, 700) }]
      }));

    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY.trim()
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 350,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const googleResult = await response.json();

    if (!response.ok) {
      console.error("Gemini:", googleResult);
      const detail = googleResult?.error?.message || "Gemini no respondió.";
      return res.status(502).json({ error: detail });
    }

    const raw = googleResult?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!raw) {
      return res.status(502).json({ error: "Gemini devolvió una respuesta vacía." });
    }

    let ai;
    try {
      ai = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return res.status(502).json({ error: "No se pudo interpretar la respuesta de Gemini." });
      }
      ai = JSON.parse(match[0]);
    }

    const payload = {
      reply: String(ai.reply || "¿En qué te ayudo?").slice(0, 900),
      action: ["none", "open_cart", "add_to_cart"].includes(ai.action)
        ? ai.action
        : "none",
      product: null
    };

    if (payload.action === "add_to_cart") {
      const row = db
        .prepare("SELECT * FROM products WHERE id = ? AND active = 1")
        .get(Number(ai.productId));

      if (row) {
        const product = normalizeProduct(row);
        const size = String(ai.size || "").trim();

        if (product.sizes.includes(size)) {
          payload.product = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            size
          };
        } else {
          payload.action = "none";
          payload.reply = "Necesito una talla válida antes de agregar esa prenda.";
        }
      } else {
        payload.action = "none";
      }
    }

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del chatbot." });
  }
});

function validateProduct(input) {
  const name = String(input?.name || "").trim();
  const category = String(input?.category || "").trim();
  const price = Number(input?.price);
  const sizes = Array.isArray(input?.sizes)
    ? input.sizes.map(item => String(item).trim()).filter(Boolean)
    : [];
  const image = String(input?.image || "images/catalogo_prendas.jpg").trim();
  const description = String(input?.description || "").trim();

  if (!name || !category || !description || !Number.isFinite(price) || price < 0 || !sizes.length) {
    return { ok: false, error: "Completa correctamente todos los datos del producto." };
  }

  return {
    ok: true,
    value: { name, category, price, sizes, image, description }
  };
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jlsize listo en http://localhost:${PORT}`);
  console.log(`Gemini: ${process.env.GEMINI_API_KEY ? "configurado" : "sin clave"} · ${GEMINI_MODEL}`);
});
