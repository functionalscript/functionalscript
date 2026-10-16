## Pass the runtime as an object, not a thread-local

**Priority:** P3
**Status:** open

### Problem

`naive` holds its runtime, `vm::Runtime` (the compiled `fjs/js/runtime`
object and `Object.entries`, created beside it), in a `thread_local!`
`OnceCell`. It has to, because `IVm::runtime_method` and
`IVm::runtime_static` are associated functions: they take no instance
and no argument that carries a runtime. The costs:

- **Hidden state.** Which runtime answers a call is a global of the
  thread, not something a caller passes or can see.
- **One runtime per VM type.** Two runtimes cannot run side by side,
  for example to compare one runtime against another, or to run a
  compiled compiler under the runtime the previous compiler wrote.
- **Lazy initialization inside the first lookup.** The runtime is
  evaluated within the lookup that first needs it. It works only because
  evaluating it asks for no binding, an invariant
  [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md) has to
  state and every runtime change has to keep.
- **The two executors disagree.** The represented interpreter already
  passes its runtime explicitly, in the `runtime` field of an `amnesia`
  or `memo` context ([`fjs/edag/operations`](../../../fjs/edag/operations/module.f.mjs)).

**sergey-shandar** asked for this issue in the `Object.entries` session
([#2984](https://github.com/functionalscript/functionalscript/pull/2984)),
which made the thread-local hold `Object.entries` too.

### Proposal

Replace the thread-local with a `runtime` object that is passed to the
functions that need it, as the interpreter's context passes it. The
candidates are the compiled module's `module`, `static_binding`, and the
call step's member lookup (`Member::call` and the `?.()` guard). Once
nothing reads the thread-local, `IVm::runtime_method`,
`IVm::runtime_static` and `naive`'s `RUNTIME` go.

The README's "Three places the binding could have lived" rejected a
runtime passed at call time: every generated call step and every
hand-written test would thread a handle. This issue reopens that
trade-off, and the first task decides how far the parameter reaches.

### Tasks

- [ ] Decide which functions take the runtime, and how a compiled
      closure reaches it: through its frame, captured where the module
      is evaluated, or as an argument of each call.
- [ ] Make the Rust backend emit the parameter, and run `npm run gen`.
- [ ] Remove `naive`'s `RUNTIME` thread-local and the `IVm` runtime
      hooks.
- [ ] Update `fjs/js/runtime/README.md`: "How NaNVM finds it" and "Three
      places the binding could have lived".
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md) — how
  each VM binds the runtime today, and the trade-off this reopens.
- [`src/naive/mod.rs`](../src/naive/mod.rs) — the thread-local.
- [`src/vm/runtime.rs`](../src/vm/runtime.rs) — `Runtime`, `static_binding`.
