# Capa de Tiempo Real (`src/realtime/`)

Esta carpeta aloja el servidor de eventos **Socket.io**, la configuracion de escalado horizontal mediante `@socket.io/redis-adapter` y los emisores tipados hacia el cliente web, conforme a **ADR-003**.

## Responsabilidades en la Arquitectura N-Capas

1. **Autenticacion Estricta de Handshake:** Ninguna conexion WebSocket se acepta sin validar previamente un ticket efimero firmado con `WS_TICKET_SECRET` o credenciales verificadas de sesion activa.
2. **Segmentacion por Salas de Minimo Privilegio:**
   - `user:{id}`: Eventos privados del asesor propietario (nuevos prospectos asignados, mensajes entrantes de WhatsApp, alertas de seguimiento).
   - `role:admin`: Eventos globales de supervision (progreso de lotes BullMQ, prospectos sin asignar, metricas operativas en vivo).
3. **Frontera Limpia:** `src/realtime/` actua como adaptador de transporte saliente/entrante; toda mutacion de estado pasa por `src/services/`.
