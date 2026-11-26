## Resumen del Cambio

Describa de forma concisa que problema resuelve este Pull Request, a que bloque funcional o ADR corresponde y que modulos fueron intervenidos.

- **Bloque / Ticket:**
- **ADR relacionado:**

## Alcance Tecnico

- **Archivos o capas modificadas (`routes`, `middlewares`, `controllers`, `services`, `repositories`, `jobs`, `realtime`):**
- **Fuera de alcance explicitamente excluido:**

## Checklist Oficial de los 9 Pilares de Ingenieria

Marque cada pilar unicamente despues de verificar evidencia real en este cambio:

- [ ] **Pilar 1 - Arquitectura Cliente-Servidor en N-Capas:** Flujo estricto `routes -> controllers -> services -> repositories`. Ningun controlador ejecuta consultas `PrismaClient` ni contiene reglas de negocio; ningun servicio depende de `req`/`res`.
- [ ] **Pilar 2 - Tipado Estricto TypeScript (`strict: true`, cero `any`):** `npm run typecheck` y `npm run lint` pasan con cero errores y cero advertencias (`@typescript-eslint/no-explicit-any: "error"`).
- [ ] **Pilar 3 - Contratos Validados (`Zod` + `OpenAPI 3.1`):** Toda entrada (`body`, `query`, `params`, variables de entorno) se valida con `Zod` y los endpoints publicos/internos mantienen sincronizada su especificacion en `/api/docs.json`.
- [ ] **Pilar 4 - Ciberseguridad Aplicativa (OWASP Top 10):** Cabeceras `Helmet` activas, `CORS` con lista blanca explicita, `express-rate-limit` configurado, secretos fuera del codigo fuente y validacion estricta de permisos por rol.
- [ ] **Pilar 5 - Persistencia Relacional e Integridad (`PostgreSQL 16` + `Prisma 6`):** Esquema consistente, indices adecuados, migraciones reproducibles, zona horaria `America/Guatemala` y transacciones atomicas cuando se modifican multiples tablas.
- [ ] **Pilar 6 - Asincronia y Tiempo Real (`BullMQ` + `Socket.io`):** Operaciones pesadas (importaciones `.xlsx`/`.csv`, lotes o reintentos) delegadas a colas en Redis sin bloquear el Event Loop; eventos WebSocket segmentados en salas `user:{id}` y `role:admin`.
- [ ] **Pilar 7 - Ingesta Omnicanal y Fuente de Verdad:** Normalizacion telefonica E.164 (`+502` con `libphonenumber-js`), idempotencia en webhooks/integraciones y proteccion contra regresion de etapas comerciales existentes.
- [ ] **Pilar 8 - Observabilidad y Manejo Estandarizado de Errores:** Uso exclusivo de jerarquia `AppError`, respuestas `{ success: false, error: { code, message, requestId } }` y logs estructurados con `pino` redactando cookies, tokens y contrasenas.
- [ ] **Pilar 9 - Cadena de Suministro, Pruebas y Documentacion Viva:** Librerias verificadas en registro oficial npm (`npm audit --omit=dev --audit-level=high` limpio), pruebas automatizadas `Vitest + Supertest` en verde y documentacion (`README.md` / `ADR`) sincronizada.

## Definition of Done (DoD)

- [ ] `npm run lint` ejecutado sin errores.
- [ ] `npm run typecheck` ejecutado sin errores.
- [ ] `npm run test` ejecutado con el 100% de pruebas aprobadas contra infraestructura real.
- [ ] `npm run build` compila limpiamente en `dist/`.
- [ ] `npm audit --omit=dev --audit-level=high` reporta 0 vulnerabilidades altas o criticas.
- [ ] Sin secretos expuestos, archivos `.env`, bases `.xlsx`/`.csv` reales ni artefactos temporales incluidos en el diff.
- [ ] Listo para revision del Filtro Humano.

## Evidencia de Verificacion

Pegue aqui la salida resumida de los comandos de verificacion ejecutados localmente:

```text
# Pegar salida real de lint, typecheck, test, build y audit
```
