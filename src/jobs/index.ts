/**
 * Capa de Trabajos Asincronos (BullMQ sobre Redis 7).
 *
 * Punto de entrada modular para el registro e inicio controlado de colas
 * y procesadores en segundo plano (ADR-001 y ADR-002):
 * - Importacion asincrona de archivos Excel (.xlsx) y CSV (.csv)
 * - Cola de salida y reintentos de mensajeria WhatsApp
 * - Recordatorios programados de seguimiento comercial
 */

export const REGISTERED_QUEUE_NAMES = {
  LEAD_IMPORT: 'crm-lead-import',
  WHATSAPP_OUTBOUND: 'crm-whatsapp-outbound',
  FOLLOWUP_REMINDERS: 'crm-followup-reminders',
} as const;

export type RegisteredQueueName =
  (typeof REGISTERED_QUEUE_NAMES)[keyof typeof REGISTERED_QUEUE_NAMES];
