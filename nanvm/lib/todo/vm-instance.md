## A VM as an instance that holds its runtime

**Priority:** P3
**Status:** wip — an idea of **sergey-shandar**'s, from the
`Object.entries` session
([#2984](https://github.com/functionalscript/functionalscript/pull/2984)).
The static read, `get`, and its contract are **sergey-shandar**'s
decisions, below; how `v` reaches a compiled closure is still open.

### Problem

`IVm` was implemented by the value type itself: `naive`'s `Naive` was a
value, an `Unpacked<Naive>`, and `Any<A>` wrapped an `A`. The two are
split now, `IAny` below, but a VM is still a type, never an instance, and
its runtime cannot be anything a caller holds or passes. `naive` keeps its runtime, `vm::Runtime` (the compiled
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
- **Every read may fail.** `static_binding` answers a `Result` on each
  read of a static function, for a runtime that failed to evaluate or a
  VM that binds nothing. Neither is the read's failure: the parser
  admitted the name, so a VM that cannot answer it cannot run the
  program, and should have failed when it was built.
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
/// Borrowed down the call stack, never owned by a value.
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
    /// The static function the VM holds under `name`, the EDAG's spelling
    /// of it, `Object.is`. The same `&self` and the same `name` answer the
    /// same `Any`: the VM creates each function once, when it is built,
    /// and `get` reads it.
    fn get(&self, name: &str) -> Any<Self>;
}

// generated: every module takes the VM it runs on, and reads a static
// function from it
pub fn module<V: IStaticFunction>(v: &V) -> Result<Any<V>, Any<V>> {
    …
    let c4: Any<V> = v.get("Object.is");
    …
}
```

`Any<V>` wraps a `V::InternalAny`. `IAny::to_unpacked` is today's
`IVm::to_unpacked`, and the `From<Unpacked<Self>>` bound moves with it.
`naive` becomes a VM struct that holds its `Runtime`, beside a value type
that holds an `Unpacked`. `IVm::runtime_method`, `IVm::runtime_static`,
`static_binding` and the `thread_local!` all go: a VM instance answers
from the runtime it holds, built when the VM is built rather than inside
its first lookup.

#### The static read, `get`

**The VM creates every function; generated code only consumes them.**
That is what `Runtime` already is — the compiled object evaluated once and
`Object.entries` created once beside it — held in the wrong place, a
thread-local on the type. The instance design moves the holder to `&self`
and gives the read one shape, `get`, whose whole reason to exist is this
contract:

- **The same `&self` and the same `name` answer the same `Any`.** `get`
  is a read, never a creation: it answers a clone of a value the instance
  holds, which in `naive` is an `Rc` clone, so `v.get("Object.is") ==
  v.get("Object.is")` holds by reference — JavaScript's `Object.is ===
  Object.is`, and what the interpreter gets from holding one runtime in
  its context. A created function, `Object.entries`, is stored by the
  constructor, as `Runtime::new` stores it today, never built inside
  `get`. Each VM's tests assert the contract: one instance answers one
  function however often it is asked.
- **Two instances are two runtimes.** `a.get(x) != b.get(x)` is allowed
  and wanted; it is what lets two runtimes run side by side. `Runtime`'s
  `created_entries` test asserts it already.
- **No `Result`.** The failure moves from every read to the one place it
  belongs, construction: `Runtime::new` answers a `Result`, the runtime
  evaluated once, and so does the constructor of a VM that holds one. A
  read of a static function cannot fail, since the parser admits a name
  only from [`fjs/js/static`](../../../fjs/js/static/module.f.js) and
  every executor must answer it. The default that binds nothing goes
  with it: a VM that answers no static function can run no compiled
  program, and the API is not shaped around it. A `name` the VM does not
  know is a toolchain bug — generated code and the library built from
  different lists — and is a panic, which the completeness test over
  `STATICS` in `vm/lambda` keeps guarding.
- **The name is the EDAG's spelling.** The EDAG spells the node
  `['Object.is']`; splitting it into keys exists only to walk the
  JavaScript runtime object, `functionAt`. In Rust the walk is not needed:
  `Runtime` holds each function built at construction and matches the
  name, so the Rust backend prints `v.get("Object.is")`, the node one for
  one, where it prints `static_binding::<A>(&["Object", "is"])?` today. The
  compare over a handful of arms per read is not worth a thought until
  measured.
- **Alternatives considered.** One typed method per static,
  `fn object_is(&self) -> Any<Self>`, makes an unknown name a compile
  error, but puts the admitted list into `IVm`, so the core trait changes
  and must be generated with every built-in admitted, where `get` keeps
  the trait handwritten and the names in `Runtime`, the generated side. A
  generated `enum Static` as the key would give an exhaustive match with
  one method; it is kept in reserve for the day a mismatch bites, which
  the completeness test is there to prevent.
- **Members stay a key lookup.** A member call dispatches on the
  receiver's type, known only when it runs, so `IVm::call` keeps asking
  the runtime by type and key, as `Runtime::method` does today. `get`
  covers what is known when the module is compiled: the statics.
- **A created function gets its text at creation.** `Function::text`
  used to find `Object.entries`'s text by comparing identities through
  the runtime, `runtime_text` over `IVm::runtime_static`, which an
  instance would have made need `v`. The VM creates the function, so it
  gives it its text, `vm::ENTRIES_TEXT`, a `&'static str` as every other
  text is, and `String(f)` needs no VM. Done; the first step of the
  stack. A generated body's text stays the compiler's,
  as today; giving the bodies NativeFunction text is
  [`runtime-static.md`](../../../fjs/js/todo/runtime-static.md)'s open
  task, not this one.

### Critique and open questions

- **`v` reaches every call, not only the module.** A compiled closure that
  calls a member function, or reads a static, needs the VM, and `get`
  does not change that: `nanvm/harness/fixtures/object-is.mjs` reads
  `Object.is` inside `read = () => Object.is`, so the read is inside the
  closure's body. `StaticCode` is `fn(self_, args)` today, so either it
  gains the VM, `fn(v: &V, self_, args)`, with `IFunction::call(&self, v,
  args)` and every call site passing it on, or a closure captures the VM
  where the module is evaluated, which a frame of values cannot hold. The
  first is simpler, and member calls inside closure bodies, `.map` and
  `.startsWith`, need it whatever the statics do; it is the handle
  threaded through every call step that the runtime README's "Three
  places the binding could have lived" rejected. That trade has to be
  decided here; the leaning is the first.
- **Conversions call functions too.** `ToPrimitive` calls an object's own
  `toString` or `valueOf`, and array methods call their callbacks, so the
  coercions and the native member tables need `v` as well, not only the
  call step. The pure operators, arithmetic on numbers and strings, do not.
- **`&V`, borrowed.** `IVm::call` takes `&self`, and generated code
  `v: &V` (**sergey-shandar**, agreeing after `self` was first written
  here). A module and every call inside it run within the caller's stack,
  so the VM is borrowed down it: no `Rc` or `Arc` count changes per call,
  no `Clone` bound, and a VM may be a plain struct that owns its runtime.
  An `Arc` VM shared across threads is a `&` to a `Sync` VM. A function
  value that escapes, a module's export called later, holds no VM: its
  caller passes one. `self` by value would come back only if a VM threads
  state through calls, a gas or memory budget for the language's memory
  and time failures, as `fn call(self, …) -> (Self, Result<…>)`; a counter
  in a `Cell` behind `&self` is the alternative.
- **`IVm::call` beside `IFunction::call`.** The name is overloaded: one
  calls a function value, the other dispatches a member call by key.
  `call_member` would read better.
- **Construction stays on the type.** `IStaticFunction::static_function`
  needs no runtime, so it can stay an associated function.
- **An `Arc` VM proves the split.** The last step builds one, with
  `Send + Sync` containers and a runtime shared across threads, so the
  design is checked against the case that motivates it.

### Tasks

- [ ] Settle how `v` reaches compiled closures, above.
- [x] Introduce `IAny`, and split `naive`'s value type from its VM type;
      `Any<V>` wraps `V::InternalAny`.
- [ ] Give the VM instance its runtime, built once by a constructor that
      answers a `Result`, with `call` and `get`. Remove
      `IVm::runtime_method`, `IVm::runtime_static`, `static_binding` and
      `naive`'s `thread_local!`.
- [x] Give `Object.entries` its text at creation, and drop the identity
      comparison in `Function::text`.
- [ ] Test `get`'s contract on every VM: the same instance answers the
      same function by reference, and two instances answer two.
- [ ] Make the Rust backend emit `module(v: &V)`, print a static read as
      `v.get("Object.is")`, and pass `v` on; then run `npm run gen`.
- [ ] Build an `Arc`-based VM that shares one runtime across threads.
- [ ] Update `fjs/js/runtime/README.md`: "How NaNVM finds it" and "Three
      places the binding could have lived".
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md): how
  each VM binds the runtime today, and the trade-off this reopens.
- [`fjs/js/static/module.f.js`](../../../fjs/js/static/module.f.js): the
  admitted statics, the names `get` answers.
- [`fjs/edag/rust/module.f.mjs`](../../../fjs/edag/rust/module.f.mjs): the
  Rust backend, which prints a static read.
- [`src/vm/internal/mod.rs`](../src/vm/internal/mod.rs): `IVm` today.
- [`src/naive/mod.rs`](../src/naive/mod.rs): the thread-local.
- [`src/vm/runtime.rs`](../src/vm/runtime.rs): `Runtime`,
  `static_binding`, `ENTRIES_TEXT`.
- [`callable-function-objects.md`](./callable-function-objects.md): the
  function representation this redesign touches.
