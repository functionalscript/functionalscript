## symlink-containment. A symlink can serve a file outside the root

**Priority:** P3
**Status:** open

### Problem

`resolve` (`fjs/web/module.f.mjs`) rejects a path that climbs above the served
root, but it decides that in **segment space**, on the URL alone. A symlink
inside the root whose target is outside it therefore passes: `leak.txt ->
/etc/passwd` resolves to `./leak.txt`, which is under the root by every check
`resolve` can make, and `stat`/`readFile` follow the link. Verified against the
Node runner — the file comes back with `200`.

The blast radius is bounded by the loopback binding (`fjs web` answers
`127.0.0.1` only), so this is a local escape, not a network one: what it defeats
is the root boundary the module documents, for anyone who serves a tree
containing links they did not audit.

There is nothing to check against today. Containment after link resolution needs
the *real* path of the file, and `Fs` (`fjs/effects/node/types.ts`) has no
`realpath` operation — nor does `FileStat` say whether the entry is a link.

### Proposal

Add a `Realpath` operation to `Fs` — `(path: string) => IoResult<string>`,
`fs.realpath` in the Node runner — and have `respond` resolve both the root and
the target, refusing with `400` unless the root is a prefix of the target in
segment space (`isProperPrefix` from `fjs/path`, which is exactly this check
where both sides are already real).

The virtual runner is the harder half and the reason this is not a one-line fix:
its file system (`fjs/effects/node/virtual/`) has no symlinks at all, so
`realpath` there is the identity and the guard cannot be proven where every other
`respond` case is. Either the virtual `Dir` grows a link entity — a fourth
`_Entity` case beside `Vec[]`, `Dir` and `JsModule` — or the proof for this one
guard has to reach a real file system, which no other proof in the repository
does.

### Tasks

- [ ] Add `Realpath` to `Fs`, implement it in the Node runner.
- [ ] Model a symlink in the virtual file system, or decide the guard is proven
      some other way.
- [ ] Enforce containment in `respond`, with proof coverage for a link that
      points out of the root and one that stays inside it.
- [ ] Drop the symlink caveat from `fjs/web/README.md`.

### Related

- [`fjs/web`](../README.md) — "Symlinks are followed" documents the current
  behavior.
- `fjs/path/module.f.mjs` — `isProperPrefix`, the containment test once both
  paths are real.
- Reported by the Codex review bot on
  [#1693](https://github.com/functionalscript/functionalscript/pull/1693).
