const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  REDIS_URL: z.preprocess((value) => value || undefined, z.string().url().optional()),
  NORI_REDIS_URL: z.preprocess((value) => value || undefined, z.string().url().optional()),
  NORI_REDIS_CA_FILE: z.string().optional(),
  NORI_REDIS_CERT_FILE: z.string().optional(),
  NORI_REDIS_KEY_FILE: z.string().optional(),
  NORI_REDIS_TLS_SERVERNAME: z.string().optional(),
  NORI_REDIS_CA_B64: z.string().optional(),
  NORI_REDIS_CERT_B64: z.string().optional(),
  NORI_REDIS_KEY_B64: z.string().optional(),
  REDIS_CA_FILE: z.string().optional(),
  REDIS_CERT_FILE: z.string().optional(),
  REDIS_KEY_FILE: z.string().optional(),
  REDIS_TLS_SERVERNAME: z.string().optional(),
  REDIS_CA_B64: z.string().optional(),
  REDIS_CERT_B64: z.string().optional(),
  REDIS_KEY_B64: z.string().optional(),
  REDIS_PREFIX: z.string().min(1).default('royli:clash:v1'),
  REDIS_ENABLED: z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    return !['0', 'false', 'off', 'no', 'nao'].includes(String(value ?? '1').trim().toLowerCase());
  }, z.boolean()).default(true),
  CLASH_ROYALE_API_KEY: z.string().optional(),
  CLASH_ROYALE_API_BASE_URL: z.string().url().default('https://api.clashroyale.com/v1'),
  CLASH_RELAY_BASE_URL: z.preprocess((value) => value || undefined, z.string().url().optional()),
  CLASH_RELAY_TOKEN: z.string().optional(),
  RELAY_OWNER_USER_ID: z.string().optional(),
  RELAY_IP_CHECK_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  EPHEMERAL_RESPONSES: z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'on', 'yes', 'sim'].includes(String(value ?? '1').trim().toLowerCase());
  }, z.boolean()).default(true),
  PROFILE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  BATTLELOG_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  PANEL_REFRESH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  PANEL_TTL_SECONDS: z.coerce.number().int().positive().default(86400)
}).superRefine((data, context) => {
  const relayConfigured = Boolean(data.CLASH_RELAY_BASE_URL || data.CLASH_RELAY_TOKEN);
  if (relayConfigured && (!data.CLASH_RELAY_BASE_URL || !data.CLASH_RELAY_TOKEN)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['CLASH_RELAY_TOKEN'], message: 'CLASH_RELAY_BASE_URL e CLASH_RELAY_TOKEN devem ser configurados juntos.' });
  }
  if (!relayConfigured && !data.CLASH_ROYALE_API_KEY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['CLASH_ROYALE_API_KEY'], message: 'Configure o relay ou a chave direta da API do Clash Royale.' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Configuração inválida: ${details}`);
}

module.exports = parsed.data;
