# Documentation Guide

Use this file as the entry point for project documentation.

## Current Docs

These are the authoritative guides for active development and local setup:

- [DEPLOYMENT_GUIDE.md](/home/vmanolas/src/zkp/project/zksync-zzlogin-dapp-Sep-2025-d/docs/DEPLOYMENT_GUIDE.md)
- [ENVIRONMENT_SETUP.md](/home/vmanolas/src/zkp/project/zksync-zzlogin-dapp-Sep-2025-d/docs/ENVIRONMENT_SETUP.md)
- [LOCAL_TESTING_GUIDE.md](/home/vmanolas/src/zkp/project/zksync-zzlogin-dapp-Sep-2025-d/docs/LOCAL_TESTING_GUIDE.md)
- [QUICK_DEPLOY.md](/home/vmanolas/src/zkp/project/zksync-zzlogin-dapp-Sep-2025-d/docs/QUICK_DEPLOY.md)
- [SETUP_CHECKLIST.md](/home/vmanolas/src/zkp/project/zksync-zzlogin-dapp-Sep-2025-d/docs/SETUP_CHECKLIST.md)

## Local Network Reference

- `localHardhat`: Hardhat node on `http://127.0.0.1:8545`, chain ID `1337`
- `inMemoryNode`: `anvil-zksync` on `http://127.0.0.1:8011`, chain ID `260`
- `localhost`: zkSync docker local L2 on `http://127.0.0.1:3050`, chain ID `270`

## Developer Tooling

- **Solidity dependency graph** — `contracts/scripts/generate-dependency-graph.mjs` walks every `import` reachable from `contracts/contracts/`, including OpenZeppelin files pulled in from `node_modules`, and renders `contracts/reports/dependency-graph.svg`. It regenerates automatically on `npm run compile` and `npm run deploy:local`, or on demand via `npm run graph:deps`. The output is gitignored (build artifact, not source) — regenerate it locally when you need it.

## Historical Docs

Many files in this directory are preserved as implementation snapshots, debugging notes, or milestone reports.
They are useful for project history, but they are not the source of truth for current commands or environment setup.

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
