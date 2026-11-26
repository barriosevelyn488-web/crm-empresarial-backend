# ADR-003: Comunicacion en Tiempo Real (Socket.io) y Proveedor Conmutable de WhatsApp

- **Estado:** Aceptado
- **Fecha:** 2026-11-26
- **Decisores:** Arquitectura de Software, Tech Lead Backend, Ciberseguridad
- **Ambito:** `crm-empresarial-backend` (`src/realtime/`, `src/services/whatsapp.service.ts`, `src/config/env.ts`)

## 1. Contexto

La operacion comercial diaria requiere reaccion inmediata cuando ingresa un mensaje de WhatsApp, se asigna un nuevo prospecto o termina una importacion masiva. Adicionalmente, el equipo de desarrollo y QA necesita construir, probar y demostrar flujos completos de conversacion de WhatsApp en entornos locales y de preproduccion sin depender de plantillas preaprobadas ni consumir saldo o numeros productivos de Meta WhatsApp Cloud API, pero garantizando que el paso a produccion solo requiera configuracion por variables de entorno.

## 2. Decision

### 2.1 Pasarela de Tiempo Real con `Socket.io` y Adaptador Redis
Se implementa un servidor `Socket.io` acoplado al servidor HTTP principal y respaldado por `@socket.io/redis-adapter` (usando conexiones dedicadas `pubClient`/`subClient` en `ioredis`):

1. **Autenticacion en el Handshake:** Ningun cliente anonimo puede suscribirse a eventos. El handshake verifica un ticket efimero firmado con `WS_TICKET_SECRET` o la sesion autenticada del usuario antes de aceptar la conexion.
2. **Segmentacion Estricta por Salas (Rooms):**
   - `user:{id}`: Sala privada exclusiva de cada usuario activo. Recibe asignaciones de prospectos propios, mensajes entrantes de sus conversaciones asignadas y alertas de seguimiento vencido.
   - `role:admin`: Sala reservada para usuarios con rol administrativo/supervision. Recibe metricas operativas en vivo, progreso de lotes BullMQ (`lead-import`), alertas de webhooks fallidos y prospectos sin asignar.
3. **Principio de Minimo Privilegio en Eventos:** Un asesor nunca recibe por WebSocket payloads de prospectos pertenecientes a otro asesor.

### 2.2 Servicio de WhatsApp Conmutable (`sandbox` | `cloud`)
Se disena `whatsapp.service.ts` bajo el patron *Strategy / Provider Adapter* controlado por la variable de entorno validada `WHATSAPP_PROVIDER`:

1. **Contrato Unificado (`IWhatsAppProvider`):**
   Define operaciones tipadas para envio de texto libre dentro de ventana de 24 horas, envio de plantillas estructuradas, verificacion de webhook y normalizacion de estados de entrega (`sent`, `delivered`, `read`, `failed`).
2. **Modo `sandbox` (`WHATSAPP_PROVIDER=sandbox`):**
   Simula el ciclo de envio y recepcion de manera determinista en base de datos local, genera identificadores sinteticos trazables (`wamid.sandbox.*`), registra logs estructurados y emite eventos `Socket.io` hacia las salas correspondientes sin realizar llamadas HTTP externas.
3. **Modo `cloud` (`WHATSAPP_PROVIDER=cloud`):**
   Integra con Meta Graph API oficial utilizando `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, verificacion de reto `WHATSAPP_VERIFY_TOKEN` y validacion criptografica obligatoria de firma `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`.
4. **Compuerta de Seguridad en Produccion (Kill-Switch):**
   En `src/config/env.ts`, si `NODE_ENV === 'production'` y `WHATSAPP_PROVIDER === 'sandbox'`, el servidor aborta inmediatamente el arranque salvo que `ALLOW_SANDBOX_IN_PROD === true` haya sido habilitado de forma explicita y consciente (por ejemplo, en un entorno demo controlado). Del mismo modo, si `WHATSAPP_PROVIDER === 'cloud'`, Zod exige que las cuatro credenciales de Meta esten presentes y no vacias.

## 3. Alternativas Evaluadas y Motivos de Descarte

- **Short Polling HTTP cada N segundos desde el Frontend:** Descartado por carga innecesaria sobre PostgreSQL y latencia perceptible en atencion de mensajes entrantes.
- **Server-Sent Events (SSE) puros:** Descartados frente a `Socket.io` debido a que `Socket.io` ofrece reconexion automatica con *exponential backoff*, gestion nativa de salas (`user:{id}`, `role:admin`) y escalado horizontal inmediato con `@socket.io/redis-adapter`.
- **Mocks ad-hoc con `if (isDev)` dispersos en controladores:** Descartados porque ensucian la capa de negocio y provocan errores silenciosos en produccion; el patron proveedor con kill-switch en `env.ts` centraliza el contrato y blinda el despliegue.

## 4. Consecuencias

- Desarrollo y pruebas de integracion 100% reproducibles sin conexion a terceros en modo `sandbox`.
- Transicion limpia a Meta WhatsApp Cloud API cambiando variables de entorno auditadas en el arranque.
- Escalabilidad horizontal preparada desde el primer bloque gracias al adaptador Redis de `Socket.io`.
