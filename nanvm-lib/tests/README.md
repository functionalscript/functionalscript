# Tests

Operator behaviour is described **once**, as data, and checked twice: against a
standard JavaScript engine and against `nanvm-lib`. Adding an operator or a case
means editing one file.

```text
module.f.mjs ──> proof.f.mjs ─────────────────────────> a JS engine
   (data)    └─> rust/module.f.mjs ──> test/generated.rs ──> nanvm-lib
                    (printer)             (generated)
```

## Files

| File | Role |
|---|---|
| [`types.ts`](types.ts) | The shape of the data: `Value`, `Case`, `Group`, `Eq`, `Data`. |
| [`module.f.mjs`](module.f.mjs) | **The single source of truth** — every operator case, as data. |
| [`proof.f.mjs`](proof.f.mjs) | Runs each case through the native JavaScript operators. |
| [`rust/module.f.mjs`](rust/module.f.mjs) | Prints the data as Rust. Pure; proofs in [`rust/proof.f.mjs`](rust/proof.f.mjs). |
| [`update/module.f.ts`](update/module.f.ts) | Writes the printer's output. Run by `npm run ci-update`. |
| [`test/generated.rs`](test/generated.rs) | **Generated. Do not edit.** One statement per case. |
| [`test/harness.rs`](test/harness.rs) | Hand-written value constructors and assertions the generated file calls. |
| [`test/main.rs`](test/main.rs) | Hand-written tests with no JavaScript counterpart. |

`test/main.rs` rather than `test.rs`: cargo makes every `tests/*.rs` its own test
target, so the generated file and the harness have to live in a subdirectory to
stay ordinary submodules, and a subdirectory's entry point is `main.rs`.

## Adding a case

1. Add it to `data` in [`module.f.mjs`](module.f.mjs).
2. `npm test` — the JavaScript proof now covers it, which is what makes the
   expectation authoritative: it is JavaScript's answer, not a guess.
3. `npm run ci-update` to regenerate, then `cargo test`.
4. If `nanvm-lib` does not implement it yet, give the case a `rust` reason. The
   generated file keeps it as a commented-out `TODO`, and the JavaScript proof
   keeps running it.

Never edit `test/generated.rs`: CI regenerates it on every pull request and
fails if the committed copy differs (see [`fjs/ci/README.md`](../../fjs/ci/README.md)).

## What is not shared

Two kinds of test stay hand-written, because there is nothing on the other side
to compare them with.

**JavaScript only** — `proof.f.mjs`'s `jsOnly` section: `ToPrimitive` consulting
an object's `toString` method, and a function's string form (engine-specific
source text). `nanvm-lib` has no object methods yet.

**Rust only** — `test/main.rs`: `try_into` out of `Any`, `Debug` formatting,
multi-limb bigint arithmetic, serialization round-trips, and the exact text of
`nanvm-lib`'s own error messages. These are properties of the VM, not of
JavaScript.

## Known divergence

`String(123n)` is `"123"` in JavaScript and `"0x7Bn"` in `nanvm-lib` — see
[bigint-decimal-string-coercion](../todo/bigint-decimal-string-coercion.md). The
two affected cases carry a `rust` reason, so the gap is recorded in the data
itself rather than in a coverage table here. That is the whole point of the
arrangement: a divergence is a property of a case, and it goes stale the moment
someone fixes it and the generated file starts including the case again.
