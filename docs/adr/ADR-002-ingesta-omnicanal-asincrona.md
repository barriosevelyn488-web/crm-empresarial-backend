# ADR-002: Ingesta Omnicanal Asincrona y Regla CRM como Fuente de Verdad

- **Estado:** Aceptado
- **Fecha:** 2026-11-26
- **Decisores:** Arquitectura de Software, Tech Lead Backend, Ingenieria de Datos
- **Ambito:** `crm-empresarial-backend` (`src/services/`, `src/jobs/`, `integrations/google-sheets/`)

## 1. Contexto

La captacion comercial de prospectos (*leads*) ingresa desde cuatro canales heterogeneos:

1. **Bot / Webhooks de Captura:** Peticiones HTTP POST automatizadas desde formularios digitales, campanas o bots conversacionales.
2. **Google Sheets (`Code.gs`):** Hojas de calculo compartidas con mercadeo o recepcion que sincronizan filas nuevas o editadas hacia `/api/v1/integrations/sheets/sync`.
3. **Archivos Excel (`.xlsx`):** Cargas operativas de bases comerciales historicas o ferias de negocios.
4. **Archivos Valores Separados por Comas (`.csv`):** Importaciones masivas basadas en la plantilla oficial `docs/templates/plantilla_importacion_leads_gt.csv`.

Históricamente, en equipos comerciales que combinan hojas de calculo y mensajeria manual, ocurren tres problemas graves: duplicidad de prospectos con distinto formato telefonico (`5555-1234`, `50255551234`, `+502 5555 1234`), sobrescritura accidental de etapas avanzadas cuando se vuelve a subir un archivo externo, y bloqueo del servidor HTTP al procesar miles de filas sincronamente.

## 2. Decision

### 2.1 Regla Rectora: El CRM es la Unica Fuente de Verdad (Single Source of Truth)
Toda fuente externa (Google Sheets, Excel, CSV o Bot) actua **exclusivamente como canal de entrada (ingesta)**, nunca como maestro de estado comercial:

1. **Normalizacion Canonica E.164:** Todo numero telefonico entrante se procesa con `libphonenumber-js` usando region por defecto `GT` (`+502`). Si el telefono no es valido ni recuperable, la fila se rechaza y se registra en el reporte de errores de importacion sin abortar el lote completo.
2. **Proteccion contra Regresion de Embudo:** Si un prospecto identificado por su telefono canonico (o correo secundario cuando aplique politica de cruce) ya existe en el CRM y fue gestionado (`CONTACTADO`, `NEGOCIACION`, `CERRADO_GANADO`, `CERRADO_PERDIDO`), una re-importacion desde Sheets/Excel/CSV **jamas retrocede su etapa ni reasigna su vendedor propietario (`vendedor_id`)**. En su lugar, registra un evento auditable de re-interaccion en la bitacora inmutable del prospecto y enriquece unicamente campos vacios no destructivos.
3. **Idempotencia:** Los webhooks y sincronizaciones de Google Sheets incluyen clave de idempotencia (`X-Idempotency-Key` o hash determinista de lote + fila) almacenada temporalmente en Redis/PostgreSQL para evitar duplicados ante reintentos de red.

### 2.2 Pipeline Tecnico por Canal
- **Bot Webhook:** Validacion Zod + autenticacion por firma HMAC o API Key dedicada -> persistencia transaccional rapida o encolado inmediato -> respuesta `202 Accepted` / `201 Created`.
- **Google Sheets (`integrations/google-sheets/Code.gs`):** Autenticacion mediante cabecera `X-Integration-Key` comparada en tiempo constante (`crypto.timingSafeEqual`) -> validacion por lote acotado -> respuesta estructurada con conteo de creados, fusionados y rechazados.
- **Excel (`.xlsx`) y CSV (`.csv`):** Carga controlada con `multer` v2 (limite estricto de tamano y validacion de MIME/extension), lectura segura mediante `exceljs` y `csv-parse` respectivamente, y delegacion a una cola **BullMQ (`lead-import`)** cuando el lote supera el umbral sincrono, reportando avance en tiempo real al administrador via `Socket.io`.

## 3. Alternativas Evaluadas y Motivos de Descarte

- **Sincronizacion Bidireccional con Google Sheets:** Descartada por condiciones de carrera (*race conditions*), falta de control transaccional ACID en hojas editadas manualmente por terceros y riesgo de fuga de datos comerciales sensibles fuera del perimetro RBAC del CRM.
- **Libreria `xlsx` (SheetJS CE de npm):** Descartada por historial de vulnerabilidades conocidas sin parche en el registro publico de npm (`Prototype Pollution` / `ReDoS`); se estandariza `exceljs` junto con `csv-parse`.
- **Procesamiento HTTP 100% Sincrono de Archivos Grandes:** Descartado porque bloquea el hilo principal de Node.js, dispara timeouts `504 Gateway Timeout` en proxies reversos y degrada las peticiones interactivas de los asesores.

## 4. Consecuencias

- Cero perdida de historial comercial ante recargas de bases de mercadeo.
- Auditoria completa de cada lote importado (usuario ejecutor, canal, total de filas, insertados, omitidos por duplicidad protegida y detalle de filas invalidas por linea).
- Cumplimiento de cadena de suministro limpia sin dependencias con CVEs de severidad alta o critica.
