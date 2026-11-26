import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const originsFromCsv = z
  .string()
  .min(1)
  .transform((raw) =>
    raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .refine(
    (origins) =>
      origins.length > 0 &&
      origins.every((origin) => {
        try {
          const parsed = new URL(origin);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      }),
    {
      message: 'CORS_ALLOWED_ORIGINS debe contener una o mas URLs HTTP/HTTPS validas separadas por comas.',
    },
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TZ: z.string().min(1).default('America/Guatemala'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
    FRONTEND_ORIGIN: z.url(),
    CORS_ALLOWED_ORIGINS: originsFromCsv,

    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
        'DATABASE_URL debe iniciar con postgresql:// o postgres://',
      ),
    DIRECT_URL: z
      .string()
      .min(1)
      .refine(
        (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
        'DIRECT_URL debe iniciar con postgresql:// o postgres://',
      ),

    REDIS_URL: z
      .string()
      .min(1)
      .refine(
        (val) => val.startsWith('redis://') || val.startsWith('rediss://'),
        'REDIS_URL debe iniciar con redis:// o rediss://',
      ),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET requiere al menos 32 caracteres.'),
    CSRF_SECRET: z.string().min(32, 'CSRF_SECRET requiere al menos 32 caracteres.'),
    WS_TICKET_SECRET: z
      .string()
      .min(32, 'WS_TICKET_SECRET requiere al menos 32 caracteres.'),
    INTEGRATION_API_KEY: z.string().min(16).optional(),

    WHATSAPP_PROVIDER: z.enum(['sandbox', 'cloud']).default('sandbox'),
    ALLOW_SANDBOX_IN_PROD: booleanFromString,
    WHATSAPP_CLOUD_API_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),
    WHATSAPP_APP_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === 'production' &&
      data.WHATSAPP_PROVIDER === 'sandbox' &&
      !data.ALLOW_SANDBOX_IN_PROD
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['WHATSAPP_PROVIDER'],
        message:
          'Kill-switch activo: WHATSAPP_PROVIDER=sandbox esta prohibido en produccion salvo que ALLOW_SANDBOX_IN_PROD=true.',
      });
    }

    if (data.NODE_ENV === 'production') {
      const secretsToInspect: Array<[keyof typeof data, string]> = [
        ['JWT_ACCESS_SECRET', data.JWT_ACCESS_SECRET],
        ['CSRF_SECRET', data.CSRF_SECRET],
        ['WS_TICKET_SECRET', data.WS_TICKET_SECRET],
      ];

      for (const [key, value] of secretsToInspect) {
        if (value.startsWith('CHANGE_ME') || value.startsWith('dev_local_')) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${String(key)} contiene un marcador de plantilla o desarrollo no permitido en produccion.`,
          });
        }
      }
    }

    if (data.WHATSAPP_PROVIDER === 'cloud') {
      const requiredCloudFields: Array<[keyof typeof data, string | undefined]> = [
        ['WHATSAPP_CLOUD_API_TOKEN', data.WHATSAPP_CLOUD_API_TOKEN],
        ['WHATSAPP_PHONE_NUMBER_ID', data.WHATSAPP_PHONE_NUMBER_ID],
        ['WHATSAPP_VERIFY_TOKEN', data.WHATSAPP_VERIFY_TOKEN],
        ['WHATSAPP_APP_SECRET', data.WHATSAPP_APP_SECRET],
      ];

      for (const [field, val] of requiredCloudFields) {
        if (!val || val.trim().length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `${String(field)} es obligatorio cuando WHATSAPP_PROVIDER=cloud.`,
          });
        }
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const formattedIssues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    process.stderr.write(
      `[FATAL] Error de validacion de variables de entorno al iniciar el servidor:\n${formattedIssues}\n`,
    );
    process.exit(1);
  }

  process.env.TZ = parsed.data.TZ;
  return parsed.data;
}

export const env: AppEnv = parseEnv(process.env);
