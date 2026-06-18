# 66A-unified-operator-tests. Single source of truth for operator tests

**Priority:** P3
**Status:** open

## Problem

Operator tests are currently written twice:

- [`nanvm-lib/tests/proof.f.ts`](../nanvm-lib/tests/proof.f.ts) — runs against a standard JS engine to prove JS semantics.
- [`nanvm-lib/tests/test.rs`](../nanvm-lib/tests/test.rs) — runs the same operations against `nanvm-lib`.

The two files diverge over time. [`nanvm-lib/tests/README.md`](../nanvm-lib/tests/README.md) documents the current mismatches.
Every new operator added to the VM requires updating both files manually, which is error-prone.

## Proposal

Introduce a `nanvm-lib/tests/module.f.ts` that is the **single source of truth** for all operator test cases.
It exports pure data — structured test cases that describe inputs and expected outputs with no dependency on a particular runtime.

The same module serves two consumers:

1. **JS proof** — a thin `proof.f.ts` imports the test data from `module.f.ts` and runs each case through the native JS operators. This replaces the current hand-written `proof.f.ts`.
2. **Rust tests** — a code generator (or a build-time script) reads `module.f.ts` and emits the corresponding `test.rs`. Alternatively, `test.rs` can import the test data at compile time via a `build.rs` step that calls Deno/Node to evaluate the module and serialise the cases to a format `test.rs` can `include!`.

### Sketch of the test data format

```ts
// nanvm-lib/tests/module.f.ts

type Case<I, O> = {
    readonly input: I
    readonly expected: O
    readonly label: string
}

export default {
    unary_plus: [
        { input: null,      expected: 0,   label: 'null' },
        { input: undefined, expected: NaN, label: 'undefined' },
        { input: false,     expected: 0,   label: 'boolean false' },
        { input: true,      expected: 1,   label: 'boolean true' },
        // ...
    ] as const,
    unary_minus: [ /* ... */ ] as const,
    mul:         [ /* ... */ ] as const,
    eq:          [ /* ... */ ] as const,
    stringCoercion: [ /* ... */ ] as const,
}
```

`proof.f.ts` then becomes:

```ts
import cases from './module.f.ts'
export const proof = {
    unary_plus: Object.fromEntries(
        cases.unary_plus.map(c => [c.label, () => {
            const result = +c.input
            // assert result === c.expected
        }])
    ),
    // ...
}
```

### Generator options

- **Option A (chosen):** A small Node/Deno script (`gen-tests.ts`) reads `module.f.ts` and writes `test.rs`. The script is wired into `npm run update` (which already runs `ci-update` and other codegen steps), so `test.rs` is regenerated automatically whenever the project is updated and committed as a regular source file.
- **Option B (build.rs):** `build.rs` invokes `node gen-tests.ts` and the output is `include!`-d into `test.rs`. Removes the need to commit a generated file but adds a build-time Node dependency.

Option A is chosen. It is simpler, avoids a runtime Rust build dependency, and fits naturally into the existing `npm run update` workflow.

## Tasks

- [ ] Design the test case data schema in `module.f.ts`.
- [ ] Migrate `eq` test cases.
- [ ] Migrate `unary_plus` test cases.
- [ ] Migrate `unary_minus` test cases.
- [ ] Migrate `stringCoercion` test cases.
- [ ] Migrate `mul` test cases.
- [ ] Write `proof.f.ts` as a thin consumer of `module.f.ts`.
- [ ] Write `gen-tests.ts` (Option A) to emit `test.rs` from `module.f.ts`.
- [ ] Remove the hand-written `proof.f.ts` and generated `test.rs` from version control (or keep `test.rs` as generated artifact).
