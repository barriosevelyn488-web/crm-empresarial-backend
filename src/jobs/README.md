# Capa de Trabajos Asincronos (`src/jobs/`)

Esta carpeta aloja las colas, definiciones de contratos de carga (*job payloads*) y procesadores (*workers*) respaldados por **BullMQ** sobre **Redis 7**, conforme a **ADR-001** y **ADR-002**.

## Responsabilidades en la Arquitectura N-Capas

1. **Desacoplamiento del Event Loop HTTP:** Procesa fuera de banda importaciones masivas de prospectos (`.xlsx` con `exceljs` y `.csv` con `csv-parse`), reintentos de envios salientes de WhatsApp y alertas de recordatorios comerciales.
2. **Reutilizacion de Dominio:** Los procesadores en `src/jobs/` invocan exclusivamente servicios de negocio de `src/services/`. Queda prohibido duplicar reglas comerciales o ejecutar consultas `PrismaClient` directas desde los workers.
3. **Resiliencia e Idempotencia:** Cada trabajo define politicas explicitas de `attempts`, `backoff` exponencial y claves de idempotencia deterministas.

## Colas Planificadas para Siguientes Bloques

- `lead-import.queue.ts`: Procesamiento por lotes de archivos Excel/CSV aplicando la regla **CRM = Fuente de Verdad**.
- `whatsapp-outbound.queue.ts`: Despacho controlado de mensajes y plantillas a traves de `whatsapp.service.ts`.
- `followup-reminder.queue.ts`: Verificacion programada de seguimientos vencidos en zona horaria `America/Guatemala`.
