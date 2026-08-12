# The FunctionalScript side of NaNVM

`nanvm-lib/` is the Rust crate. This directory is the FunctionalScript that
targets it — today the shared operator test data and the printer that turns it
into Rust tests; later the `.rs` output branch of `fjs compile` (see
[`nanvm-lib/todo/mvp-roadmap.md`](../../nanvm-lib/todo/mvp-roadmap.md)).

Operator behaviour is described **once**, as data, and checked twice: against a
standard JavaScript engine and against `nanvm-lib`. Adding an operator or a case
means editing one file.

```text
module.f.mjs ──> proof.f.mjs ──────────────────────────────────> a JS engine
   (data)    └─> rust/module.f.mjs ──> nanvm-lib/tests/test/generated.rs ──> nanvm-lib
                    (printer)                    (generated)
```

## Files

| File | Role |
|---|---|
| [`types.ts`](types.ts) | The shape of the data: `Value`, `Case`, `Group`, `Eq`, `Data`. |
| [`module.f.mjs`](module.f.mjs) | **The single source of truth** — every operator case, as data. |
| [`proof.f.mjs`](proof.f.mjs) | Runs each case through the native JavaScript operators. |
| [`rust/module.f.mjs`](rust/module.f.mjs) | Prints the data as Rust, against the `nanvm-lib` API. |
| [`update/module.f.mjs`](update/module.f.mjs) | Writes the printer's output. Run by `npm run ci-update`. |

Rust *literal* syntax — string escaping, `f64`/`i64` spelling, `snake_case`
identifiers — is not specific to this generator and lives in
[`fjs/media/rust`](../media/rust/module.f.mjs).

## Writing a case

Operands and expectations are ordinary JavaScript values, following
[`fjs/types/rtti`](../types/rtti/README.md)'s convention that a constant is its
own description:

```js
{ name: 'arrayNumber', args: [[2.3]], expected: 2.3 },
{ name: 'emptyObjectByOne', args: [{}, 1], expected: NaN },
{ name: 'bigint', args: [0n], expected: throws },
```

Three things a literal cannot express are written as thunks — a function in the
data is always a *description*, never a value that happens to be a function:

| Thunk | Means |
|---|---|
| `functionValue` | a function value (no operator here inspects which one) |
| `ref(name)` | one of the `eq` `shared` values, so the *same* object reaches both sides |
| `throws` | the case must throw; valid only as `expected` |

`expected` is compared with `Object.is`, so `NaN` matches `NaN` and `0` does not
match `-0`. The Rust side compares the same way.

## The loop

1. Add the case to `data` in [`module.f.mjs`](module.f.mjs).
2. `npm test` — the JavaScript proof now covers it, which is what makes the
   expectation authoritative: it is JavaScript's answer, not a guess.
3. `npm run ci-update` to regenerate, then `cargo test`.
4. If `nanvm-lib` does not implement it yet, give the case a `rust` reason. The
   generated file keeps it as a commented-out `TODO`, and the JavaScript proof
   keeps running it.

Never edit `nanvm-lib/tests/test/generated.rs`: CI regenerates it on every pull
request and fails if the committed copy differs (see
[`fjs/ci/README.md`](../ci/README.md)).

## What is not shared

Two kinds of test stay hand-written, because there is nothing on the other side
to compare them with.

**JavaScript only** — [`proof.f.mjs`](proof.f.mjs)'s `jsOnly` section:
`ToPrimitive` consulting an object's `toString` method, and a function's string
form (engine-specific source text). `nanvm-lib` has no object methods yet.

**Rust only** — `nanvm-lib/tests/test/main.rs`: `try_into` out of `Any`, `Debug`
formatting, multi-limb bigint arithmetic, serialization round-trips, and the
exact text of `nanvm-lib`'s own error messages. These are properties of the VM,
not of JavaScript.

## Known divergence

`String(123n)` is `"123"` in JavaScript and `"0x7Bn"` in `nanvm-lib` — see
[bigint-decimal-string-coercion](../../nanvm-lib/todo/bigint-decimal-string-coercion.md).
The two affected cases carry a `rust` reason, so the gap is recorded in the data
itself rather than in a coverage table. That is the point of the arrangement: a
divergence is a property of a case, and a table of them goes stale the moment
someone fixes one.
