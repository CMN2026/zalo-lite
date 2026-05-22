import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const source = resolve(__dirname, "../src/grpc/auth.proto");
const destinationDir = resolve(__dirname, "../dist/grpc");
const destination = resolve(destinationDir, "auth.proto");

if (!existsSync(source)) {
  console.error(`[copy-grpc-proto] Source file not found: ${source}`);
  process.exit(1);
}

mkdirSync(destinationDir, { recursive: true });
cpSync(source, destination);
console.log(`[copy-grpc-proto] Copied ${source} -> ${destination}`);
