import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    const [key, value] = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadLocalEnvFiles(): void {
  const apiRoot = path.resolve(__dirname, "..", "..");
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(apiRoot, ".env")
  ];

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    loadEnvFile(candidate);
  }
}

loadLocalEnvFiles();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  PORT: z.coerce.number().int().positive().optional().default(4000),
  DATA_PROVIDER: z.enum(["memory", "firestore"]).optional().default("memory"),
  MOCK_AUTH_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  FIREBASE_PROJECT_ID: z.string().optional()
});

export type EnvConfig = z.infer<typeof envSchema>;

export const env: EnvConfig = envSchema.parse(process.env);
