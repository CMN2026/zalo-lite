type ProviderHealthState = {
  status: "healthy" | "degraded" | "unhealthy";
  consecutiveFailures: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastError?: string;
};

type LatencySummary = {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
};

const providerLatency = new Map<string, LatencySummary>();
const providerHealth = new Map<string, ProviderHealthState>();
const streamingCounters = {
  started: 0,
  completed: 0,
  cancelled: 0,
  failed: 0,
  chunks: 0,
};

function getProviderState(provider: string): ProviderHealthState {
  const existing = providerHealth.get(provider);
  if (existing) return existing;

  const initial: ProviderHealthState = {
    status: "degraded",
    consecutiveFailures: 0,
  };
  providerHealth.set(provider, initial);
  return initial;
}

export function recordProviderLatency(provider: string, ms: number) {
  const current = providerLatency.get(provider) ?? {
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
    last: 0,
  };

  current.count += 1;
  current.sum += ms;
  current.min = Math.min(current.min, ms);
  current.max = Math.max(current.max, ms);
  current.last = ms;
  providerLatency.set(provider, current);

  const state = getProviderState(provider);
  state.status = state.consecutiveFailures > 0 ? "degraded" : "healthy";
  state.consecutiveFailures = 0;
  state.lastSuccessAt = Date.now();
  delete state.lastError;

  console.log(
    `[metrics] provider_latency{name="${provider}"} ${ms.toFixed(2)}`,
  );
}

export function markProviderFailure(provider: string, error?: unknown) {
  const state = getProviderState(provider);
  state.consecutiveFailures += 1;
  state.lastFailureAt = Date.now();
  if (error instanceof Error) {
    state.lastError = error.message;
  } else if (typeof error === "string") {
    state.lastError = error;
  } else {
    state.lastError = "unknown_error";
  }
  state.status = state.consecutiveFailures >= 3 ? "unhealthy" : "degraded";
}

export function recordStreamingEvent(event: keyof typeof streamingCounters) {
  streamingCounters[event] += 1;
}

export function getProviderHealthSnapshot() {
  return Array.from(providerHealth.entries()).map(([provider, state]) => ({
    provider,
    ...state,
  }));
}

export function renderMetrics() {
  const lines = [
    "# HELP chatbot_streaming_sessions_total Total chatbot streaming sessions by outcome.",
    "# TYPE chatbot_streaming_sessions_total counter",
    `chatbot_streaming_sessions_total{status="started"} ${streamingCounters.started}`,
    `chatbot_streaming_sessions_total{status="completed"} ${streamingCounters.completed}`,
    `chatbot_streaming_sessions_total{status="cancelled"} ${streamingCounters.cancelled}`,
    `chatbot_streaming_sessions_total{status="failed"} ${streamingCounters.failed}`,
    "# HELP chatbot_streaming_chunks_total Total chatbot stream chunks emitted.",
    "# TYPE chatbot_streaming_chunks_total counter",
    `chatbot_streaming_chunks_total ${streamingCounters.chunks}`,
    "# HELP chatbot_provider_latency_ms Provider latency summary in milliseconds.",
    "# TYPE chatbot_provider_latency_ms summary",
  ];

  for (const [provider, summary] of providerLatency.entries()) {
    const safeMin = Number.isFinite(summary.min) ? summary.min : 0;
    const average = summary.count > 0 ? summary.sum / summary.count : 0;
    lines.push(
      `chatbot_provider_latency_ms_count{provider="${provider}"} ${summary.count}`,
      `chatbot_provider_latency_ms_sum{provider="${provider}"} ${summary.sum.toFixed(2)}`,
      `chatbot_provider_latency_ms_min{provider="${provider}"} ${safeMin.toFixed(2)}`,
      `chatbot_provider_latency_ms_max{provider="${provider}"} ${summary.max.toFixed(2)}`,
      `chatbot_provider_latency_ms_last{provider="${provider}"} ${summary.last.toFixed(2)}`,
      `chatbot_provider_latency_ms_avg{provider="${provider}"} ${average.toFixed(2)}`,
    );
  }

  lines.push(
    "# HELP chatbot_provider_health Provider health score, 1 healthy 0 otherwise.",
    "# TYPE chatbot_provider_health gauge",
  );
  for (const [provider, state] of providerHealth.entries()) {
    const healthy = state.status === "healthy" ? 1 : 0;
    lines.push(
      `chatbot_provider_health{provider="${provider}"} ${healthy}`,
      `chatbot_provider_consecutive_failures{provider="${provider}"} ${state.consecutiveFailures}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
