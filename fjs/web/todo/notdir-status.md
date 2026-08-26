## notdir-status. A path through a regular file answers `500`, and only on POSIX

**Priority:** P3
**Status:** open

### Problem

`GET /README.md/` answers `500 io error: ENOTDIR` on Linux and macOS. The
request is client-caused — a regular file is not a directory, and nothing under
it can exist — so by this module's own doctrine it belongs with the `404`
answers rather than in the channel reserved for the host failing at something it
should have managed. The same argument is already made about `%00`: *"a NUL is a
malformed URL, not a host error"*, and again in
[name-too-long-status](./name-too-long-status.md) for `ENAMETOOLONG`.

`isNotFound` (`fjs/effects/node/module.f.mjs`) tests `ENOENT` and nothing else,
so `fileResponse` falls past its `404` branch to the `500`.

**It is also a disclosure, which `ENAMETOOLONG` is not.** The status separates
a path that runs through an existing regular file from one that runs through
nothing:

| request | POSIX | Windows |
|---|---|---|
| `/nope.md/` — nothing there | `404 not found` | `404 not found` |
| `/README.md/` — an existing regular file | `500 io error: ENOTDIR` | `404 not found` |

So on POSIX a trailing slash answers "is there a regular file at this name?",
which is the enumeration the identical-`404` answers elsewhere are written to
deny — see the dot-prefixed-existence note in `resolve` and "Deliberately
absent" in [`../README.md`](../README.md).

**And the status is platform-dependent**, which is the part that makes it worth
filing beyond its sibling. Windows returns `ENOENT` where POSIX returns
`ENOTDIR`, so the same request is `404` on one host and `500` on another, and a
proof written on one platform cannot see the other's answer. Verified directly:
`statSync('README.md/index.html')` reports `ENOENT` on `win32`.

Reported on
[#1714](https://github.com/functionalscript/functionalscript/pull/1714), where
it contradicted a claim that the `404` was uniform.

### Proposal

Answer `404`: a path that descends through a regular file names nothing, and
whether the file it descends through exists is not a distinction worth
publishing.

Where to put the test is the open question. Widening `isNotFound` to admit
`ENOTDIR` changes what *every* caller of it treats as absent, which is a
decision belonging to `fjs/effects/node` rather than to this module; a test
local to `fileResponse` keeps the blast radius here but leaves the next caller
to rediscover it. The platform split argues for the shared answer — `ENOENT`
and `ENOTDIR` are the same fact wearing two names, and only one host says which.

The obstacle is the same as its sibling's: the virtual file system never
reports `ENOTDIR`, so the branch would be unreachable, which the coverage gate
rejects and `fjs/AGENTS.md` §1.2 says to restructure away rather than leave
uncovered. So this is two changes — teach the virtual file system to refuse a
path that descends through a regular file, then map the error.

### Tasks

- [ ] Report `ENOTDIR` from the virtual file system for a path descending
      through a regular file.
- [ ] Answer `404` for it, deciding first whether the test belongs in
      `isNotFound` or in `fileResponse`.
- [ ] Prove `/README.md/` and `/nope.md/` answer identically, on a host whose
      `stat` distinguishes them.
- [ ] Update the response table in `module.f.mjs` and
      [`../README.md`](../README.md).

### Related

- [name-too-long-status](./name-too-long-status.md) — the same shape for
  `ENAMETOOLONG`, without the disclosure or the platform split.
- [missing-index-message](./missing-index-message.md) — triggers on the
  directory-form request this leaks through.
- `fjs/effects/node/module.f.mjs` — `isNotFound`, the `ENOENT`-only test.
- `fjs/effects/node/virtual/module.f.mjs` — the file system that would grow the
  error.
