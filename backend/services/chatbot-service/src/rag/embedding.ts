const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || "";
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || "1536");

function normalizeText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index++) {
    hash ^= token.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) >>> 0;
}

export function localTextEmbedding(
  text: string,
  dimensions = EMBEDDING_DIMENSIONS,
) {
  const vector = new Array<number>(dimensions).fill(0);
  const normalized = normalizeText(text);
  if (!normalized) return vector;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const ngrams: string[] = [...tokens];
  for (let index = 0; index < tokens.length - 1; index++) {
    ngrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }

  for (const token of ngrams) {
    const bucket = hashToken(token) % dimensions;
    vector[bucket] += 1;
  }

  const norm =
    Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export async function buildTextEmbedding(text: string): Promise<number[]> {
  if (EMBEDDING_API_URL) {
    try {
      const response = await fetch(EMBEDDING_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, dimensions: EMBEDDING_DIMENSIONS }),
      });
      if (response.ok) {
        const payload = await response.json();
        const embedding = payload?.embedding || payload?.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length > 0) {
          return embedding.map((value: unknown) => Number(value) || 0);
        }
      }
    } catch {
      // fall through to local fallback
    }
  }

  return localTextEmbedding(text);
}
