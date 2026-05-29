type JobState = {
  processed: number;
  succeeded: number;
  failed: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastError?: string;
  lastDurationMs?: number;
};

const jobStates = new Map<string, JobState>();

function getJobState(jobName: string): JobState {
  const existing = jobStates.get(jobName);
  if (existing) return existing;

  const initial: JobState = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };
  jobStates.set(jobName, initial);
  return initial;
}

export function recordJobStart(jobName: string) {
  const state = getJobState(jobName);
  state.processed += 1;
}

export function recordJobSuccess(jobName: string, durationMs: number) {
  const state = getJobState(jobName);
  state.succeeded += 1;
  state.lastSuccessAt = Date.now();
  state.lastDurationMs = durationMs;
}

export function recordJobFailure(jobName: string, error?: unknown) {
  const state = getJobState(jobName);
  state.failed += 1;
  state.lastFailureAt = Date.now();
  state.lastError =
    error instanceof Error ? error.message : String(error ?? "unknown_error");
}

export function renderMetrics() {
  const lines: string[] = [];
  lines.push("# HELP ai_worker_jobs_total Total AI worker jobs by state.");
  lines.push("# TYPE ai_worker_jobs_total counter");

  for (const [jobName, state] of jobStates.entries()) {
    lines.push(
      `ai_worker_jobs_total{job="${jobName}",state="processed"} ${state.processed}`,
    );
    lines.push(
      `ai_worker_jobs_total{job="${jobName}",state="succeeded"} ${state.succeeded}`,
    );
    lines.push(
      `ai_worker_jobs_total{job="${jobName}",state="failed"} ${state.failed}`,
    );
    if (state.lastDurationMs !== undefined) {
      lines.push(
        `ai_worker_job_duration_ms_last{job="${jobName}"} ${state.lastDurationMs.toFixed(2)}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
