import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

const otlpEndpoint = process.env.OTLP_ENDPOINT || "";

const sdk = new NodeSDK({
  serviceName: "ai-worker-service",
  traceExporter: new OTLPTraceExporter({
    url: otlpEndpoint,
  }),
  instrumentations: [
    new HttpInstrumentation(),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown()
    .then(() => console.log("Tracing terminated"))
    .catch((error) => console.log("Error terminating tracing", error));
});
