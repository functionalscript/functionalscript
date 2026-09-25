## Implementation modules export no `proof`

**Priority:** P4
**Status:** open

### Problem

Five implementation modules export a `proof` object of their own, although
each already has a `proof.f.mjs` beside it:

- [`fjs/dev`](../dev/module.f.mjs) — a whole suite (`isSourceFile`,
  `allFilesFindsFunctionalScript`, the `loadModuleMap…` cases). The module
  imports `fjs/asserts` and `fjs/effects/node/virtual` at runtime for it and
  for nothing else.
- [`fjs/mcp`](../mcp/module.f.mjs) — calls `casMcpServer('/')` "to cover its
  effect-building body". `casMcpServer` is exported, so nothing about the
  case needs the module's scope.
- [`fjs/fsc/transpiler`](../fsc/transpiler/module.f.mjs) —
  `mapDjsUnresolvedImport`, a guard its comment calls "unreachable through
  `transpile`'s public API".
- [`fjs/types/bigfloat`](../types/bigfloat/module.f.mjs) —
  `normalizeMantissaZero`, a path "unreachable through decToBin".
- [`fjs/types/btree/remove`](../types/btree/remove/module.f.mjs) — four
  `…DefaultBranch` cases for `default` arms that "can't be hit through the
  public `remove` API".

Two things are wrong with that. The npm package ships every `.mjs` with its
declarations, so each `proof` — and in `fjs/dev`'s case the test harness it
imports — is part of the published API. And the last three exist to cover
branches their own comments call unreachable, which is the case
[`fjs/AGENTS.md` §1.2](../AGENTS.md#12-proof-coverage-is-mandatory) answers
the other way: "restructure the code so it isn't there rather than leaving it
uncovered".

### Proposal

Move each case that reaches the module through its exports into the
directory's `proof.f.mjs`, where `fjs/dev`'s suite and `fjs/mcp`'s case can go
as they are, and drop the runtime imports that served them. For the
unreachable branches, restructure so the branch is not there — a type or a
shape that rules the case out — rather than exporting a private helper to a
test. Removing an exported `proof` is a breaking change to declare.

### Tasks

- [ ] `fjs/dev`: move the suite into `proof.f.mjs`; drop the `asserts` and
      `effects/node/virtual` imports from the module.
- [ ] `fjs/mcp`: move the `casMcpServer` case into `proof.f.mjs`.
- [ ] `fjs/fsc/transpiler`, `fjs/types/bigfloat`, `fjs/types/btree/remove`:
      remove the unreachable branches, then the `proof` exports.
- [ ] Declare the break; `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/types/btree/todo/66f-btree-remove-mirror-merge.md`](../types/btree/todo/66f-btree-remove-mirror-merge.md)
  — reshapes `reduceValue0`/`reduceValue2`, the helpers two of the btree cases
  reach into.
