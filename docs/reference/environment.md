# Environment Variables

Codemachine CLI reads the following environment variables at startup to configure workspace paths, logging, and telemetry.

**Phase legend**
- Setup: values needed before running any commands so the CLI can locate resources
- Build: toggles that influence how Codemachine generates or scaffolds assets
- Runtime: options that adjust behavior while the CLI executes commands

> Note: Use `projects/codemachine/.env.example` as the canonical reference when bootstrapping new environments.

| Variable | Description | Phase | Required | Default |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Node.js execution profile (`development`, `test`, or `production`). | Runtime | No | `development` |
| `CODEX_HOME` | Absolute path to the local Codex workspace root. | Setup | Yes | `~/.codemachine/codex` |
| `CODEMACHINE_MODE` | Determines whether Codemachine builds full artifacts (`build`) or renders templates (`template`). | Build | No | `build` |
| `LOG_LEVEL` | Verbosity of CLI logs (`debug`, `info`, `warn`, `error`). | Runtime | No | `info` |
| `TELEMETRY_ENABLED` | Enables anonymous telemetry collection when `true`. | Runtime | No | `false` |
