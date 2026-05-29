import { Pool } from "pg";

export interface RetrievalFilter {
  category?: string;
  language?: string;
  source?: string;
  [key: string]: string | undefined;
}

export interface RetrievedContext {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export interface RetrievalResult {
  contexts: RetrievedContext[];
  topScore: number;
  averageScore: number;
  confidence: number;
  shouldGround: boolean;
}

const databaseUrl =
  process.env.RAG_DATABASE_URL || process.env.DATABASE_URL || "";
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 4 })
  : null;

type VectorRow = {
  id: string;
  content: string;
  metadata: Record<string, any> | null;
  score: number | string;
};

function vectorLiteral(values: number[]) {
  return `[${values.map((value) => (Number.isFinite(value) ? Number(value).toFixed(6) : "0")).join(",")}]`;
}

function normalizeFilter(filter?: RetrievalFilter) {
  if (!filter) return {} as RetrievalFilter;
  const cleaned: RetrievalFilter = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      cleaned[key] = `${value}`.trim();
    }
  }
  return cleaned;
}

function buildMetadataFilterClause(filters: RetrievalFilter, values: any[]) {
  const supported: string[] = [];
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (key === "category" || key === "language" || key === "source") {
      continue;
    }
    extra[key] = `${value}`;
  }

  if (Object.keys(extra).length > 0) {
    values.push(extra);
    supported.push(`metadata @> $${values.length}::jsonb`);
  }

  return supported;
}

export class RetrievalService {
  async searchSimilarDocuments(params: {
    embedding: number[];
    topK?: number;
    minScore?: number;
    filters?: RetrievalFilter;
  }): Promise<RetrievalResult> {
    if (!pool || !params.embedding?.length) {
      return {
        contexts: [],
        topScore: 0,
        averageScore: 0,
        confidence: 0,
        shouldGround: false,
      };
    }

    const topK = Math.max(
      1,
      Math.min(params.topK ?? Number(process.env.RAG_TOP_K ?? 4), 8),
    );
    const minScore =
      params.minScore ?? Number(process.env.RAG_MIN_SCORE ?? 0.72);
    const filters = normalizeFilter(params.filters);
    const client = await pool.connect();

    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");

      const clauses: string[] = [];
      const values: any[] = [vectorLiteral(params.embedding), topK];

      if (filters.category) {
        values.push(filters.category);
        clauses.push(`metadata->>'category' = $${values.length}`);
      }
      if (filters.language) {
        values.push(filters.language);
        clauses.push(
          `COALESCE(metadata->>'language', metadata->>'lang') = $${values.length}`,
        );
      }
      if (filters.source) {
        values.push(filters.source);
        clauses.push(`metadata->>'source' = $${values.length}`);
      }

      clauses.push(...buildMetadataFilterClause(filters, values));

      const whereClause =
        clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const sql = `
        SELECT id, content, metadata,
               1 - (embedding <=> $1::vector) AS score
        FROM documents
        ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;

      const result = await client.query<VectorRow>(sql, values);
      const rawContexts = (result.rows || []).map((row: VectorRow) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata || {},
        score: Number(row.score || 0),
      }));

      const contexts = rawContexts.filter(
        (row: RetrievedContext, index: number) =>
          row.score >= minScore || index === 0,
      );

      const topScore = contexts[0]?.score ?? 0;
      const averageScore = contexts.length
        ? contexts.reduce(
            (sum: number, item: RetrievedContext) => sum + item.score,
            0,
          ) / contexts.length
        : 0;
      const confidence = Math.max(
        0,
        Math.min(1, topScore * 0.7 + averageScore * 0.3),
      );
      const shouldGround = contexts.length > 0 && topScore >= minScore;

      return {
        contexts,
        topScore,
        averageScore,
        confidence,
        shouldGround,
      };
    } catch (error) {
      console.warn("RAG retrieval failed:", error);
      return {
        contexts: [],
        topScore: 0,
        averageScore: 0,
        confidence: 0,
        shouldGround: false,
      };
    } finally {
      client.release();
    }
  }

  async close() {
    if (pool) {
      await pool.end();
    }
  }
}

export const retrievalService = new RetrievalService();
