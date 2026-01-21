# GuitarShop Frontend (React + Vite)

Frontend del sistema GuitarShop.

## Requisitos

- Node.js 20.x
- Backend corriendo en `http://localhost:3000`

## Variables de entorno

Copia `.env.example` a `.env` y ajusta si tu backend corre en otro puerto. En Netlify
debes configurar `VITE_API_BASE_URL` como variable de entorno del sitio (por ejemplo
`https://tu-backend.tld/api`).

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Instalación y ejecución

```bash
npm install
npm run dev
```

Servidor por defecto: http://localhost:5173

## Netlify (SPA + redirecciones)

El deploy incluye `public/_redirects` con la regla `/*    /index.html   200` para evitar
404 al refrescar rutas del SPA. Si necesitas rutas adicionales puedes editar ese archivo.
      // Remove tseslint.configs.recommended and replace with this
