# Grano y Aroma

Plataforma de ecommerce y gestión para un negocio de café de especialidad (torrefactora y cafetería) en Sucre, Bolivia.

Proyecto de la materia **Ingeniería de Software** — USFX, Grupo 6:
Chambi Condori Janet · Calatayud Mamani Alex Josue · Quispe Anagua Jhon Christian.

El documento de visión está en [`docs/Vision_del_Proyecto_G6.pdf`](docs/Vision_del_Proyecto_G6.pdf).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, export estático), React 19, TypeScript, Tailwind CSS 4, Zustand |
| Backend | Supabase: PostgreSQL, Auth, Realtime (pujas en vivo), RLS y funciones SQL (RPC) |
| Despliegue | Render (Static Site) |

**¿Por qué export estático?** El frontend habla directo con Supabase, así que no necesita un servidor propio. Las reglas de negocio críticas (stock, pujas, cierre de subastas) viven en funciones SQL dentro de Postgres, protegidas con Row Level Security.

## Módulos

Tienda en línea · Club de suscripción · Subastas de micro-lotes · Punto de venta (POS) · Bodega e inventario · Producción y tueste · Proveedores · Logística · Fidelización · Administración y reportes.

## Cómo correrlo en local

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # completa las variables de Supabase
npm run dev                  # http://localhost:3000
```

Otros comandos:

```bash
npm run build   # genera el sitio estático en out/
npm run lint    # ESLint
```

## Estructura

```
src/
  app/          páginas (App Router): /, admin, club, erp, logistica, pos, subastas
  components/   componentes de UI
  lib/          tipos y utilidades
  store/        estado del cliente (Zustand)
docs/           documento de visión y referencias de diseño
```

## Forma de trabajo

- `main` siempre debe compilar.
- Cada funcionalidad va en su propia rama (`feat/catalogo`, `feat/subastas`, `fix/...`) y entra a `main` por Pull Request revisado por otro integrante.
- Los mensajes de commit van en español y describen el cambio.

## Estado

🚧 En desarrollo. Base del frontend tomada del prototipo del Laboratorio 8; los datos todavía son de prueba y se reemplazarán por Supabase.
