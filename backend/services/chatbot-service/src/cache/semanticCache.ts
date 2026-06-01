import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const client = createClient({ url: REDIS_URL });
let ready = false;
client.on("error", () => {});
client
  .connect()
  .then(() => {
    ready = true;
  })
  .catch(() => {
    ready = false;
  });

function key(hash: string) {
  return `semcache:${hash}`;
}

export async function getCachedResponse(hash: string): Promise<string | null> {
  if (!ready) return null;
  try {
    const v = await client.get(key(hash));
    return v;
  } catch (e) {
    return null;
  }
}

export async function setCachedResponse(
  hash: string,
  text: string,
  ttlSec = 3600,
): Promise<void> {
  if (!ready) return;
  try {
    await client.setEx(key(hash), ttlSec, text);
  } catch (e) {
    /* ignore */
  }
}
