import fs from "node:fs";
import path from "node:path";

function parseEnvFile(contents: string) {
  const parsed = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    let value = rawLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed.set(key, value);
  }

  return parsed;
}

export function loadLocalEnv() {
  const candidates = [".env", ".env.local"];

  for (const candidate of candidates) {
    const absolutePath = path.resolve(process.cwd(), candidate);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const parsed = parseEnvFile(fs.readFileSync(absolutePath, "utf8"));
    for (const [key, value] of parsed.entries()) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}
