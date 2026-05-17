import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  MASSIVE_API_KEY: z.string(),
  MASSIVE_BASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function loadEnv(): Env {
  if (env) return env;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Environment validation failed:", parsed.error.format());
    throw new Error("Invalid environment variables");
  }

  env = parsed.data;
  return env;
}

export function getEnv(): Env {
  if (!env) {
    return loadEnv();
  }
  return env;
}
