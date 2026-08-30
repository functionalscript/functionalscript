## generated-flake-lock. Generate `flake.lock`, and take back two `--quiet`s

**Priority:** P2
**Status:** open

### Problem

Every generated flake pins its inputs by exact revision in `flake.nix`, and
none of them has a `flake.lock`. So every `nix develop` computes a lock,
finds it differs from the nothing on disk, and — because
[`../nix/module.f.mjs`](../nix/module.f.mjs)'s `run` script passes
`--no-write-lock-file` — says so:

```text
warning: not writing modified lock file of flake 'git+file:///…?dir=nix&shallow=1':
• Added input 'nixpkgs':
    'github:NixOS/nixpkgs/062346a6…?narHash=sha256-BZWCi9ZR…' (2026-08-26)
• Added input 'rust-overlay':
    'github:oxalica/rust-overlay/996e9b0b…?narHash=sha256-+IAEnmmx…' (2026-08-29)
• Added input 'rust-overlay/nixpkgs':
    follows 'nixpkgs'
```

Five lines, on **every step of every Nix job** — around forty per run for the
`wasm` job alone. It is emitted at `src/libflake/flake.cc`'s
`warn("not writing modified lock file of flake '%s':\n%s", …)`, the `else`
branch of `if (lockFlags.writeLockFile)`. Neither the flag nor the warning is
wrong: `--no-write-lock-file` is what keeps the invocation read-only so the
Node 26 drift check sees a clean tree.

The current answer is `--quiet --quiet --quiet`, and it is a blunt one. Nix has
a single global verbosity integer — `lvlError = 0, lvlWarn = 1, lvlNotice = 2,
lvlInfo = 3`, printing when a message's level is at most the current value,
default `lvlInfo`, each `--quiet` decrementing by one. One `--quiet` removes the
`copying N paths` chatter at `lvlInfo` and is worth having on its own. The
second and third exist only to get below `lvlWarn`, and they take **every** Nix
warning with them: a failing substituter, a dirty tree, a deprecation notice.
Only errors survive.

There is no narrower lever. `--verbose`, `--quiet` and `--debug` are the whole
of Nix's logging flag category; verbosity is not a `nix.conf` setting, so
`--option` cannot reach it; and Nix has no per-message or per-category
suppression.

### What doing this must include

**Remove the second and third `--quiet` from `runText`.** They are not an
independent improvement that happens to live nearby — they exist only to hide
the warning a lock file removes, and they cost every other Nix warning to do
it. A `flake.lock` that lands while they stay is the worst of both: the noise
is gone twice over, and the warning channel is still spent. Take them off in
the same change, and delete the proof that counts them.

The first `--quiet` stays. It removes the `copying N paths` chatter at
`lvlInfo` and has nothing to do with this issue.

### Proposal

Generate `flake.lock` beside each `flake.nix`. Then nothing is modified at
evaluation, nothing warns, and the two flags come back off.

#### It has to work on Windows, which decides the design

`fjs ci` runs wherever the project is developed — [65Z](65z-ci-nix.md) requires
the generator stay Nix-independent and Windows-compatible, and
[CONTRIBUTING.md](../../../CONTRIBUTING.md) supports a Windows contributor with
no Nix at all. So the obvious implementation is out: `npm run update` must not
shell out to `nix flake lock`. That fails twice over — Nix does not run natively
on Windows, and calling an external tool from our own code needs approval under
[root `AGENTS.md` §6](../../../AGENTS.md#6-external-tools).

What that leaves is the shape below, and it is the one that keeps
`npm run update` pure text generation on every operating system: the hashes are
**data in `../config/module.f.mjs`**, and the generator writes the lock from
them the way it already writes `flake.nix`. Nothing computes a hash at
generation time, so nothing needs Nix, a network, or a shell.

The cost lands on whoever moves a pin rather than on everyone who regenerates:
bumping the Nixpkgs commit means fetching the new `narHash` once, from a machine
with Nix, from `nix-prefetch-url`, or out of a CI log. That is exactly the
bargain `bunSources` already makes for its four archive hashes, and the note
next to it says how to recompute them.

A lock for these flakes is nearly derivable already. `flake.nix` names each
input's exact revision, so the only values a lock adds are `narHash` and
`lastModified` per input. Those are facts about a published revision, verified
once and pinned — the same shape `../config/module.f.mjs` already uses for
`bunSources`, whose hashes were checked by hand for the same reason.

The two the flakes need today are in the warning above, which is Nix's own
output for these exact revisions:

- `nixpkgs` `062346a6d85bc4b49dfaa61c986e9c5be21217d1` —
  `sha256-BZWCi9ZRJiARTuKTbbtvFTj7t1TK4G3UEckT3HyNfRg=`
- `rust-overlay` `996e9b0b019a4a9eb9e9a5641aefa06d801b5895` —
  `sha256-+IAEnmmx5YIhUWo0lp15jLLHchnXo5yKgWsi6C6Cf+0=`

Generating rather than committing by hand is the point. A hand-written lock is
a file the drift check cannot regenerate, so it would rot the first time the
Nixpkgs pin moved; a generated one moves with `config/module.f.mjs`, and
forgetting to update a hash fails visibly — Nix recomputes and the warning
returns, now meaning something real.

The failure mode is benign either way: a lock Nix disagrees with is a lock it
recomputes, which is exactly today's behaviour.

### Tasks

- [ ] Add `narHash` and `lastModified` beside `commit` for `nixpkgs` and
      `rustOverlay` in [`../config/module.f.mjs`](../config/module.f.mjs)
- [ ] Emit `flake.lock` from `../nix/module.f.mjs`, including the
      `rust-overlay/nixpkgs` `follows` node the shared shell declares
- [ ] Pin the generated text in `../nix/proof.f.mjs`, as `flakeText` is
- [ ] Drop the second and third `--quiet` from `runText`, and `threeQuiets` in
      `../nix/proof.f.mjs` — the point of the issue, not a follow-up to it
- [ ] Keep `npm run update` free of any Nix invocation, so it still runs on
      Windows
- [ ] Record how to recompute a `narHash` when the pins move, next to the
      `bunSources` note that already answers the same question

### Related

- [65Z-ci-nix](65z-ci-nix.md) — owns the generated directory and the `run`
  script, and requires the generator stay Windows-compatible
- [096-ci-caching](096-ci-caching.md) — the other half of what a lock would
  help with, if a binary cache of our own ever lands
