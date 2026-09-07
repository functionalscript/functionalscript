## comparison-cases-table. Four comparison corpora restate one 50-entry argument list

**Priority:** P4
**Status:** open

### Problem

`fjs/nanvm/module.f.mjs` spells the same 50 argument pairs four times:
`lessThanCases` (`:620`), `lessOrEqualCases` (`:691`), `greaterThanCases`
(`:766`), `greaterOrEqualCases` (`:833`). The `args` sequences are
byte-identical across all four; only the mechanical name infix and the
`expected` booleans differ. Even the explanatory comments are copies — the
"the one binary case that escapes: `functionValue` has no expression" note
appears in all four groups.

The four relations are pinned to each other by real invariants no code
states (`>` is reversed `<`; `<=`/`>=` differ from `<`/`>` only at equality
and under `NaN`), and the corpus feeds two consumers — `proof.f.mjs` and
the Rust conformance printer in `rust/module.f.mjs` — so an argument pair
added to one list and missed in another silently narrows the Rust suite
too.

The file already contains the exact abstraction for the unary case, with
the rationale written out: `numberCoercionCases(negate)` (`:266-303`) lists
`+n`/`-n`'s shared argument space once because "listing the arguments once
keeps the two groups from drifting apart."

### Proposal

The same move for the binary relations: one table of
`{ stem, args, lt, le, gt, ge }` rows, and four one-line derivations that
pick the boolean column and splice the relation word into the name.
Removes ~170 lines and makes the shared argument space — and any
deliberate asymmetry — visible in one place. Rows whose four booleans
follow mechanically from one comparison result could go further (derive
`le`/`gt`/`ge` from an `Ordering | nan` column), but the flat four-column
table is already the win; keep the derivation no cleverer than
`numberCoercionCases`.

### Tasks

- [ ] Build the table; derive the four case groups; diff the generated
      Rust conformance output to prove it unchanged.
- [ ] `tsc`, `fjs t`.

### Related

- [unify-eq-into-a-group.md](./unify-eq-into-a-group.md) — the `eq`
  section's own structural cleanup; a shared table may serve it too.
- `numberCoercionCases` in `module.f.mjs:266-303` — the in-file precedent
  this follows.
