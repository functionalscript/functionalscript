## helper-catalog-owner. Which `nanvm_lib` helpers the printer calls is written in three modules

**Priority:** P3
**Status:** open

### Problem

This printer is the one module that spells a helper call —
`f64_any(…)`, `string_any(…)`, `bigint_any(…)`, `string_key(…)`,
`strict_eq(…)` — and two other modules keep their own copy of the set.
`fjs/fsc/rust` recovers it from the printed text, with
`helperCatalog` and `importCatalog` tables of marker strings and a
`withoutStringLiterals` pass so a string literal holding a marker is not
mistaken for a call; `fjs/nanvm/rust`'s `generate` hard-codes the
`use nanvm_lib::vm::unstable::{…}` line. A helper added here needs a
catalog row there and an edit to that string, and nothing fails when
either is missed.

The printer also imports `OpId` from `fjs/nanvm/types.ts`, the test
corpus, for a union of `fjs/edag/types.ts`'s own operator ids.

### Proposal

The printer reports what it used instead of others guessing: its result
carries the set of helpers and VM names it emitted, collected while
printing, and one `useLines(uses, bound)` here turns that set into the
`use` lines. `fjs/fsc/rust`'s `helpersFor` and `importsFor`, the two
catalogs and the string-literal blanking go; `fjs/nanvm/rust` prints its
`use` line from the same catalog. `OpId` moves to `fjs/edag/types.ts`.

### Tasks

- [ ] The printer returns `{ lines, uses }`; `useLines` here with a proof.
- [ ] `fsc/rust` and `nanvm/rust` through it; `npm run gen` regenerates
      byte-identical output.
- [ ] `OpId` in `edag/types.ts`.
- [ ] `tsc`, `fjs test`, `cargo test`.

### Related

- [let-bindings-owner.md](./let-bindings-owner.md) — the `let` line and
  the header, the other things this printer should own outright.
