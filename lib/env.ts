import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional().default("postgresql://postgres:postgres@localhost:5432/movieshub"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32)
    .optional()
    .default("dev-nextauth-secret-change-me-1234567890"),
  NEXTAUTH_URL: z.string().url().optional().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  AI_API_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_SECRET_KEY: z.string().optional().default(""),
  PAYMENT_KEY_ID: z.string().optional(),
  PAYMENT_KEY_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  MEDIA_SIGNING_SECRET: z.string().optional(),
  DEMO_MODE: z
    .enum(["true", "false", ""])
    .default("true")
    .transform((value) => value === "true"),
});

const parsedEnv = baseEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid server environment configuration: ${parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join(", ")}`
  );
}

const env = parsedEnv.data;
const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

if (isProduction) {
  const requiredValues = [
    ["DATABASE_URL", env.DATABASE_URL],
    ["NEXTAUTH_SECRET", env.NEXTAUTH_SECRET],
    ["NEXTAUTH_URL", env.NEXTAUTH_URL],
    ["NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL],
    ["PAYMENT_KEY_ID", env.PAYMENT_KEY_ID],
    ["PAYMENT_KEY_SECRET", env.PAYMENT_KEY_SECRET],
    ["PAYMENT_WEBHOOK_SECRET", env.PAYMENT_WEBHOOK_SECRET],
    ["MEDIA_SIGNING_SECRET", env.MEDIA_SIGNING_SECRET],
  ] as const;

  const missing = requiredValues.filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Production environment is missing required variables: ${missing
        .map(([name]) => name)
        .join(", ")}`
    );
  }

  if (env.DEMO_MODE) {
    throw new Error("DEMO_MODE must be disabled in production.");
  }
}

export const env = {
  ...env,
  NODE_ENV: nodeEnv,
};

export const isProductionEnv = isProduction;
export const isDemoModeEnabled = env.DEMO_MODE;

export default env;
