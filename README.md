# Grow

Plataforma modular de ventas para growshops.

## Estructura

```
/grow
  /client      — Frontend público para el cliente final del growshop
  /admin       — Backoffice privado para el dueño del negocio
  /shared      — Tipos, constantes, utilidades y cliente de Supabase
```

## Desarrollo

```bash
# Instalar dependencias (raíz del monorepo)
npm install

# Levantar cliente público (puerto 5173)
npm run dev:client

# Levantar backoffice (puerto 5174)
npm run dev:admin
```

Cada aplicación es independiente y se despliega por separado en Cloudflare Pages. No existe ninguna dependencia entre `client` y `admin` a nivel de componentes o enrutamiento.

## Filosofía

Ningún dato de negocio específico está hardcodeado en el código. Todo vive en Supabase como datos de tablas. Las excepciones deliberadas son los colores del tema (variables CSS en `index.css`), el logo y las reseñas de ejemplo, que se personalizan por implementación (ver `docs/arquitectura/arquitectura-v13.md`, sección 1.2). Este monorepo se entrega como un producto único y autónomo, listo para ser adquirido y puesto en producción por cualquier growshop.
