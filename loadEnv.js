import { existsSync } from "fs";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const candidates = [join(scriptDir, ".env"), join(process.cwd(), ".env")];

for (const envPath of candidates) {
  if (!existsSync(envPath)) continue;
  const result = config({ path: envPath, override: true });
  if (!result.error) {
    console.log(`[env] .env 로드: ${envPath}`);
    break;
  }
  console.warn("[env] .env 읽기 실패:", result.error?.message);
}
