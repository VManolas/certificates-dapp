# Documentation Guide

Use this file as the entry point for project documentation.

## Current Docs

These are the authoritative guides for active development and local setup:

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md)
- [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)

## Thesis Defense

- [DEFENSE_QA_NOTES.md](./DEFENSE_QA_NOTES.md) — Q&A preparation: answered questions and likely committee questions
- [PRESENTATION_NOTES.md](./PRESENTATION_NOTES.md) — Full presentation narrative, slide talking points, and Q&A handling guide

## Local Network Reference

- `localHardhat`: Hardhat node on `http://127.0.0.1:8545`, chain ID `1337`
- `inMemoryNode`: `anvil-zksync` on `http://127.0.0.1:8011`, chain ID `260`
- `localhost`: zkSync docker local L2 on `http://127.0.0.1:3050`, chain ID `270`

## Developer Tooling

- **Solidity dependency graph** — `contracts/scripts/generate-dependency-graph.mjs` walks every `import` reachable from `contracts/contracts/`, including OpenZeppelin files pulled in from `node_modules`, and renders `contracts/reports/dependency-graph.svg`. It regenerates automatically on `npm run compile` and `npm run deploy:local`, or on demand via `npm run graph:deps`. The output is gitignored (build artifact, not source) — regenerate it locally when you need it.

## Historical Docs

Many files in this directory are preserved as implementation snapshots, debugging notes, or milestone reports.
They are useful for project history, but they are not the source of truth for current commands or environment setup.

Notable historical files:

- [PRD.md](./PRD.md) — Product Requirements Document v1.0 (Dec 2025)
- [TRD.md](./TRD.md) — Technical Requirements Document v1.0 (Dec 2025)

Treat files matching patterns like these as historical unless they are explicitly linked above:

- dated summaries and reports
- `*_COMPLETE*`
- `*_SUMMARY*`
- `*_FIX*`
- `*_REPORT*`
- `QUICK_*` and `START_*` notes that predate the current deployment flow
- ad hoc shell helpers under `docs/*.sh`

If a historical file conflicts with a current guide, follow the current guide.

## Rule of Thumb

- For setup, deployment, networks, and env vars: use the files in `Current Docs`
- For background context or prior decisions: use the older summaries and reports
