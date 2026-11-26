# ADR-001: Arquitectura Cliente-Servidor en N-Capas (3-Tier) con Trabajos Asincronos

- **Estado:** Aceptado
- **Fecha:** 2026-11-26
- **Decisores:** Arquitectura de Software, Tech Lead Backend, Product Owner
- **Ambito:** `crm-empresarial-backend`

## 1. Contexto

El sistema CRM Comercial Empresarial atiende la operacion comercial centralizada de una sola organizacion en Guatemala (modelo *single-company* / *single-tenant*). Sus requisitos operativos incluyen:

1. Exposicion de una API RESTful versionada (`/api/v1`) consumida por una aplicacion web independiente (`crm-empresarial-frontend`) y conectores externos (Google Apps Script, bots de captura y webhooks de WhatsApp).
2. Reglas de negocio comerciales estrictas: deduplicacion por telefono E.164 (`+502`), asignacion de vendedores, embudo de ventas auditable de 5 etapas, recordatorios y control de acceso basado en roles (`ADMIN` y `VENDEDOR`, agrupados por equipos comerciales).
3. Procesamiento fuera de banda para cargas masivas de archivos `.xlsx`/`.csv` y envios de mensajeria sin degradar la latencia del Event Loop de Node.js.
4. Notificaciones en tiempo real hacia asesores y supervisores conectados.

## 2. Decision

Se adopta una **Arquitectura Cliente-Servidor desacoplada (3-Tier)** donde el servidor backend implementa internamente una **Arquitectura en N-Capas estricta** apoyada por colas asincronas en **BullMQ (Redis)** y persistencia relacional en **PostgreSQL 16 (Prisma ORM)**:

1. **Capa de Transporte y Enrutamiento (`src/routes/`, `src/middlewares/`, `src/realtime/`):**
   Gestiona protocolo HTTP/WebSocket, trazabilidad (`X-Request-Id`), cabeceras de seguridad (`Helmet`, `CORS`), limites de tasa (`express-rate-limit`), autenticacion/autorizacion y validacion estructural de entrada mediante esquemas `Zod`.
2. **Capa de Controladores (`src/controllers/`):**
   Traduce peticiones HTTP validadas en invocaciones a servicios de negocio y formatea respuestas HTTP estandarizadas (`200`, `201`, `4xx`, `5xx`). Prohibido incluir SQL, consultas Prisma o logica de dominio.
3. **Capa de Servicios de Dominio (`src/services/`, `src/jobs/`):**
   Concentra las reglas de negocio, orquestacion transaccional, politicas de permisos granulares, normalizacion telefonica y despacho de trabajos asincronos o eventos Socket.io. Prohibido acoplarse a objetos `req`/`res` de Express.
4. **Capa de Acceso a Datos (`src/repositories/`):**
   Encapsula todas las consultas hacia PostgreSQL (`PrismaClient`) y operaciones de infraestructura directa contra Redis. Ningun controlador ni ruta puede importar `PrismaClient` directamente.
5. **Capa Transversal (`src/config/`, `src/utils/`):**
   Validacion de entorno en arranque (`env.ts`), jerarquia tipada de errores (`AppError`), registro estructurado con redaccion de datos sensibles (`pino`) y documentacion OpenAPI 3.1.

## 3. Alternativas Evaluadas y Motivos de Descarte

### 3.1 Monolito Acoplado (MVC tradicional / Fullstack SSR sin separacion de capas)
- **Motivo de descarte:** Mezclar consultas de base de datos, validaciones y renderizado o controladores HTTP genera controladores obesos dificiles de probar de forma aislada, impide reutilizar la misma logica de negocio entre endpoints REST, webhooks y workers de BullMQ, y acopla el ciclo de despliegue de UI con el motor de ingesta 24/7.

### 3.2 Arquitectura Hexagonal Pura / DDD Tactico Complejo (Ports & Adapters estrictos)
- **Motivo de descarte:** Para el dominio acotado de un CRM comercial de una unica empresa, exigir interfaces abstractas, fabricas de adaptadores, agregados complejos y multiples mappers entre entidades de dominio y modelos ORM introduce una sobrecarga de codigo repetitivo (*boilerplate*) que ralentiza la entrega sin aportar valor real, dado que PostgreSQL es el motor relacional definitivo del sistema.

### 3.3 Microservicios Distribuidos
- **Motivo de descarte:** Dividir autenticacion, leads, WhatsApp, importaciones y reportes en despliegues independientes multiplicaria costos operativos en infraestructura (Dokploy/contenedores), latencia de red interna, complejidad de transacciones distribuidas (Sagas) y esfuerzo de observabilidad para un volumen transaccional que PostgreSQL 16 y Node.js manejan holgadamente en un unico servicio modular escalable horizontalmente.

## 4. Consecuencias

### Positivas
- Flujo de dependencias unidireccional predecible y auditable mediante revision de codigo y pruebas automatizadas.
- Reutilizacion directa de `src/services/` tanto desde controladores HTTP como desde procesadores asincronos en `src/jobs/`.
- Despliegue sencillo y economico en contenedores Docker manteniendo separacion clara entre Frontend SPA, Backend API/Workers, PostgreSQL y Redis.

### Compromisos y Mitigaciones
- **Riesgo de saltar capas por premura:** Se mitiga mediante revisiones obligatorias en el Pull Request Template y separacion explicita de directorios (`controllers`, `services`, `repositories`).
- **Escalado de Workers:** Los workers de BullMQ viven en el mismo repositorio y comparten contratos TypeScript, pudiendo ejecutarse en el mismo proceso en desarrollo o como contenedor dedicado con el mismo artefacto compilado en produccion.
