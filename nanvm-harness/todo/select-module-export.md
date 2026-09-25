## Select a module export

**Priority:** P1
**Status:** open

### Problem

Generated modules already return the complete export object.
[`run`](../src/lib.rs) selects its `default` property and passes it directly
to JSON conversion. A named-only module cannot select an entry this way,
and a function-valued export is refused by JSON conversion without being called.
The MVP plans previously described that invocation as if it existed.

### Proposal

Keep the module result intact. Let the harness caller explicitly choose an
export name and whether to read its value or invoke it with supplied arguments.
`default` is one selectable name when present; no export name is mandatory.
Never invoke every exported function just because the module was loaded.

An absent selected export is a selection error, distinct from selecting a
present `undefined` value. Invocation of a non-callable value is an error.
Preserve module and call failures, and the current JSON refusal for unsupported
selected values or call results. Other exports need not be JSON-serializable.
Keep JSON/DataJS compiler value-output projection unchanged; this task changes
the harness consumer, not the EDAG module contract.

Keep `fjs compile` as a compiler that emits Rust; it does not run cargo.
This task can be implemented against `main` with empty/rest-only functions.
Named imports and the cross-module compiler acceptance fixture are implemented;
the fixture currently selects and calls its export directly through the VM API.

### API

One entry point replaces today's `run(module)`, whose only choice is
`default`:

```rust
/// What the harness does with the selected export.
pub enum Action<A: IVm> {
    /// Its value, as it stands.
    Read,
    /// Its result, called with these arguments.
    Call(Array<A>),
}

/// Why a run produced no JSON.
pub enum RunError<A: IVm> {
    /// The module threw while evaluating, or the called export threw.
    Thrown(Any<A>),
    /// `export` is not an own property of the export object: the name as
    /// the caller passed it.
    NoExport(std::string::String),
    /// `Action::Call` on a value that is not a function: that value.
    NotCallable(Any<A>),
    /// The selected value or call result has no JSON.
    Json(JsonError),
}

pub fn run<A: IVm>(
    module: fn() -> Result<Any<A>, Any<A>>,
    export: &str,
    action: Action<A>,
) -> Result<std::string::String, RunError<A>>
```

`Thrown` and `Json` are today's variants, unchanged. `NoExport` holds the
name as a Rust `String`, the `&str` the caller gave, copied: it is the
caller's text, never a VM value, and a Rust string compares and prints without
a VM. `NotCallable` holds the VM value itself. `Display`, `Debug` and
`PartialEq` stay hand-written, as today, and cover the two new variants.

`run` evaluates the module once, looks `export` up among the export object's
own properties, reads it or calls it, and renders that one value as JSON.
Nothing else in the object is called or serialized. `run(m, "default",
Action::Read)` is today's behaviour, and the existing tests move to that
spelling. There is no default action and no default export name: a caller
that wants `default` says so.

**Arguments are `nanvm-lib` values.** `Action::Call` takes the `Array<A>`
that `Function::call` already takes, built by the caller with the constructors
the generated code uses (`[f64_any(…)].to_array()`). A JSON or text form would
need a JSON reader, and `nanvm-lib` has none; adding one only to spell test
arguments is a separate decision. The acceptance example calls `main` with
`Array::default()`.

**`RunError` gains two variants** (above), so that each failure the problem statement
names is its own outcome:

| outcome | variant |
|---|---|
| the module threw while evaluating | `Thrown(value)`, as today |
| the called export threw | `Thrown(value)` |
| `export` is not an own property of the export object | `NoExport(name)` |
| `Action::Call` on a value that is not a function | `NotCallable(value)` |
| the selected value or call result has no JSON | `Json(error)`, as today |

`NoExport` is decided by own-property presence, not by value: an export
holding `undefined` is found, and reading it then fails as `Json`, since
`undefined` has no JSON, exactly as it does today. That needs an absent-aware
lookup: `nanvm-lib`'s `Object::own_property` already answers
`Option<Any<A>>`, `None` for an absent key, but it is `pub(crate)`, and the
public `Any::own_property` collapses `None` into `undefined`. This task makes
the `Object` one public; it adds no new lookup.

The call is two steps, both existing API: `Function::try_from` on the
selected value, whose failure is `NotCallable`, then `Function::call` with the
arguments, whose throw is `Thrown`. `try_from` takes the value by move and
fails with a fresh `"Type Error"` value, not the one it was given, so the
harness converts a clone (`Any` is `Clone`) and puts the selected value itself
in `NotCallable`, where a caller can see what it tried to call. `Any::call`, which the generated code uses,
takes its arguments as an `Any<A>` and does the conversion itself, so a
non-function would arrive as a thrown `TypeError`, indistinguishable from the
program throwing. A non-callable selection is the caller's mistake, not the
program's failure, so the harness does not use `Any::call`.

A module whose result is not an object is not a `RunError`: it panics, by
`expect`, when `run` converts the result to an `Object`. The code generator's
contract is that `module()` answers the export object, so any other result is
a generator bug, not an input. **This changes behaviour, on purpose.** Today a
nullish result already panics at the same `expect`, but any other non-object
does not: `Ok(42)` reaches `dot("default")`, which answers `undefined`, and
comes out as `Json(Undefined)`. That reports a broken module as a value with no
JSON, a plausible wrong answer where a refusal is owed
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
Nothing depends on it: the one hand-written module in the harness's tests,
`throwing`, answers `Err`, and every generated one answers an object.

**No CLI yet.** The binary in `src/main.rs` runs one compiled-in fixture and
keeps doing so, as `run(number::module, "default", Action::Read)`. Choosing a
module at run time means choosing among modules compiled into the binary, and
spelling arguments on a command line needs the text form ruled out above. The
MVP acceptance is a `cargo test`, which builds and runs the generated code with
cargo as the [roadmap](../../nanvm-lib/todo/mvp-roadmap.md) requires. A CLI is
its own task once a use for it exists.

### Proof

A new fixture, `fixtures/exports.mjs`, is named-only and holds one export of
each kind the table above has to tell apart:

```js
export const answer = [42];
export const add = (...a) => a[0] + a[1];
export const nothing = undefined;
export const fails = (...a) => a[0].x;
```

Against it:

- `Read` of `answer` gives `[42]`, and `Call` of `add` with `[20, 22]` gives
  `42`.
- `Read` of `missing` is `NoExport("missing")`. `Read` of `nothing` is
  `Json`, not `NoExport`.
- `Call` of `answer` is `NotCallable`. `Call` of `fails` with no arguments is
  `Thrown`.
- `Read` of `add` is `Json`, the function's own refusal, which also shows that
  reading a function does not call it.
- Evaluating the module succeeds although `fails` throws when called, which
  shows that loading a module calls none of its exports.

Default-only modules are the existing fixtures. The mixed case is
`named.mjs`, where `Read` of `z` and of `default` both give `[5]`.

### Tasks

- [x] Propose explicit export selection and read/call modes, including how
      the harness receives the invocation's argument list: [API](#api).
- [ ] Make `Object::own_property` public in `nanvm-lib`, with its tests.
- [ ] Implement `Action`, the new `run` and the two `RunError` variants; move
      the existing tests and `src/main.rs` to `run(…, "default", Action::Read)`.
- [ ] Add `fixtures/exports.mjs` to `npm run gen`, and cover
      named-only, default-only and mixed modules ([proof](#proof)); absent versus
      `undefined` exports; callable exports with supplied arguments;
      non-callable invocation; module/call failures; and non-JSON results.
      Prove that exported functions are not called during module evaluation
      or value selection and that selecting one retains other exports.
- [ ] Run the implemented [MVP example](../../todo/fjs-nanvm-integration.md#named-module-acceptance)
      through the new harness API, selecting and calling `main` to obtain `42`.
      Today the fixture's cargo test checks `42` through the VM API, and
      `namedImports.acceptance` in `fjs/fsc/edag/proof.f.mjs` checks it
      with both JavaScript EDAG evaluators on its own copy of the sources.
- [ ] Update the harness documentation and integration checklist when the
      behavior is implemented.

### Related

- [MVP roadmap](../../nanvm-lib/todo/mvp-roadmap.md).
- [fjs–nanvm integration](../../todo/fjs-nanvm-integration.md).
- [Module exports](../../spec/README.md#exporting-a-value).
