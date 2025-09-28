# Architecture Docs

Planning-phase documents explaining system decomposition, ADRs, and structural decisions. Primary owners: software-architect, solution-architect.

## Validation Workflow

Contributors run `scripts/ci/validate.sh` locally before opening a PR to execute lint checks, type-checking, and test suites. CI pipelines reuse the same script to ensure consistent validation gates.
