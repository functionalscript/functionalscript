## One `Module<A>` and one `exports(module)` for compiled modules

**Priority:** P3
**Status:** open

### Problem

`fjs compile` prints every module as
`pub fn module<A: IVm>(runtime: Any<A>) -> Result<Any<A>, Any<A>>`, and
`vm::runtime` is documented as "what whoever runs compiled modules builds
once". Nothing in `nanvm-lib` names a compiled module or turns one into its
export object, so every consumer re-derives "build the runtime, call the
module, refuse or unwrap a non-object, look a name up":

- [`nanvm/harness/src/lib.rs`](../../harness/src/lib.rs): its own
  `pub type Module<A> = fn(Any<A>) -> Result<Any<A>, Any<A>>`, a `runtime()`
  that expects the runtime value, and in `run`:
  `module(runtime::<A>()).map_err(RunError::Thrown)?.try_into().expect("a compiled module returns its export object")`
- [`nanvm/demos/src/lib.rs`](../../demos/src/lib.rs): a second `Module`
  alias, and in `load`:
  `Object::try_from(module(nanvm_lib::vm::runtime::<Naive>()?)?).map_err(|_| Any::from("module is not an object"))?`
- `default_of` in [`nanvm/harness/src/compare.rs`](../../harness/src/compare.rs):
  a third "the exports are not an object" message
- `export` in the harness's `tests/effects.rs`, and the same line in
  `tests/console.rs`, `tests/parity.rs`, several times in `tests/values.rs`
  and in the harness's own tests

At `ad3fb2dc` that is about fourteen instantiation sites and nineteen
`own_property(&"name".into())` lookups across the harness and demos, with
three distinct not-an-object messages or panics.

### Proposal

In `nanvm-lib`, beside `vm::runtime`:

```rust
/// A compiled module: what `fjs compile` prints.
pub type Module<A> = fn(Any<A>) -> Result<Any<A>, Any<A>>;
/// The module instantiated with the runtime value: its export object, or the throw.
pub fn exports<A: IVm>(module: Module<A>) -> Result<Object<A>, Any<A>>;
```

`exports` builds the runtime, calls the module and refuses a non-object with
one `error::` constructor. Optionally `export(module, name)`, which is what
every lookup site asks, or `Object::own_property` accepting `&str`.

### Tasks

- [ ] Add `Module` and `exports`, with tests.
- [ ] Delete both aliases, `harness::runtime`, the body of demos' `load`,
      `compare::default_of` and the test-file instantiation helpers.

### Related

- [fjs-vm-load-save](./fjs-vm-load-save.md) — a Load/Execute contract over
  the module graph and loader; this is the helper over one already-compiled
  module that such a loader would also use.
