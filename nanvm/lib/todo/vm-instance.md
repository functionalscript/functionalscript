## A VM as an instance that holds its runtime

**Priority:** P3
**Status:** open — an idea of **sergey-shandar**'s, from the
`Object.entries` session
([#2984](https://github.com/functionalscript/functionalscript/pull/2984)),
to be adjusted before any code

### Problem

`IVm` is implemented by the value type itself: `naive`'s `Naive` is a
value, an `Unpacked<Naive>`, and `Any<A>` wraps an `A`. A VM is therefore a
type, never an instance, and its runtime cannot be anything a caller holds
or passes. `naive` keeps its runtime, `vm::Runtime` (the compiled
`fjs/js/runtime` object, and `Object.entries` created beside it), in a
`thread_local!` `OnceCell`, and answers `IVm::runtime_method` and
`IVm::runtime_static`, associated functions with no instance, from it.
The costs:

- **One runtime per VM type.** Different VMs may need different runtimes,
  and so may one VM: two runtimes cannot run side by side, to compare one
  against another, or to run a compiled compiler under the runtime the
  previous compiler wrote.
- **No VM that shares across threads.** A VM built on `Arc` instead of
  `Rc` could share one runtime between threads, but a runtime held per
  thread is a static of the thread and cannot be shared.
- **Hidden state, lazily initialized.** Which runtime answers is a global
  of the thread. The runtime is evaluated inside the lookup that first
  needs it, which works only because evaluating it asks for no binding, an
  invariant [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md)
  has to state and every runtime change has to keep.
- **The two executors disagree.** The represented interpreter already
  passes its runtime explicitly, in the `runtime` field of an `amnesia` or
  `memo` context ([`fjs/edag/operations`](../../../fjs/edag/operations/module.f.mjs)).

### Proposal

Split the VM from its value representation, and make the VM an instance
that holds its runtime:

```rust
/// A value of the VM `V`: what `Any<V>` wraps.
pub trait IAny<V: IVm>: Sized + Clone + From<Unpacked<V>> {
    fn to_unpacked(self) -> Unpacked<V>;
}

/// A VM: an instance, holding its runtime, and the types its values use.
pub trait IVm: Sized {
    type InternalAny: IAny<Self>;
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IFunction<Self>;
    /// A member call, dispatched: the receiver's own property, a native
    /// implementation, the runtime's body, or the `TypeError` for calling
    /// `undefined` — what `Member::call` resolves today.
    fn call(&self, receiver: Any<Self>, key: Any<Self>, args: Array<Self>)
        -> Result<Any<Self>, Any<Self>>;
    /// The static function at `path`, one function per runtime, or the
    /// failure naming the path — what `static_binding` answers today.
    fn static_function(&self, path: &[&str]) -> Result<Any<Self>, Any<Self>>;
}

// generated: every module takes the VM it runs on
pub fn module<V: IStaticFunction>(v: &V) -> Result<Any<V>, Any<V>> { … }
```

`Any<V>` wraps a `V::InternalAny`. `IAny::to_unpacked` is today's
`IVm::to_unpacked`, and the `From<Unpacked<Self>>` bound moves with it.
`naive` becomes a VM struct that holds its `Runtime`, beside a value type
that holds an `Unpacked`. `IVm::runtime_method`, `IVm::runtime_static`,
`static_binding` and the `thread_local!` all go: a VM instance answers
from the runtime it holds, initialized when it is built rather than
inside its first lookup.

### Critique and open questions

- **`v` reaches every call, not only the module.** A compiled closure that
  calls a member function, or reads a static, needs the VM. `StaticCode`
  is `fn(self_, args)` today, so either it gains the VM,
  `fn(v: &V, self_, args)`, with `IFunction::call(&self, v, args)` and
  every call site passing it on, or a closure captures the VM where the
  module is evaluated, which a frame of values cannot hold. The first
  is simpler, and it is the handle threaded through every call step that
  the runtime README's "Three places the binding could have lived"
  rejected. That trade has to be decided here.
- **Conversions call functions too.** `ToPrimitive` calls an object's own
  `toString` or `valueOf`, and array methods call their callbacks, so the
  coercions and the native member tables need `v` as well, not only the
  call step. The pure operators, arithmetic on numbers and strings, do not.
- **A runtime function's text should not need the VM.** `Function::text`
  now finds `Object.entries`'s text through the runtime
  (`vm::runtime_text`, over `IVm::runtime_static`). With a VM instance,
  that would make `String(f)` need `v`. A function that keeps its own
  name, and forms `runtime_to_string(name)` from it, keeps conversion free
  of the VM. That is a change to how a VM represents a function, so it
  belongs to this redesign.
- **`&V` or `V`.** The proposal passes `v: &V`. A VM that is a cheap
  handle, an `Rc` or an `Arc` over its runtime, could pass `V` by value,
  but a reference costs nothing either way.
- **`IVm::call` beside `IFunction::call`.** The name is overloaded: one
  calls a function value, the other dispatches a member call by key.
  `call_member` would read better.
- **Construction stays on the type.** `IStaticFunction::static_function`
  needs no runtime, so it can stay an associated function.
- **An `Arc` VM proves the split.** The last step builds one, with
  `Send + Sync` containers and a runtime shared across threads, so the
  design is checked against the case that motivates it.

### Tasks

- [ ] Settle the open questions above: how `v` reaches compiled closures,
      and how a runtime function keeps its name.
- [ ] Introduce `IAny`, and split `naive`'s value type from its VM type;
      `Any<V>` wraps `V::InternalAny`.
- [ ] Give the VM instance its runtime, and `call` and `static_function`.
      Remove `IVm::runtime_method`, `IVm::runtime_static`,
      `static_binding` and `naive`'s `thread_local!`.
- [ ] Make the Rust backend emit `module(v: &V)` and pass `v` on, then
      run `npm run gen`.
- [ ] Build an `Arc`-based VM that shares one runtime across threads.
- [ ] Update `fjs/js/runtime/README.md`: "How NaNVM finds it" and "Three
      places the binding could have lived".
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md): how
  each VM binds the runtime today, and the trade-off this reopens.
- [`src/vm/internal/mod.rs`](../src/vm/internal/mod.rs): `IVm` today.
- [`src/naive/mod.rs`](../src/naive/mod.rs): the thread-local.
- [`src/vm/runtime.rs`](../src/vm/runtime.rs): `Runtime`,
  `static_binding`, `runtime_text`.
- [`callable-function-objects.md`](./callable-function-objects.md): the
  function representation a runtime function's name would join.
