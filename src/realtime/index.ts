/**
 * Capa de Tiempo Real (Socket.io + @socket.io/redis-adapter).
 *
 * Define las convenciones canonicas de salas segmentadas bajo principio de
 * minimo privilegio conforme a ADR-003:
 * - user:{id}: Eventos exclusivos del asesor propietario.
 * - role:admin: Eventos operativos y supervision global.
 */

export const REALTIME_ADMIN_ROOM = 'role:admin' as const;

export function buildUserRoomName(userId: string): `user:${string}` {
  return `user:${userId}`;
}
