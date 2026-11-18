const config = window.JLSIZE_CONFIG || {};
const configuredApi = String(config.API_BASE_URL || "").replace(/\/$/, "");
const API_BASE_URL = configuredApi.includes("TU-BACKEND") ? "" : configuredApi;

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const logoutButton = document.getElementById("logoutButton");
const tabs = document.querySelectorAll(".tab");
const productsPanel = document.getElementById("productsPanel");
const contactsPanel = document.getElementById("contactsPanel");
const adminProducts = document.getElementById("adminProducts");
const contactsList = document.getElementById("contactsList");
const productFormWrap = document.getElementById("productFormWrap");
const productForm = document.getElementById("productForm");
const newProductButton = document.getElementById("newProductButton");
const cancelProductButton = document.getElementById("cancelProductButton");
const refreshContactsButton = document.getElementById("refreshContactsButton");

let token = sessionStorage.getItem("jlsize-admin-token") || "";
let products = [];

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginStatus.textContent = "Verificando...";

  const data = Object.fromEntries(new FormData(loginForm).entries());

  try {
    const response = await fetch(apiUrl("/api/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No fue posible iniciar sesión.");

    token = result.token;
    sessionStorage.setItem("jlsize-admin-token", token);
    loginStatus.textContent = "";
    showDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

logoutButton.addEventListener("click", () => {
  token = "";
  sessionStorage.removeItem("jlsize-admin-token");
  dashboardView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(item => item.classList.remove("active"));
    tab.classList.add("active");

    const selected = tab.dataset.tab;
    productsPanel.classList.toggle("hidden", selected !== "products");
    contactsPanel.classList.toggle("hidden", selected !== "contacts");

    if (selected === "contacts") loadContacts();
  });
});

newProductButton.addEventListener("click", () => {
  productForm.reset();
  productForm.elements.id.value = "";
  productFormWrap.classList.remove("hidden");
});

cancelProductButton.addEventListener("click", () => {
  productFormWrap.classList.add("hidden");
  productForm.reset();
});

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(productForm).entries());
  const id = data.id;

  const payload = {
    name: data.name,
    category: data.category,
    price: Number(data.price),
    sizes: data.sizes.split(",").map(item => item.trim()).filter(Boolean),
    image: data.image || "images/catalogo_prendas.jpg",
    description: data.description
  };

  const response = await fetch(
    id ? apiUrl(`/api/admin/products/${id}`) : apiUrl("/api/admin/products"),
    {
      method: id ? "PUT" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  if (!response.ok) {
    alert(result.error || "No se pudo guardar el producto.");
    return;
  }

  productFormWrap.classList.add("hidden");
  productForm.reset();
  await loadProducts();
});

refreshContactsButton.addEventListener("click", loadContacts);

async function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  await loadProducts();
}

async function loadProducts() {
  const response = await fetch(apiUrl("/api/products"));
  products = await response.json();
  renderProducts();
}

function renderProducts() {
  if (!products.length) {
    adminProducts.innerHTML = `<div class="empty">No hay productos.</div>`;
    return;
  }

  adminProducts.innerHTML = products.map(product => `
    <article class="admin-card">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
      <h3>${escapeHtml(product.name)}</h3>
      <p>${escapeHtml(product.description)}</p>

      <div class="card-meta">
        <span>${escapeHtml(product.category)}</span>
        <span>$${Number(product.price).toFixed(2)}</span>
      </div>

      <div class="card-actions">
        <button type="button" data-edit="${product.id}">Editar</button>
        <button class="danger" type="button" data-delete="${product.id}">Eliminar</button>
      </div>
    </article>
  `).join("");

  adminProducts.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => editProduct(Number(button.dataset.edit)));
  });

  adminProducts.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => deleteProduct(Number(button.dataset.delete)));
  });
}

function editProduct(id) {
  const product = products.find(item => Number(item.id) === id);
  if (!product) return;

  productForm.elements.id.value = product.id;
  productForm.elements.name.value = product.name;
  productForm.elements.category.value = product.category;
  productForm.elements.price.value = product.price;
  productForm.elements.sizes.value = product.sizes.join(", ");
  productForm.elements.image.value = product.image;
  productForm.elements.description.value = product.description;

  productFormWrap.classList.remove("hidden");
  productFormWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteProduct(id) {
  if (!confirm("¿Eliminar este producto?")) return;

  const response = await fetch(apiUrl(`/api/admin/products/${id}`), {
    method: "DELETE",
    headers: authHeaders()
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.error || "No se pudo eliminar.");
    return;
  }

  await loadProducts();
}

async function loadContacts() {
  contactsList.innerHTML = `<div class="empty">Cargando...</div>`;

  const response = await fetch(apiUrl("/api/admin/contacts"), {
    headers: authHeaders()
  });

  const result = await response.json();

  if (!response.ok) {
    contactsList.innerHTML = `<div class="empty">${escapeHtml(result.error || "No se pudieron cargar las solicitudes.")}</div>`;
    return;
  }

  if (!result.length) {
    contactsList.innerHTML = `<div class="empty">Todavía no hay solicitudes.</div>`;
    return;
  }

  contactsList.innerHTML = result.map(contact => `
    <article class="contact-card">
      <div class="contact-card-top">
        <div>
          <h3>${escapeHtml(contact.name)}</h3>
          <p>${escapeHtml(contact.email)} ${contact.phone ? `· ${escapeHtml(contact.phone)}` : ""}</p>
        </div>
        <time>${formatDate(contact.created_at)}</time>
      </div>

      <p><strong>${escapeHtml(contact.subject)}</strong></p>
      <p class="message">${escapeHtml(contact.message)}</p>

      <div class="contact-footer">
        <span class="badge ${contact.status === "Atendido" ? "atendido" : ""}">
          ${escapeHtml(contact.status)}
        </span>

        <button type="button" data-contact-id="${contact.id}" data-status="${contact.status === "Atendido" ? "Pendiente" : "Atendido"}">
          Marcar ${contact.status === "Atendido" ? "pendiente" : "atendido"}
        </button>
      </div>
    </article>
  `).join("");

  contactsList.querySelectorAll("[data-contact-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const response = await fetch(apiUrl(`/api/admin/contacts/${button.dataset.contactId}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status: button.dataset.status })
      });

      if (response.ok) loadContacts();
    });
  });
}

function formatDate(value) {
  return new Date(value).toLocaleString("es-PA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function restoreSession() {
  if (!token) return;

  try {
    const response = await fetch(apiUrl("/api/admin/session"), {
      headers: authHeaders()
    });

    if (!response.ok) throw new Error("Sesión vencida");
    await showDashboard();
  } catch {
    sessionStorage.removeItem("jlsize-admin-token");
    token = "";
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
}

restoreSession();
