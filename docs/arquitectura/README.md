# Documentos de arquitectura

Conversión a Markdown de los documentos `Grow_Arquitectura_vN.docx`. Cada versión es **incremental**: documenta lo que cambió y remite a versiones anteriores ("sin cambios respecto a vX") para el resto.

| Archivo | Contenido propio |
|---|---|
| [arquitectura-v6.md](arquitectura-v6.md) | Base más completa: filosofía, modelo de negocio, multi-tenancy, convención de estilos, client (pages, AlertaBanner, ProductDetailPage, ReviewsCarousel), admin (OrdersPage, Edge Function, SettingsPage), variables de entorno, lección sobre verificar el trabajo de agentes |
| [arquitectura-v7.md](arquitectura-v7.md) | Reorganización de `client/src/components/` por dominio, auditoría de calidad, trigger de transiciones de pedido, `useConfiguracionTienda`, `useModalAccesible` duplicado a propósito, regeneración de `database.types.ts` |
| [arquitectura-v8.md](arquitectura-v8.md) | Autenticación de clientes, tablas `admins`/`clientes`, `is_admin()`, `pedidos.usuario_id`, `MiCuentaPage`, endurecimiento de `ProtectedRoute` en admin |
| [arquitectura-v12.md](arquitectura-v12.md) | Versión vigente. Incluye todo lo de v9, v10 y v11 (MiCuenta con modal de detalle, confirmación de checkout, vencimiento del mensaje de alerta con pg_cron, CustomersPage + Excel, normalización responsive del admin, despliegue en Vercel) más el keep-alive de Supabase |

v9, v10 y v11 no se incluyen porque su contenido quedó contenido íntegramente en v12. Las versiones v1–v5 no están disponibles.
