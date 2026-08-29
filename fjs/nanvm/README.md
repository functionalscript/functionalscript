# The FunctionalScript side of NaNVM

`nanvm-lib/` is the Rust crate. This directory is the FunctionalScript that
targets it — today the shared operator test data and the printer that turns it
into Rust tests; later the `.rs` output branch of `fjs compile` (see
[`nanvm-lib/todo/mvp-roadmap.md`](../../nanvm-lib/todo/mvp-roadmap.md)).

Operator behaviour is described **once**, as data, and checked twice: against a
standard JavaScript engine and against `nanvm-lib`. Adding an operator or a case
means editing one file.

A case is not only data, though. Joined with its group's operation it denotes a
*program* — apply that operation to constant operands — and `module.f.mjs`
lowers it to exactly that: an [EDAG](../edag/README.md) expression. Both
consumers read the expression rather than each reading the case its own way.

```text
                              ┌─> proof.f.mjs ──────────────────────────> a JS engine
module.f.mjs ──> an EDAG exp ─┤     (evaluate)
 (data + the     per case     └─> rust/module.f.mjs ──> generated.rs ──> nanvm-lib
  lowering)                          (print)             (generated)
```

## Files

| File | Role |
|---|---|
| [`types.ts`](types.ts) | The shape of the data: `Value`, `Case<N>`, `Group`, `Eq`, `Data`. |
| [`module.f.mjs`](module.f.mjs) | **The single source of truth** — every operator case as data, plus the format's constructors, eliminators, and lowering. |
| [`proof.f.mjs`](proof.f.mjs) | Evaluates each case's expression on a JavaScript engine. |
| [`rust/module.f.mjs`](rust/module.f.mjs) | Prints each case's expression as Rust, against the `nanvm-lib` API. |
| [`update/module.f.mjs`](update/module.f.mjs) | Writes the printer's output. Run by `npm run ci-update`. |

Rust *literal* syntax — string escaping, `f64`/`i64` spelling, `snake_case`
identifiers — is not specific to this generator and lives in
[`fjs/media/rust`](../media/rust/module.f.mjs). Rust *names* for the operations
are the printer's own explicit map, never `snakeCase` over a canonical id.

## The operations come from EDAG

An operation is named by its canonical [`fjs/edag`](../edag/README.md) id and
nothing else — `neg`, `*`, `String` — imported from the schema and its
type-level API rather than restated here. That buys three things a
NaNVM-specific vocabulary did not:

- **Arity is not an annotation.** An operation's operand count is which
  vocabulary its id belongs to: an `Op1Id` group carries `Case<1>`, an `Op2Id`
  group `Case<2>`. A unary operation given two operands is a type error.
  `arityOf` is the same rule at runtime, asked of the schema rather than of a
  second copy of the vocabulary — a consumer walking `data.groups` holds a
  `Group` whose arm is no longer known, and that is what it dispatches on.
- **`ref` is node sharing.** Two `ref`s to one name lower to one node reached
  twice, which is what EDAG sharing *is*. The proof memoizes nodes by identity
  within a case and the printer emits one `let` binding cloned at each
  reference, so `arrayByItself` means "the same object" on both sides.
- **The two cannot drift.** The ids are spelled as literals, so respelling one
  in `fjs/edag/types.ts` fails `npx tsc` here; and the proof's `edagShape`
  validates every derived expression against the schema, so an operand shape or
  validation rule changing under the corpus fails there.

One group is the visible exception. `unaryPlus` has no canonical id — the EDAG
has no unary `+` — so it is a `NonEdagGroup`, spelled `nanvmOp` rather than
`op` precisely so a NaNVM-only name can never mix into a canonical id union. It
becomes the `Number` cast, a semantic change rather than a rename, through
[replace-unary-plus-with-number](../../nanvm-lib/todo/replace-unary-plus-with-number.md).

A case carrying a `functionValue` operand is the other. A constant function is
writable as `['=>', ['[]', []], body]`, but establishing `=>` would drag
closure construction into both consumers for cases that never inspect the
function, so such a case is marked `['escape']` and takes the direct-value
path. The escape is per case, not per group: `neg` is EDAG-backed and still
carries one.

## Writing a case

Operands and expectations are ordinary JavaScript values, following
[`fjs/rtti`](../rtti/README.md)'s convention that a constant is its
own description:

```js
{ name: 'arrayNumber', args: [[2.3]], expected: 2.3 },
{ name: 'emptyObjectByOne', args: [{}, 1], expected: NaN },
{ name: 'bigint', args: [0n], expected: throws },
```

The group says which operation they are operands of, and how many of them
there are:

```js
{ op: 'neg', cases: [...] },                       // one operand each
{ op: '*', commutative: true, cases: [...] },      // two
```

Three things a literal cannot express are written as thunks — a function in the
data is always a *description*, never a value that happens to be a function:

| Thunk | Means |
|---|---|
| `functionValue` | a function value (no operator here inspects which one) |
| `ref(name)` | one of the `eq` `shared` values, so the *same* object reaches both sides |
| `throws` | the case must throw; valid only as `expected` |

`expected` is compared with `Object.is`, so `NaN` matches `NaN` and `0` does not
match `-0`. The Rust side compares the same way. It describes the test's
outcome and not the program, so it is never part of the case's expression.

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
