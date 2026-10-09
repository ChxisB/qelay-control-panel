# qelay-control-panel — project instructions

Qelay Control Panel is a web control panel that **fully drives** a bunqueue server: view + control
queues, jobs, DLQ, cron, webhooks, workers, live activity, and the server **process
lifecycle** (start / stop / restart). It is a fork of `egeominotti/bunqueue-dashboard` (MIT); the
upstream copyright notice stays in `LICENSE`.

It talks to bunqueue's public HTTP API (`:6790`) plus a small local **control
agent** that manages the server process. Flow and Workflow operations use the
exact pinned public bunqueue client through that agent; the project never
imports private source paths or modifies bunqueue internals.

**Naming.** The product is **Qelay Control Panel** (slug `qelay-control-panel`, storage-key prefix
`qelay-`). **bunqueue** still names the server it controls: keep it where the text is technical (the
package, the API, a version, a command) and say "the server" where prose only means "the thing we
control". The `bunqueue` dependency, `BUNQUEUE_*` / `AGENT_*` / `BQ_*` / `VITE_BUNQUEUE_*` variables,
`/api/*` and `/agent/*` paths, `src/lib/bq.ts` and the ports `6790` / `6800` keep their upstream
names. Copy is sentence case.

## Golden rule: additive only

**Never rewrite or break existing files.** Build new capabilities as **new files**
and connect them with minimal glue (a route in `src/App.tsx`, a nav item in
`src/components/layout/navConfig.ts`). Two API layers coexist on purpose:

- `src/lib/api.ts` — the original client used by the first-generation view pages.
- `src/lib/bq.ts` — the complete, shape-verified client used by every `pages/control/*`
  page and the agent. **New work uses `bq`.**

Do not "fix" old pages in place; add a corrected new page and route to it.

**Exception, 2026-10-08 — the Qelay rebrand.** A rebrand cannot be additive. While the rebrand is
open, existing files may be edited in place for naming, copy, colors, type and the redesigned
shell, Overview, Jobs and Server pages. New components still go in new files (the 300-line gate
applies), and behavior changes are out of scope. Remove this exception when the rebrand closes.

## Stack

React 19 · React Router 7 · Zustand 5 · Vite 8 · Tailwind CSS v4 · Oxlint · Oxfmt · Bun · TypeScript.

## Layout

```
qelay-control-panel/
├── .github/
│   ├── workflows/             # ci.yml · pages.yml · docker.yml · release.yml (see “CI/CD” below)
│   ├── dependabot.yml         # weekly npm / actions / docker bumps
│   └── pull_request_template.md
├── agent/                     # Bun control agent (process lifecycle) — NOT linted/typechecked with src
│   ├── manager.ts             # ProcessManager: spawn/kill bunqueue, log ring buffer, dbStats()
│   ├── db.ts                  # read-only SQLite inspector: tables/schema/rows/query (readonly conn, unit-tested)
│   ├── server.ts              # fetch handler + origin/CORS/token policy (unit-tested)
│   └── index.ts               # binds 127.0.0.1; Origin allowlist + locked CORS + optional AGENT_TOKEN;
│                               # SIGINT/SIGTERM stop the managed server (no orphans)
├── docker/Caddyfile           # SPA history fallback + gzip/zstd + immutable asset caching for the image
├── scripts/dev.ts             # one-command dev launcher (`bun start`) — NOT linted/typechecked with src
├── Dockerfile                 # multi-stage: Bun build → Caddy serve
├── src/
│   ├── lib/                   # api.ts, bq.ts, bqTypes.ts, types.ts, jobActions.ts, sse.ts, format.ts, cn.ts,
│   │   │                       # usePolledData.ts, useActivityStream.ts, useThroughputSeries.ts, useAlertEngine.ts,
│   │   │                       # cloneJob.ts, cronPreview.ts, exportFile.ts, flowLayout.ts, promisePool.ts,
│   │   │                       # legacyStorage.ts (readWithLegacy adopts the old `bq-dash-*` keys once), useNavGroups.ts
│   │   ├── demo/              # demo mode (VITE_DEMO=1 / ?demo): installs a fetch+SSE shim answering every
│   │   │                       # bunqueue/agent route from fixtures.json — what the GitHub Pages build runs
│   │   └── copilot/           # in-app LLM assistant runtime: providers.ts (Anthropic/OpenAI/Google/custom),
│   │                           # tools.ts (zod-validated bq tools), runtime.ts (agent loop, max 8 steps)
│   ├── components/
│   │   ├── brand/             # QelayMark (the logo mark, gradient or mono) and QelayLogo (mark + wordmark)
│   │   ├── layout/            # Sidebar, Topbar, AppLayout, SidebarFooter, navConfig (the nav data), NavGroup, NavItem, Breadcrumb
│   │   ├── ui/                # StatCard, StatusBadge, Card, Button, CopyButton, form, feedback, PageHeader, AreaChart, icons
│   │   ├── copilot/           # Copilot launcher + lazy CopilotPanel (~160 KB gz chunk, loaded on first open)
│   │   └── dashboard/stores/  # Zustand: theme, connection, alerts, s3, toast, copilot
│   ├── pages/                 # first-gen view pages (Overview, Queues, QueueDetail, Jobs, Dlq, Cron, Metrics, Workers,
│   │   │                       # Logs, Usage, S3Backup, Settings, NotFound) + Alerts (routed at /alerts, in nav)
│   │   ├── queue/              # QueueConfig (used by classic QueueDetail)
│   │   └── control/           # Pro pages: OverviewPro, ServerControl, AddJob, BulkAddJobs, JobInspector, JobsPro,
│   │       │                   # QueuesOverview, QueueDetailPro, DlqPro, DlqControl, MetricsPro, LogsPro,
│   │       │                   # QueueControl, CronManager, Webhooks, Diagnostics, S3BackupPro, Database
│   │       │                   # (SQLite inspector), UsagePro, WorkersPro, Benchmark, Flows (DAG viewer), McpServer
│   │       ├── benchmark/      # Benchmark subcomponents: engine, useBenchmark, RunHistory
│   │       ├── job/            # JobInspector subcomponents: JobTimeline, JobBackoff, JobActionsPanel, JobChildren,
│   │       │                   # JobDataEditor, JobLogs
│   │       ├── queue/          # QueueControl subcomponents: QueueActions, ConfigForms
│   │       └── server/        # ServerControl subcomponents
│   ├── App.tsx                # routes — see docs/pages.md for the verified route→page table
│   └── main.tsx                # entry (fonts, theme, router; basename = import.meta.env.BASE_URL for Pages)
├── test/                      # bun test (format, sse, manager, agent lifecycle, s3 store, bq client, stores)
│                               # coverage floor enforced by scripts/check-coverage.ts (`bun run test:coverage`)
│                               # design-tokens + docs-theme: palette values and WCAG AA contrast, app and docs
└── docs/                      # how it works — see docs/README.md; docs/known-issues.md tracks verified gaps
                                # (VitePress site: docs/.vitepress, theme tokens in theme/custom.css mirror src/index.css)
```

## Run

```bash
bun install
bun start                   # agent + control panel together (Ctrl-C stops both) — the simple path
```

`bun start` (scripts/dev.ts) launches the control agent (http://127.0.0.1:6800) and the control panel
(http://localhost:5273, `/api` proxied to `:6790`). Prefer separate processes? The granular commands
still work:

```bash
bun run agent               # control agent only  → http://127.0.0.1:6800
bun dev                     # control panel only  → http://localhost:5273
```

The control panel reads data from a bunqueue server. Start it from **Control ▸ Server** (the agent runs
it) or point the control panel at an existing server via Settings / `VITE_BUNQUEUE_URL`.

## Gate — all checks must be green before considering a change done

```bash
bun run architecture # every TypeScript source file stays at or below 300 lines
bun run build     # tsc --noEmit + vite build
bun run check     # Oxlint + Oxfmt (production-grade configs)
bun test          # unit + agent lifecycle tests
bun run test:e2e # real bunqueue Flow, Workflow, and Queue SDK validation
```

CI runs `bun run quality` on every push and PR (`.github/workflows/ci.yml`), with the test step
upgraded to `bun run test:coverage` and followed by `bun run test:e2e`: coverage runs the suite and
`scripts/check-coverage.ts` enforces an **aggregate coverage floor** (sums the lcov report; Bun's
own `coverageThreshold` is per-file and would be failed by any single low-coverage module).
Raise the floors as coverage grows; never lower them to make a failing change pass.

### Oxlint and Oxfmt configs

`.oxlintrc.json` and `.oxfmtrc.json` are the committed root configurations used by editors and CI.
Oxlint enables its JavaScript, TypeScript, Oxc, Unicorn, React, and JSX accessibility plugins, plus
`oxlint-tsgolint` for type-aware optional-chain and type-export checks. The lint command also runs
`scripts/check-implicit-any-let.ts`, retaining the former Biome error that Oxlint does not yet
implement. Intentional hook and positional-key exceptions use scoped `oxlint-disable` comments with
a reason. Oxfmt preserves the established two-space, 100-column, single-quote style and deterministic
import ordering. Generated output, runtime-only `agent/` and `scripts/`, the Tailwind entrypoint, and
documentation formats are excluded from formatting. Keep new `src/` code passing both tools; do not
silence a rule to dodge a real fix.

## CI/CD

GitHub Actions under `.github/workflows/` (Bun pinned to the same version as local/Docker):

- **ci.yml** — on push to `main` + every PR: the complete `validation.yml`, fanned out into parallel
  jobs (`quality:*` groups, six browser suites, five native binaries), behind one `Stability gate`; uploads
  the `dist/` artifact. This is the merge gate.
- **ci-gate.yml** — used by Pages and Docker: on a push to `main` it waits for CI's `Stability gate`
  on that commit instead of re-running the validation; tags and manual runs validate in full.
- **pages.yml** — on push to `main`: builds with `VITE_BASE` = the Pages sub-path, adds a
  `404.html` SPA fallback, deploys to GitHub Pages. It best-effort auto-enables Pages
  (`configure-pages enablement: true`); if the first run fails with `Get Pages site failed`, enable
  Settings ▸ Pages ▸ Source → GitHub Actions once (GITHUB_TOKEN can't create the site itself).
- **docker.yml** — on push to `main` + tags `v*`: builds the multi-arch image and pushes to
  `ghcr.io/chxisb/qelay-control-panel` (`edge` on main, semver + `latest` on tags).
- **release.yml** — on EVERY push to `main` and on manual tags `v*`: re-runs the gate, zips
  `dist/`, cross-compiles **standalone executables for 5 platforms** (linux x64/arm64, macOS
  x64/arm64, windows x64 — `scripts/serve.ts` via `bun build --compile`: embedded SPA + `/api`
  proxy + control agent in one binary; files are `qelay-control-panel-<tag>-<platform>` and
  `qelay-control-panel-<tag>.zip`), and publishes a GitHub Release whose body is the
  **`CHANGELOG.md` section for the released version** (auto-generated commit notes appended after).
  The version is owned by **`package.json`** (the single source of truth) and follows
  [Semantic Versioning](https://semver.org); it is computed from commits, not picked (see
  *Versioning* below). `release.yml` tags/publishes `v<version>` to match; a push with nothing
  releasable leaves it alone, so the tag already exists and the publish is skipped — never a
  clobber. Auto-created tags use `GITHUB_TOKEN`, so they don't re-trigger
  docker.yml — semver/`latest` images still come from manually pushed `v*` tags (`edge` tracks every
  main push).

## Versioning — SemVer computed from Conventional Commits

`main` is protected (PR + `Stability gate`, no bypass), so CI cannot push a bump: the bump is part
of the PR, computed by `scripts/release-version.ts` and enforced by CI.

- **Commits.** Every non-merge commit is `type(scope)?: description`. `feat` → MINOR; `fix`,
  `perf`, `revert` → PATCH; `!` after the type/scope or a `BREAKING CHANGE:` footer → MAJOR;
  `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` release nothing on their own
  (Dependabot's `chore(deps)` / `ci(deps)` already conform). A PR with nothing releasable leaves
  `package.json` alone.
- **Bump.** After the last commit: `bun run release:plan` shows what the commits imply (changes
  nothing); `bun run release:version` bumps `package.json` and rolls `## [Unreleased]` into
  `## [x.y.z] - date` with the compare links, then commit both files. It refuses an empty
  `[Unreleased]`; re-running after more commits recomputes.
- **Check.** CI's `Semantic version` job (PRs only, part of the `Stability gate`) runs
  `bun run release:check` against `origin/<base>`. It fails on a non-conforming commit, a
  version other than the computed one, a missing `CHANGELOG.md` section, or a `v<x.y.z>` tag
  that already exists. The baseline is `package.json` on the base branch, not the latest tag.
- **Override.** A `Release-As: x.y.z` footer on a commit pins the version (valid SemVer, not
  below the base, no `+build`; newest commit wins). It is also how to choose a pre-release or
  ship a base version that was never tagged.

## Changelog rule — MANDATORY on every push / for every version

`CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/) format) is the source of the
GitHub Release notes. It is not optional bookkeeping — the release body is extracted from it.

- **Before every push to `main`:** add the changes under `## [Unreleased]`, grouped into
  `### Added` / `### Changed` / `### Fixed` / `### Removed`. Write it for a human reading the
  release, not a commit dump.
- **For every version:** `bun run release:version` renames `## [Unreleased]` to
  `## [x.y.z] - YYYY-MM-DD` — where `x.y.z` is the computed `package.json` version (the tag
  `release.yml` will create) and the date is today — starts a fresh empty `## [Unreleased]` above
  it, and updates the compare links at the bottom.
- `release.yml`'s "Extract changelog notes" step publishes the section matching the released tag,
  falling back to `[Unreleased]`, then to auto-generated notes if both are empty. So a version that
  ships without its `CHANGELOG.md` section still releases — but with a generic note instead of the
  curated one. Keep the changelog current so every release reads well.

**The lockfile (`bun.lock`) is committed on purpose** — every workflow installs with
`bun install --frozen-lockfile`. Do not re-add it to `.gitignore`.

Deploy note: `vite.config.ts` reads `base` from `VITE_BASE` (default `/`), and `main.tsx` passes
`basename={import.meta.env.BASE_URL}` so the SPA works both at root (dev / Docker) and under the
Pages sub-path.

## Control agent security

The agent can spawn processes, so `agent/server.ts` enforces: **loopback bind (127.0.0.1)**, **CORS
locked to an allowlist** (ACAO never `*`), **403 on any disallowed `Origin`** (blocks drive-by CSRF),
and an optional local `AGENT_TOKEN` bearer gate on state-changing requests. The all-in-one server
requires `AGENT_TOKEN` on every remote/proxied `/agent/*` route and independently requires
`BUNQUEUE_TOKEN` on every remote/proxied `/api/*` route; either bridge fails closed if its token is
missing. It is *not* the "unauthenticated RCE by design" it once was — do not describe it that way.
Configure via `AGENT_ALLOWED_ORIGINS`, `AGENT_ALLOWED_HOSTS`, `AGENT_TOKEN`, and `BUNQUEUE_TOKEN`.
Full threat model in `agent/server.ts` and `scripts/serve.ts`; verified limits in
`docs/known-issues.md`.

## Verified API-shape gotchas (learned from live testing — keep `bq.ts` honest)

- `GET /webhooks`, `/workers`, `/storage`, `/ping` wrap payload in **`{ ok, data: {...} }`**.
- `GET /queues/:q/dlq`, `/dlq/stats`, `/crons`, `/queues/:q/counts` are **flat** (`{ ok, ... }`, no `data`).
- DLQ entries are **`{ job, enteredAt, reason, error, attempts[] }`** — the job is nested, there is no top-level `id`/`name`.
- Jobs use **`startedAt` / `completedAt`** (not `processedOn` / `finishedOn`). `timeline[]` is persisted
  and capped at 20 entries. Since v2.8.59, reads also expose first-class `name`, terminal
  `returnvalue`, and `failedReason` fields.
- bunqueue v2.9.3 `PUT /queues/:q/rate-limit` takes **`{ limit, duration?, ttl? }`**; concurrency takes `{ concurrency }` (or `{ limit }`).
- Cron definitions expose **`jobName`** for spawned jobs, separate from cron definition names.
- `bq.ts`'s `call()` throws on HTTP-200-with-`{ok:false}` too (many mutating endpoints use this for logical
  failure) — except `health()`, which passes `strict:false` because `/health`'s `ok` is a health flag, not a
  success flag. Follow that pattern for any endpoint where `ok` isn't "did this request succeed".
- Which job actions apply to which job state is centralized in `src/lib/jobActions.ts::actionGates` — use it,
  don't re-derive.
- Full endpoint map, request bodies, and the job-action state table live in `docs/api-mapping.md`. Verified,
  honest list of current control panel bugs/limitations lives in `docs/known-issues.md` — check it before assuming
  something is a fresh bug.
