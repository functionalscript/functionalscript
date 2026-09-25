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
module.f.mjs ──> an EDAG exp ─┤     (amnesia)
 (data + the     per case     └─> rust/module.f.mjs ──> gen.corpus/ ──────> nanvm-lib
  lowering)                          (print)             (generated)
```

## Files

| File | Role |
|---|---|
| [`types.ts`](types.ts) | The shape of the data: `Value`, `Case<N>`, `Group`, `Data`. |
| [`module.f.mjs`](module.f.mjs) | **The single source of truth** — every operator case as data, plus the format's constructors, eliminators, and lowering. |
| [`proof.f.mjs`](proof.f.mjs) | Evaluates each case's expression on a JavaScript engine. |
| [`rust/module.f.mjs`](rust/module.f.mjs) | Prints each case's expression as Rust, against the `nanvm-lib` API. |
| [`methods/module.f.mjs`](methods/module.f.mjs) | The member functions `nanvm-lib` does not answer yet, and the completeness table printed from them and [`fjs/js/prototype`](../js/prototype/module.f.mjs). |
| [`update/module.f.mjs`](update/module.f.mjs) | Writes both printers' output. Run by `npm run gen`. |

Rust *literal* syntax — string escaping, `f64`/`i64` spelling, `snake_case`
identifiers — is not specific to this generator and lives in
[`fjs/media/rust`](../media/rust/module.f.mjs). Rust *names* for the operations
are the printer's own explicit map, never `snakeCase` over a canonical id. A
method group's name is the exception that proves it: a method name is already
an identifier, so its function is `method_` and the name in snake case.

## The operations come from EDAG

An operation is named by its canonical [`fjs/edag`](../edag/README.md) id and
nothing else — `-`, `*`, `String` — imported from the schema and its
type-level API rather than restated here. That buys three things a
NaNVM-specific vocabulary did not:

- **Arity is not an annotation.** An operation's operand count is which
  vocabulary its id belongs to: an `Op1Id` group carries `Case<1>`, an `Op2Id`
  group `Case<2>`, an `Op3Id` group `Case<3>`. A unary operation given two
  operands is a type error.
  `arityOf` is the same rule at runtime, asked of the schema rather than of a
  second copy of the vocabulary — a consumer walking `data.groups` holds a
  `Group` whose arm is no longer known, and that is what it dispatches on.
  The one exception is the `Op12Id` vocabulary, `+` and `-`, whose ids are
  legal at both counts: a `Group12` says `arity: 1` or `arity: 2` itself, and
  its arm fixes `Case<1>` or `Case<2>` the same way.
- **`ref` is node sharing.** Two `ref`s to one name lower to one node reached
  twice, which is what EDAG sharing *is*. The proof memoizes nodes by identity
  within a case and the printer emits one `let` binding cloned at each
  reference, so `arrayByItself` means "the same object" on both sides.
- **The two cannot drift.** The ids are spelled as literals, so respelling one
  in `fjs/edag/types.ts` fails `tsc` here; and the proof's `edagShape`
  validates every derived expression against the schema, so an operand shape or
  validation rule changing under the corpus fails there.

There is no exception: every group's operation is an EDAG id, and every case
lowers to an expression that both consumers read. That includes what
`&&`/`||`/`??`/`?:` are for — leaving their unselected operand
unestablished — through the `unreached` operand: it lowers to `1n / 0n`,
an operation that throws when established, so `false && unreached` answers
`false` on either side only because neither side touched it. `amnesia`
establishes a lazy operand only when the operator selects it, and the Rust
printer prints one as the thunk `nanvm-lib`'s four methods take — an `impl
FnOnce() -> Result<Any<A>, Any<A>>` they call at most once, here `||
bigint_any(1) / bigint_any(0)`, the operation's own `Result`
([`fjs/edag/rust`](../edag/rust/module.f.mjs), `lazy`).

A **method group** is the one kind that is not an operator: `{ method: 'at',
cases }` holds the cases of a built-in member function, and each case's `args`
are the receiver and then the call's arguments. It lowers to the chain node a
compiled `receiver.at(...args)` is, `['.', receiver, 'at', ['|()', ['[]',
args]]]` ([Chains](../edag/README.md#chains)), which `amnesia` calls on the
host's own built-in and the Rust printer prints as `Any::dot(…).end_call(…)`,
the call a compiled module makes. The method name is typed as
[`fjs/js/prototype`](../js/prototype/README.md)'s `allowedCalls`, so a refused
name is a type error; which of them `nanvm-lib` answers is pinned separately,
by the completeness table [`methods/`](methods/module.f.mjs) generates.

A `functionValue` operand is not an exception. It lowers to `() => undefined`,
the smallest closure — `['=>', ['[]', []], ['undefined']]` — which `amnesia`
establishes like any `=>` and the Rust printer renders as the harness's one
function value, `function_any()`; honest because no operator here inspects
the function, and refused for any other lambda, since `nanvm-lib` has no
closures to print. The one thing the two sides do not share is a function's
string form (engine-specific in JS, a placeholder in `nanvm-lib`), so no case
stringifies one, nested or not — see `FunctionValue` in [`types.ts`](types.ts).

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
{ op: '~', cases: [...] },                         // one operand each
{ op: '*', commutative: true, cases: [...] },      // two
{ op: '-', arity: 1, cases: [...] },               // `-` is also binary, so the group says
{ method: 'at', cases: [...] },                    // the receiver, then the arguments
```

Five things a literal cannot express are written as thunks — a function in the
data is always a *description*, never a value that happens to be a function:

| Thunk | Means |
|---|---|
| `functionValue` | a function value, lowered to `() => undefined` (no operator here inspects which one) |
| `callback(name)` | a function with a body, one of `callbacks` — `args`, `(...a) => a`, answers what it was given — for the member functions that call one, such as `map` |
| `ref(name)` | one of `data.shared`'s values, so the *same* object reaches every `ref` to that name |
| `throws` | the case must throw; valid only as `expected` |
| `unreached` | an operand the operation must not establish, lowered to `1n / 0n`, which throws if it is; for the lazy positions of `&&`/`||`/`??`/`?:` |

`expected` is compared structurally: `Object.is` at every leaf, so `NaN`
matches `NaN` and `0` does not match `-0`, and arrays and objects by their
elements and properties, since a method such as `map` answers a fresh array.
The Rust side compares the same way. It describes the test's
outcome and not the program, so it is never part of the case's expression.

## The loop

1. Add the case to `data` in [`module.f.mjs`](module.f.mjs).
2. `npm test` — the JavaScript proof now covers it, which is what makes the
   expectation authoritative: it is JavaScript's answer, not a guess.
3. `npm run gen` to regenerate, then `cargo test`.
4. If `nanvm-lib` does not implement it yet, give the case a `rust` reason. The
   generated file keeps it as a commented-out `TODO`, and the JavaScript proof
   keeps running it.

Never edit `nanvm-lib/tests/test/gen.corpus/`: CI regenerates it on every pull
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
