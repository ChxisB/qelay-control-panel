---
title: About and credits
description: "Where Qelay Control Panel comes from, what changed in the fork, what stayed the same, and how it is licensed."
---

# About and credits

Qelay Control Panel is a web control panel for a [bunqueue](https://github.com/egeominotti/bunqueue)
server. It shows your queues, jobs, dead letter queue, cron schedules, webhooks and workers, and it
can start, stop and restart the server process itself through a small local control agent.

## Origin

Qelay Control Panel is a fork of
[egeominotti/bunqueue-dashboard](https://github.com/egeominotti/bunqueue-dashboard) by Egeo Minotti,
released under the MIT license. The substance of this project (the pages, the control agent, the
shape-verified API client, the tests and most of this documentation) was written upstream, and the
upstream copyright notice is kept in the repository's `LICENSE` file, as the license requires.

## What changed in the fork

- **Brand.** A new name, logo, color palette and typeface (Inter for text, the system monospace
  for code), with light and dark themes that meet WCAG AA contrast.
- **Interface.** A collapsible navigation, and redesigned Overview, Jobs and Server pages.
- **Naming.** The npm package, Docker image, release files and the control agent's settings folder
  use the new name. Browser settings saved under the earlier names are copied across the first
  time they are read, and an old agent settings file is copied the first time the agent starts
  without a new one. See [Settings](/guide/settings#persistence-and-security) and
  [Server Control](/guide/server).
- **Documentation.** Screenshots were recaptured from the built-in demo, and the guides were
  updated to match the new screens.

## What did not change

- **The server it controls is bunqueue.** The control panel talks to bunqueue's public HTTP API
  (default port `6790`) and to its own control agent (default port `6800`). Nothing in bunqueue is
  modified.
- **Names that belong to bunqueue stay as they are:** the `bunqueue` dependency, the `BUNQUEUE_*`
  variables, the API paths and the pinned client version.
- **The agent's security model.** The agent still binds to loopback, locks CORS to an allowlist,
  rejects disallowed origins and hosts, and requires tokens for remote or proxied access. See
  [Control agent](/agent).
- **Fail-closed behavior.** Actions that bunqueue's current contract cannot make atomic remain
  unavailable. The list is in [Known issues](/known-issues).

## License

MIT. The full text, including the upstream copyright notice, is in the
[`LICENSE`](https://github.com/ChxisB/qelay-control-panel/blob/main/LICENSE) file.

## Links

- [Qelay Control Panel on GitHub](https://github.com/ChxisB/qelay-control-panel): source, issues
  and releases.
- [Changelog](https://github.com/ChxisB/qelay-control-panel/blob/main/CHANGELOG.md): what changed
  in each version.
- [egeominotti/bunqueue-dashboard](https://github.com/egeominotti/bunqueue-dashboard): the project
  this was forked from.
- [bunqueue](https://github.com/egeominotti/bunqueue): the queue server this control panel drives.
