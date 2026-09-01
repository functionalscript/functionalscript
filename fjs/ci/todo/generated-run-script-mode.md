## generated-run-script-mode. Let the generator make its generated scripts executable

**Priority:** P3
**Status:** open

### Problem

`fjs/ci/nix` generates `nix/<job>/run` beside each `nix/<job>/flake.nix`, and CI
invokes it directly:

```sh
./nix/node26/run npm run cov
```

It also generates one script that is not per-job, `nix/lock-update.sh` (see
`../nix/module.f.mjs`'s `lockUpdateText`), invoked by hand as
`./nix/lock-update.sh` when `npm run lock-update` bumps a Nix pin. Both are
scripts the repository runs by path rather than through `sh <path>`, so both
need the executable bit.

The generator cannot set it. Nothing in
[`fjs/effects/node`](../../effects/node/module.f.mjs) takes a file mode:
`writeFile` is `(path, data)`, there is no `chmod` operation, and the virtual
filesystem in `../../effects/node/virtual` models no modes at all.

What makes this survivable rather than broken:

- `fs.writeFile` **preserves the mode of a file that already exists** — it
  truncates rather than recreating. So a script committed once as `100755` stays
  executable through every regeneration, and `npm run gen` never has to
  care.
- The repository already tracks executables in Git — `fjs/module.mjs`,
  every `nix/<job>/run`, and `nix/lock-update.sh` — so a `100755` blob is not
  a new thing here.

What is left exposed is exactly one case: **a script generated for the first
time** — a job's `run`, or `nix/lock-update.sh` itself if it were ever deleted
and regenerated. It lands as `100644`, and the next invocation fails with
`Permission denied` rather than running. Loud, but avoidable, and it will
happen to whoever adds the next runtime — the spidermonkey job in
[spidermonkey-test-runner](../../emergent_testing/todo/spidermonkey-test-runner.md)
is the likely first victim among the per-job scripts. The workaround is one
command:

```sh
git update-index --chmod=+x nix/<job>/run
git update-index --chmod=+x nix/lock-update.sh
```

The drift check does not catch it. `git add -A && git diff --cached --exit-code`
compares a tree the file is *new* in, so there is no recorded mode to differ
from.

### Proposal

Give the effects layer a way to express "this file is executable", and have
`writeJob` use it. Two shapes, and the choice is the work:

1. **A `chmod` operation.** Direct, and mirrors `fs.chmod`. It also invites
   callers to express modes this repository has no other use for, and forces a
   decision about what a mode means on Windows, where `fjs ci` must keep running
   (`65Z` requires the generator stay Nix-independent and Windows-compatible).
2. **An `executable` flag on `writeFile`.** Narrower — the only distinction the
   generator needs is script-or-not — and it degrades honestly on Windows, where
   the concept is absent and the flag can be a no-op. It changes an operation's
   signature, so every implementation and its proofs move together: the real
   one, the virtual one, `memory`, and the RTTI in `types.ts`.

Prefer 2 unless a second caller appears that wants a real mode.

Either way the virtual filesystem has to start modelling the bit, or the proof
that the generator sets it cannot exist — and a generator capability with no
proof is the thing this repository does not ship.

### Tasks

- [ ] Decide between a `chmod` operation and an `executable` flag on `writeFile`
- [ ] Decide what it does on Windows, and record the answer
- [ ] Teach `../../effects/node/virtual` to model the bit, so the behaviour is
      provable without touching a real filesystem
- [ ] Have `writeJob` and `nixFlakes` in `../nix/module.f.mjs` mark `run` and
      `lock-update.sh` executable
- [ ] Drop the `git update-index --chmod=+x` note from `writeJob`'s docstring,
      `nix/README.md` and this file's siblings once it is untrue

### Related

- [65Z-ci-nix](65z-ci-nix.md) — owns the generated directory, and requires the
  generator stay Windows-compatible
- [spidermonkey-test-runner](../../emergent_testing/todo/spidermonkey-test-runner.md)
  — the next job likely to be generated for the first time, and so the next to
  hit this
