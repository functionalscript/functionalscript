## local-tsc-skips-mjs-with-a-generated-declaration. `npx tsc` passes locally on a `.f.mjs` error CI reports

**Priority:** P2
**Status:** open

### Problem

A generated `.d.mts` beside a `.mjs` shadows it: TypeScript reads the
declaration and does not check the source. Generated declarations are
gitignored, so CI clones without them and checks the sources; a working tree
that has run `prepack` even once keeps them, and from then on `npx tsc` reports
success for source it never opened.

The failure mode is silent and confidence-shaped. `npx tsc` is what
`CONTRIBUTING.md` and every gate in this repository ask a contributor to run
before pushing, and it exits 0.

Measured on [#1771](https://github.com/functionalscript/functionalscript/pull/1771),
which pushed a real type error past a clean local run. The same tree, same
compiler, one file deleted between the two runs:

| Tree | `npx tsc` |
| --- | --- |
| with generated `.d.mts` present | exit 0, no diagnostics |
| declarations deleted first | `fjs/ci/node/module.f.mjs(75,7): error TS2322` |

CI caught it, which is the system working — but a cycle later than a
contributor's own check should have, and the local pass is what made the push
look validated.

Declaration *emit* has the same shape: `prepack` does not overwrite an existing
`.d.mts`, so a stale one survives every regeneration until it is deleted. That
half is harmless in CI for the same reason — a fresh clone has none — but it is
why the check half goes unnoticed.

### Proposal

No design agreed. The options are not equivalent and the choice is about who
pays:

- **Clear declarations in the gate.** Whatever a contributor is told to run
  deletes generated `.d.ts` / `.d.mts` first. Correct, and costs a full
  re-emit on every local check.
- **Emit to an output directory.** `declarationDir`, so generated declarations
  never sit beside their sources and cannot shadow them. Changes packaging
  layout, `files`, and every consumer path — a large change for this.
- **Document it and leave the tool alone.** Cheapest, and honest; it makes the
  trap known rather than absent, which §6 of the root `AGENTS.md` argues is
  sometimes the better trade.

Worth measuring before choosing: how long a from-scratch declaration emit takes,
since that number decides whether the first option is tolerable.

### Tasks

- [ ] Measure a cold `prepack` emit.
- [ ] Choose among the three and apply it.
- [ ] Until then, say in `CONTRIBUTING.md` that a local `npx tsc` does not check
      a `.mjs` whose generated declaration exists, and how to get a real answer.

### Related

- [`../package.json`](../package.json) — `prepack` runs the emit, then re-checks
  with declarations present.
- [`../.gitignore`](../.gitignore) — why CI never sees a stale declaration.
- [`../fjs/ci/node/module.f.mjs`](../fjs/ci/node/module.f.mjs) — `node26` runs
  `npx tsc` on a fresh clone, which is why it disagreed.
