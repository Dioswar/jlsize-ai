# JLSIZE — Proyecto Final

Aplicación web full stack para un emprendimiento de moda circular / second hand.

## Funcionalidades

- Landing responsive de la marca.
- Catálogo de productos con filtros, precios y tallas.
- Carrito de compras con persistencia en `localStorage`.
- Pedido por WhatsApp.
- Formulario de contacto registrado en base de datos.
- Panel administrativo con autenticación.
- Crear, editar y eliminar productos.
- Consultar y gestionar solicitudes de clientes.
- Chatbot/recomendador JLSIZE AI integrado con Gemini.
- Backend con Node.js y Express.
- Base de datos SQLite.
- Frontend preparado para GitHub Pages.
- Backend preparado para despliegue como servicio Node.

## Estructura

```text
JLSIZE/
├── docs/
│   ├── index.html
│   ├── admin.html
│   ├── styles.css
│   ├── admin.css
│   ├── app.js
│   ├── admin.js
│   ├── config.js
│   ├── data/
│   └── images/
├── backend/
│   ├── server.js
│   ├── database.js
│   ├── auth.js
│   ├── package.json
│   ├── .env.example
│   └── data/
├── render.yaml
└── .gitignore
```

## Ejecutar localmente

Requiere Node.js 22.13 o superior.

```powershell
cd backend
npm.cmd install
```

Crea `backend/.env` tomando como base `backend/.env.example` y configura tus credenciales administrativas y tu clave de Gemini.

Luego ejecuta:

```powershell
npm.cmd start
```

Abre:

```text
http://localhost:3000
```

Panel administrativo:

```text
http://localhost:3000/admin.html
```

## Publicación

El frontend está en `docs/` para poder publicarse desde GitHub Pages. El backend debe desplegarse como servicio Node.js y su URL se configura en `docs/config.js`.

## Seguridad

- `backend/.env` está excluido por `.gitignore`.
- La clave de Gemini no se expone en el frontend.
- El panel administrativo requiere variables de entorno para usuario y contraseña.


## Contacto oficial

- Instagram: @jisizee
- Correo: jisizebrand@gmail.com
