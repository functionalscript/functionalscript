## Move code generation out of `package.json`

**Priority:** P3
**Status:** open

### Problem

`package.json`'s `gen` script is one shell line. It began as a short chain
and grew by one `&&` per generator: cleanup, this repository's CI generation,
the NaNVM Rust tests, the DataJS vector matrix, one `fjs compile` per
`nanvm-harness` fixture — several dozen of them — and the Nix lock script at
the end. Every new generated output adds another command to the same line,
so the file keeps growing, and what grows is the manifest npm reads, not a
file anyone owns as code.

What that costs:

- **The line cannot be read.** A diff of `package.json` shows one changed
  string. Which generator was added, moved, or dropped is found by eye, in
  a string that scrolls past any editor's width.
- **The order is a fact without a reason.** Cleanup must run first,
  `fjs ci` must write the flakes before `gen.nix/lock-update.sh` locks them,
  and a generator that needs another's output must follow it
  ([CONTRIBUTING.md](../CONTRIBUTING.md#regenerating-after-a-source-change)).
  None of this can be said where the order is written: a JSON string holds
  no comment, and the reasons live in `fjs/ci/nix`'s JSDoc instead, far from
  the line they explain.
- **Each generator is named twice.** Every output already has an `.f.mjs`
  owner — `fjs/ci/self`, `fjs/nanvm/update`,
  `fjs/media/datajs/vectors/matrix`, `fjs/dev/clean` — and the script names
  each again by path. Moving or renaming a module breaks the chain, and
  nothing but running `gen` tells.
- **It is the one generator that is a shell chain, not a program.** Every
  other step of regeneration is FunctionalScript with a proof; the step that
  composes them has neither, and
  [one-fixture-list](../nanvm-harness/todo/one-fixture-list.md) records what
  the unowned part already cost: fixtures committed that no command compiled.
- **`package.json` is the wrong place to own it.** The manifest describes the
  package. The `gen` script is this repository's build logic, and the file
  that grows is the one every consumer of the package downloads.

### Proposal

`gen` runs one FunctionalScript program, and that program is the list of
generators:

```json
"gen": "node ./fjs/module.mjs r ./fjs/dev/gen/module.f.mjs",
"gen:clean": "node ./fjs/module.mjs r ./fjs/dev/clean/module.f.mjs"
```

The program, `fjs/dev/gen/module.f.mjs`, lives beside `fjs/dev/clean`,
the cleanup it starts with. Its `main` is a sequence of effects, one per
generator, in the order regeneration needs, with the reason for the order
written as a comment beside each step — the one thing the JSON string could
not hold. It imports each generator's `main` rather than naming its file, so
a move or rename is a compile error, not a broken chain found at run time.

The directory is named after the script it implements. `gen/` is
handwritten under the naming rule: what marks a file generated is the
dotted prefix `gen.`, which `fjs/dev/clean`'s `isGenerated` tests for, so
`gen:clean` leaves `gen/` alone
([CONTRIBUTING.md](../CONTRIBUTING.md#naming-generated-files)).

Each area owns one generator, as most already do. The list the program
composes:

| Area | Generator | Writes |
| --- | --- | --- |
| cleanup | `fjs/dev/clean` | nothing; deletes every `gen.*` |
| CI | `fjs/ci/self` | the two workflows and the `gen.nix/` flakes |
| NaNVM Rust tests | `fjs/nanvm/update` | the Rust test corpus, methods table, values fixture |
| DataJS spec | `fjs/media/datajs/vectors/matrix` | `gen.matrix.md` |
| NaNVM harness fixtures | `fjs/nanvm/harness` — new, per [one-fixture-list](../nanvm-harness/todo/one-fixture-list.md) | `nanvm-harness/gen.fixtures/` |
| Nix locks | `gen.nix/lock-update.sh`, run through the `exec` effect | the `flake.lock` files |

Two of those are the only changes in kind. The fixture chain becomes a
generator, which one-fixture-list already proposes and this issue needs: a
program cannot compose several dozen shell commands, and should not. And the
lock script keeps running as a script — it is itself generated, and
`nix flake lock` is the external tool it already calls, so nothing new is
invoked — but the program runs it through `exec`, last, after the step that
wrote the flakes it locks.

A generator that fails stops the sequence, as `&&` does today, and its
message names the generator rather than a position in a line.

`gen:clean` stays: documentation and the drift check describe it, and it is
one command already. `prepack`, `test`, `cov`, `start`, `lock-update`, and
`website` stay too. Each is one command, or runs `gen` and three
installers; none of them is the problem. What leaves `package.json` is build
logic, and only build logic.

The program is held to the same standard as the generators it composes: a
`proof.f.mjs` running `main` against the mock effects, as `fjs/nanvm/update`
and `fjs/ci` prove theirs, with every step and every failure branch covered.

The contract downstream projects depend on does not move. The workflow
`fjs ci` generates runs `npm run gen` and the drift check; a project that
generates with the built-in command keeps its own one-command `gen`, and this
repository's keeps its name
([fjs/ci/README.md](../fjs/ci/README.md)).

#### Why not several npm scripts

`gen:ci`, `gen:rust`, `gen:spec`, each one command, with `gen` chaining them
by `npm run`, would shorten the line without removing it: the order would
still be a string with no room for its reasons, each area would still be
named in two places, and nothing would prove the composition. It is also
slower in the way that does not matter and more fragile in the way that
does — one `npm` start per script, and a chain that breaks at a rename. A
program is the simpler shape, and the one every other step already has.

#### Drawbacks

- One more `.f.mjs` with a proof, for logic that is a list. The proof is
  cheap because the list is, and the alternative is a list with no owner.
- `exec` enters the generator set. It is the same `sh` the chain already
  runs, so the Windows limitation CONTRIBUTING.md names is unchanged, but it
  is one effect the other generators do not use. The step is last and
  isolated for that reason.
- The fixture generator is a prerequisite, so this issue cannot land first.
  It can land in two pull requests: the program composing the existing
  generators and keeping the fixture chain in `package.json` for one more
  step, then the fixture generator replacing that remainder.

### Tasks

- [ ] `fjs/nanvm/harness/module.f.mjs`: the fixture generator, per
      [one-fixture-list](../nanvm-harness/todo/one-fixture-list.md).
- [ ] `fjs/dev/gen/module.f.mjs`: `main` composing cleanup, the four
      generators, and the lock script through `exec`, in order, with the
      reason for each position in a comment beside it; `proof.f.mjs`
      covering every step and failure branch.
- [ ] `package.json`: `gen` becomes the one `fjs run`.
- [ ] CONTRIBUTING.md, [fjs/ci/README.md](../fjs/ci/README.md),
      [fjs/dev/README.md](../fjs/dev/README.md): say that `gen` is the
      program, where the list of generators is, and that adding a generated
      output means adding a step there.
- [ ] `npm run gen`, then `git add -A && git diff --cached --exit-code`:
      every committed output regenerates byte-identical.

### Related

- [one-fixture-list](../nanvm-harness/todo/one-fixture-list.md) — the
  fixture chain this issue depends on becoming a generator; the longest
  part of the line.
- [document-nanvm-harness](../nanvm-harness/todo/document-nanvm-harness.md)
  — names the `package.json` edit a new fixture needs today, which this
  issue removes.
- [replace-npm-check-updates-with-an-internal-script](../fjs/ci/todo/replace-npm-check-updates-with-an-internal-script.md)
  — `lock-update`, the other script that runs `gen`; unchanged by this
  issue, but the same move applies if it grows.
- [`fjs/dev/clean/module.f.mjs`](../fjs/dev/clean/module.f.mjs) — the
  cleanup the program starts with, and the directory it lives beside.
- [`fjs/ci/self/module.f.mjs`](../fjs/ci/self/module.f.mjs),
  [`fjs/nanvm/update/module.f.mjs`](../fjs/nanvm/update/module.f.mjs) —
  the generator shape, and the proofs to match.
