# Telemetry Strategy

## Logging Approach
- The CLI wraps `pino` via `createLogger` in `projects/codemachine/src/shared/logging/logger.ts`, defaulting the service name to `codemachine` so all emissions can be traced to this binary.
- Sensitive fields are redacted automatically: `password`, `token`, `authorization`, and `apiKey` are always removed even if callers forget to opt-in.
- Non-production environments attempt to use the `pino-pretty` transport for human-readable logs; if that dependency fails to load, the logger records a warning and falls back to structured JSON output without interrupting execution.
- Errors passed to the logger are serialized with their stack traces to make support triage easier while preserving the redaction guarantees above.

## Metrics Collection Plan
- Local command metrics (execution durations, exit codes, feature usage) are buffered as newline-delimited JSON files under `~/.codemachine/telemetry` to give operators an auditable trail before forwarding anything remotely.
- When a remote collector is configured, the CLI forwards batches asynchronously over HTTPS; absence of a configured endpoint keeps metrics local, supporting air-gapped workflows.
- Telemetry is opt-in and controlled by the `TELEMETRY_ENABLED` environment variable (any truthy value activates collection). When falsey or unset, no files are written and no network calls are made.
- Failed uploads only mark the batch for retry; data remains locally until a successful flush or manual pruning to prevent silent loss.

## Privacy and Safety Considerations
- The default redaction list (`password`, `token`, `authorization`, `apiKey`) applies to both logs and metrics payloads; additional keys can be appended per integration.
- Metrics are aggregated at the feature/event level and never include full command arguments or file contents; the CLI records counts and durations only.
- Anonymous identifiers rely on hashed machine fingerprints plus a rotating session salt so Codemachine cannot reverse-map individual users without cooperation.
- Operators must document any override to redaction lists and notify compliance before enabling external forwarding.

## Log Destinations and Formats
- By default, the logger streams structured JSON to `stdout`, ready for `jq`, `pino-pretty`, or log shipping agents.
- Setting `LOG_PATH` points the logger at that file (or FIFO), enabling durable capture for CI and offline analysis while preserving JSON structure.
- In local development, enabling `pino-pretty` keeps the same fields but formats them for readability; production stays in pure JSON for machine parsing.
- Every record includes the `service` field (`codemachine`) and merges any `withContext()` metadata so multi-agent workflows retain provenance.

## Operator Checklist
- [ ] Confirm `TELEMETRY_ENABLED` is explicitly set for the target environment and documented in the deployment manifest.
- [ ] Review and extend the redaction allowlist for any new secrets introduced by plugins or custom commands.
- [ ] Decide whether metrics should remain local or configure the remote collector endpoint; test HTTPS connectivity if forwarding.
- [ ] Set `LOG_PATH` (if required) and validate that log rotation or archival policies meet retention requirements.
- [ ] Run a dry-run session with telemetry enabled, inspect `~/.codemachine/telemetry`, and verify no PII or disallowed data is present.
