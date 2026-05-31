/// <reference path="./types/external.d.ts" />

import "./observability/tracing.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";
import { buildTextEmbedding } from "./embedding.js";
import { logger } from "./observability/logger.js";
import {
  recordJobFailure,
  recordJobStart,
  recordJobSuccess,
  renderMetrics,
} from "./observability/metrics.js";

const connection = new IORedis(process.env.REDIS_URL || "redis://redis:6379");

const queueName = "ai-tasks";
const queue = new Queue(queueName, { connection });

const pgPool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://zalo:zalo@postgres:5432/zalo_user",
});
const ingestIntervalMs = Number(
  process.env.FAQ_INGEST_INTERVAL_MS || "21600000",
);
const faqSourceUrl =
  process.env.CHATBOT_FAQ_URL || "http://chatbot-service:3003/chatbot/faq";

async function ensureVectorTable() {
  const client = await pgPool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id uuid PRIMARY KEY,
        content text,
        metadata jsonb,
        embedding vector(1536),
        created_at timestamptz default now()
      );
    `);
  } finally {
    client.release();
  }
}

async function loadFaqs() {
  const res = await fetch(faqSourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch FAQ source: ${res.status}`);
  }
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function ingestFaqEmbeddings() {
  const faqs = await loadFaqs();
  await ensureVectorTable();

  for (const item of faqs) {
    const content = item.answer || item.question || JSON.stringify(item);
    const embedding = await buildTextEmbedding(content);
    if (!embedding.length) continue;

    const metadata = {
      source: "faq",
      category: item.category || "general",
      language: item.language || item.lang || "vi",
      question: item.question,
      keywords: item.keywords || [],
      updatedAt: item.updatedAt || Date.now(),
      faqId: item.questionId || item.id,
    };

    const client = await pgPool.connect();
    try {
      await client.query(
        `INSERT INTO documents (id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding;`,
        [
          item.questionId || item.id || randomUUID(),
          content,
          metadata,
          embedding,
        ],
      );
    } finally {
      client.release();
    }
  }

  return { ok: true, count: faqs.length };
}

// Worker: handles embedding jobs (embed_faq) and other async tasks
const worker = new Worker(
  queueName,
  async (job: { id?: string | number; name: string }) => {
    const startedAt = Date.now();
    logger.info("job_started", { jobId: job.id, jobName: job.name });
    recordJobStart(job.name);
    switch (job.name) {
      case "embed_faq": {
        const result = await ingestFaqEmbeddings();
        recordJobSuccess(job.name, Date.now() - startedAt);
        logger.info("job_completed", {
          jobId: job.id,
          jobName: job.name,
          count: result.count,
        });
        return result;
      }
      case "summarize":
      default:
        recordJobSuccess(job.name, Date.now() - startedAt);
        return { ok: true };
    }
  },
  { connection },
);

worker.on(
  "failed",
  (job: { id?: string | number; name?: string } | undefined, err: unknown) => {
    const jobName = job?.name || "unknown";
    recordJobFailure(jobName, err);
    logger.error("job_failed", {
      jobId: job?.id,
      jobName,
      error: err instanceof Error ? err.message : String(err),
    });
  },
);

const metricsPort = Number(process.env.WORKER_METRICS_PORT || "3101");
const metricsServer = createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("bad request");
    return;
  }

  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        service: "ai-worker-service",
        status: "ok",
        queue: queueName,
      }),
    );
    return;
  }

  if (req.url === "/metrics") {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.end(renderMetrics());
    return;
  }

  res.statusCode = 404;
  res.end("not found");
});

metricsServer.listen(metricsPort, () => {
  logger.info("metrics_server_started", { port: metricsPort });
});

logger.info("worker_started", {
  redisUrl: process.env.REDIS_URL || "redis://redis:6379",
});

async function scheduleFaqIngestion() {
  const repeatEvery = Math.max(5 * 60 * 1000, ingestIntervalMs);
  await queue.add(
    "embed_faq",
    {},
    {
      repeat: { every: repeatEvery },
      jobId: "embed_faq_repeating",
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  if (process.env.ENQUEUE_EMBED_FAQ_ON_STARTUP !== "false") {
    await queue.add(
      "embed_faq",
      {},
      {
        jobId: "embed_faq_bootstrap",
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
  }
}

scheduleFaqIngestion().catch((err) =>
  logger.error("failed_to_schedule_faq_ingestion", {
    error: err instanceof Error ? err.message : String(err),
  }),
);

async function shutdown(signal: string) {
  logger.info("shutdown_signal", { signal });
  await Promise.allSettled([
    worker.close(),
    queue.close(),
    metricsServer.close(),
    connection.quit(),
    pgPool.end(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
