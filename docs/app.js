const config = window.JLSIZE_CONFIG || {};
const configuredApi = String(config.API_BASE_URL || "").replace(/\/$/, "");
const placeholderBackend = configuredApi.includes("TU-BACKEND");
const API_BASE_URL = placeholderBackend ? "" : configuredApi;

const grid = document.getElementById("catalogGrid");
const filters = document.querySelectorAll(".filter");

const cartTrigger = document.getElementById("cartTrigger");
const cartClose = document.getElementById("cartClose");
const cartOverlay = document.getElementById("cartOverlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

const contactForm = document.getElementById("contactForm");
const contactStatus = document.getElementById("contactStatus");

const aiChatButton = document.getElementById("aiChatButton");
const aiChatPanel = document.getElementById("aiChatPanel");
const aiChatClose = document.getElementById("aiChatClose");
const aiChatForm = document.getElementById("aiChatForm");
const aiChatInput = document.getElementById("aiChatInput");
const aiChatMessages = document.getElementById("aiChatMessages");

const toast = document.getElementById("toast");

let products = [];
let cart = loadCart();
let aiHistory = [];
let aiSending = false;

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

async function loadProducts() {
  let source = "local";

  try {
    const response = await fetch(apiUrl("/api/products"), { cache: "no-store" });
    if (!response.ok) throw new Error("API no disponible");
    products = await response.json();
    source = "api";
  } catch {
    const response = await fetch("data/products.json");
    products = await response.json();
  }

  renderProducts(products);
  renderCart();
}

function renderProducts(list) {
  grid.innerHTML = "";

  list.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";

    const sizes = product.sizes
      .map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`)
      .join("");

    card.innerHTML = `
      <div class="product-image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
      </div>

      <div class="product-info">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <strong class="product-price">${money(product.price)}</strong>

        <div class="product-shop-row">
          <div class="product-size">
            <label for="size-${product.id}">Talla</label>
            <select id="size-${product.id}">${sizes}</select>
          </div>

          <button class="add-cart-btn" type="button" data-product-id="${product.id}">
            Agregar al carrito
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  document.querySelectorAll(".add-cart-btn").forEach(button => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.productId);
      const size = document.getElementById(`size-${id}`).value;
      addToCart(id, size);
    });
  });
}

filters.forEach(button => {
  button.addEventListener("click", () => {
    filters.forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    const category = button.dataset.filter;
    const filtered = category === "Todos"
      ? products
      : products.filter(product => product.category === category);

    renderProducts(filtered);
  });
});

/* ---------------------- CARRITO ---------------------- */
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("jlsize-cart")) || [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("jlsize-cart", JSON.stringify(cart));
}

function addToCart(productId, size) {
  const product = products.find(item => Number(item.id) === Number(productId));
  if (!product) return;

  const existing = cart.find(
    item => Number(item.id) === Number(productId) && item.size === size
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: Number(product.id),
      name: product.name,
      price: Number(product.price),
      image: product.image,
      size,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  showToast(`${product.name} agregado`);
}

function changeQuantity(id, size, change) {
  const item = cart.find(
    product => Number(product.id) === Number(id) && product.size === size
  );

  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(
      product => !(Number(product.id) === Number(id) && product.size === size)
    );
  }

  saveCart();
  renderCart();
}

function removeItem(id, size) {
  cart = cart.filter(
    product => !(Number(product.id) === Number(id) && product.size === size)
  );
  saveCart();
  renderCart();
}

function renderCart() {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = count;
  cartTotal.textContent = money(total);
  checkoutBtn.disabled = cart.length === 0;

  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <div>
          <strong>Tu carrito está vacío</strong>
          <p>Agrega tus piezas favoritas del drop.</p>
        </div>
      </div>
    `;
    return;
  }

  cartItems.innerHTML = cart.map(item => `
    <article class="cart-item">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
      <div>
        <div class="cart-item-top">
          <h3>${escapeHtml(item.name)}</h3>
          <span class="cart-item-price">${money(item.price * item.quantity)}</span>
        </div>

        <p class="cart-item-meta">Talla: ${escapeHtml(item.size)} · ${money(item.price)} c/u</p>

        <div class="cart-item-controls">
          <div class="qty-control">
            <button type="button" data-action="minus" data-id="${item.id}" data-size="${escapeHtml(item.size)}">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-action="plus" data-id="${item.id}" data-size="${escapeHtml(item.size)}">+</button>
          </div>

          <button class="remove-item" type="button" data-action="remove" data-id="${item.id}" data-size="${escapeHtml(item.size)}">
            Eliminar
          </button>
        </div>
      </div>
    </article>
  `).join("");

  cartItems.querySelectorAll("[data-action]").forEach(button => {
    const id = Number(button.dataset.id);
    const size = button.dataset.size;

    button.addEventListener("click", () => {
      if (button.dataset.action === "plus") changeQuantity(id, size, 1);
      if (button.dataset.action === "minus") changeQuantity(id, size, -1);
      if (button.dataset.action === "remove") removeItem(id, size);
    });
  });
}

function openCart() {
  document.body.classList.add("cart-open");
}

function closeCart() {
  document.body.classList.remove("cart-open");
}

cartTrigger.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

clearCartBtn.addEventListener("click", () => {
  cart = [];
  saveCart();
  renderCart();
});

checkoutBtn.addEventListener("click", () => {
  if (!cart.length) return;

  const lines = cart.map(item =>
    `• ${item.name} | Talla ${item.size} | ${item.quantity} x ${money(item.price)}`
  );

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const message = [
    "Hola, quiero hacer este pedido en Jlsize:",
    "",
    ...lines,
    "",
    `TOTAL: ${money(total)}`,
    "",
    "¿Me confirman disponibilidad?"
  ].join("\n");

  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

/* ---------------------- CONTACTO ---------------------- */
contactForm.addEventListener("submit", async event => {
  event.preventDefault();

  contactStatus.textContent = "Enviando...";
  contactStatus.className = "form-status";

  const data = Object.fromEntries(new FormData(contactForm).entries());

  try {
    const response = await fetch(apiUrl("/api/contact"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo registrar la solicitud.");
    }

    contactForm.reset();
    contactStatus.textContent = "Solicitud enviada y registrada correctamente.";
    contactStatus.className = "form-status success";
  } catch (error) {
    contactStatus.textContent = error.message;
    contactStatus.className = "form-status error";
  }
});

/* ---------------------- JLSIZE AI ---------------------- */
function openAI() {
  aiChatPanel.classList.add("open");
  setTimeout(() => aiChatInput.focus(), 100);
}

function closeAI() {
  aiChatPanel.classList.remove("open");
}

aiChatButton.addEventListener("click", () => {
  aiChatPanel.classList.contains("open") ? closeAI() : openAI();
});

aiChatClose.addEventListener("click", closeAI);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeCart();
    closeAI();
  }
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => sendAIMessage(button.dataset.prompt));
});

aiChatForm.addEventListener("submit", event => {
  event.preventDefault();
  sendAIMessage(aiChatInput.value);
});

function addAIMessage(type, text, extraClass = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `ai-message ${type} ${extraClass}`.trim();

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  aiChatMessages.appendChild(wrapper);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  return wrapper;
}

async function sendAIMessage(rawText) {
  const message = String(rawText || "").trim();
  if (!message || aiSending) return;

  openAI();
  aiSending = true;
  aiChatInput.value = "";

  addAIMessage("user", message);
  const loading = addAIMessage("assistant", "Pensando...", "loading");

  try {
    if (!API_BASE_URL && window.location.hostname.endsWith("github.io")) {
      throw new Error("BACKEND_NOT_CONFIGURED");
    }

    const response = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: aiHistory.slice(-8)
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "AI_ERROR");
    }

    loading.remove();
    addAIMessage("assistant", result.reply);

    aiHistory.push(
      { role: "user", text: message },
      { role: "model", text: result.reply }
    );
    aiHistory = aiHistory.slice(-8);

    if (result.action === "open_cart") {
      openCart();
    }

    if (result.action === "add_to_cart" && result.product) {
      addToCart(result.product.id, result.product.size);
    }
  } catch (error) {
    loading.remove();

    const localReply = localAssistant(message);
    addAIMessage("assistant", localReply);
  } finally {
    aiSending = false;
  }
}

function localAssistant(message) {
  const lower = message.toLowerCase();

  const priceMatch = lower.match(/(?:menos de|maximo|máximo|hasta)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (priceMatch) {
    const limit = Number(priceMatch[1]);
    const options = products.filter(product => Number(product.price) <= limit);

    return options.length
      ? `Por ${money(limit)} o menos tienes: ${options.map(p => `${p.name} (${money(p.price)})`).join(", ")}.`
      : `No veo productos de ${money(limit)} o menos en el catálogo actual.`;
  }

  if (lower.includes("jean")) {
    const jeans = products.filter(product => product.name.toLowerCase().includes("jean"));
    if (jeans.length) {
      return jeans.map(product =>
        `${product.name}: ${money(product.price)}, tallas ${product.sizes.join(", ")}.`
      ).join("\n");
    }
  }

  if (lower.includes("carrito")) {
    openCart();
    return "Abrí tu carrito para que puedas revisar la selección.";
  }

  const matched = products.find(product => lower.includes(product.name.toLowerCase()));
  if (matched) {
    return `${matched.name} cuesta ${money(matched.price)} y está listado en tallas ${matched.sizes.join(", ")}.`;
  }

  return "Puedo ayudarte a buscar por producto, precio o talla. Prueba: “¿qué tienes por menos de $7?”";
}

/* ---------------------- UTILIDADES ---------------------- */
function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadProducts();
