## Single source of truth for operator tests

**Priority:** P3
**Status:** open

### Problem

Operator tests are written twice:

- [`tests/proof.f.ts`](tests/proof.f.ts) — runs against a standard JS engine to prove JS semantics.
- [`tests/test.rs`](tests/test.rs) — runs the same operations against `nanvm-lib`.

The two files diverge over time (mismatches documented in [`tests/README.md`](tests/README.md)). Every new operator requires updating both files manually.

### Proposal

Introduce `tests/module.f.ts` as the single source of truth — pure data describing inputs and expected outputs for each operator.

1. **JS proof** — a thin `proof.f.ts` imports the test data and runs each case through native JS operators.
2. **Rust tests** — a small Node/Deno script (`gen-tests.ts`) reads `module.f.ts` and writes `test.rs`, wired into `npm run update`.

### Tasks

- [ ] Design the test case data schema in `tests/module.f.ts`.
- [ ] Migrate `eq`, `unary_plus`, `unary_minus`, `stringCoercion`, `mul` test cases.
- [ ] Write `proof.f.ts` as a thin consumer of `module.f.ts`.
- [ ] Write `gen-tests.ts` to emit `test.rs` from `module.f.ts`.
