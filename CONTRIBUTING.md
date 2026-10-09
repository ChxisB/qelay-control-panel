# Contributing

Thanks for your interest in **Qelay Control Panel**. This guide gets you from
clone to a green pull request.

## Getting started

```bash
bun install
bun start          # control agent + control panel together (Ctrl-C stops both)
```

`bun start` runs the control agent (`http://127.0.0.1:6800`) and the control panel
(`http://localhost:5273`, `/api` proxied to `:6790`). Full docs live at
<https://chxisb.github.io/qelay-control-panel/docs/>.

## The quality gate (must be green)

```bash
bun run build      # tsc --noEmit + vite build
bun run check      # Oxlint + Oxfmt
bun test           # unit + agent-lifecycle tests
```

CI runs exactly this on every push and pull request. Please run it locally
before opening a PR.

## Ground rules

- **Additive first.** Prefer new files plus minimal glue over rewriting working
  code. The project keeps two API clients on purpose: `src/lib/api.ts` (the
  original, classic pages) and `src/lib/bq.ts` (the complete, shape-verified
  client for all new work). See `CLAUDE.md` for the full architecture notes.
- **Keep `src/` passing the strict type-aware Oxlint ruleset, its implicit-`any` parity guard,
  and the Oxfmt check.** Don't silence a rule to dodge a real fix.
- **Write [Conventional Commits](https://www.conventionalcommits.org).** Every commit
  subject is `type(scope): description`, because the type decides the release: `feat` is
  a minor release, `fix`, `perf` and `revert` are patch releases, and `!` after the type
  or a `BREAKING CHANGE:` footer is a major one. `docs`, `style`, `refactor`, `test`,
  `build`, `ci` and `chore` release nothing on their own, so a pull request made only of
  those leaves the version alone.
- **Update `CHANGELOG.md`** under `## [Unreleased]`, then run `bun run release:version`
  once your last commit is in. It works out the next [SemVer](https://semver.org) version
  from your commits, bumps `package.json` and rolls the changelog; commit both files.
  `bun run release:plan` shows the result without writing anything. CI fails the pull
  request if the version does not match its commits. The release workflow tags and
  publishes `v<version>` from `package.json`.

## Pull requests

Fill in the PR template, keep the diff focused on one thing, and make sure the
gate is green. Screenshots or a short clip help a lot for UI changes.

## Reporting bugs and requesting features

Use the issue templates (bug report / feature request). For **security**
issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

By contributing you agree that your contributions are licensed under the
project's [MIT license](LICENSE), and you are expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
