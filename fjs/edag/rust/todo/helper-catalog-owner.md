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
mistaken for a call. The corpus takes a third route: each generated
file opens with `use crate::harness::*;`, and the hand-written
`nanvm-lib/tests/test/harness.rs` re-exports the helper set by name —
`bigint_any`, `f64_any`, `strict_eq`, `string_key` and the rest — so
that no generated file lists what it uses. A helper added here needs a
catalog row in `fsc/rust` and a line in that re-export. The two misses
differ: the harness's is caught, since an unresolved name in a
generated file fails `cargo test`; `fsc/rust`'s is silent, a `use` line
missing from a module the compiler of that module then rejects, with
nothing on this side to say why.

The printer also imports `OpId` from `fjs/nanvm/types.ts`, the test
corpus, for a union of `fjs/edag/types.ts`'s own operator ids.

### Proposal

The printer reports what it used instead of others guessing: its result
carries the set of helpers and VM names it emitted, collected while
printing, and one `useLines(uses, bound)` here turns that set into the
`use` lines. `fjs/fsc/rust`'s `helpersFor` and `importsFor`, the two
catalogs and the string-literal blanking go. The harness's re-export
stays as it is: it is the one copy the compiler checks, and the glob is
there so that generated corpus files stay free of `use` lists — this
issue removes the silent copy, not the checked one. `OpId` moves to
`fjs/edag/types.ts`.

### Tasks

- [ ] The printer returns `{ lines, uses }`; `useLines` here with a proof.
- [ ] `fsc/rust` through it; `npm run gen` regenerates byte-identical
      output.
- [ ] `OpId` in `edag/types.ts`.
- [ ] `tsc`, `fjs test`, `cargo test`.

### Related

- [let-bindings-owner.md](./let-bindings-owner.md) — the `let` line and
  the header, the other things this printer should own outright.
