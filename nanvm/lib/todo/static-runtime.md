## A static runtime: built-ins as static functions, identified by name

**Priority:** P2
**Status:** wip — **sergey-shandar**'s design, from the `Object.entries`
session ([#2984](https://github.com/functionalscript/functionalscript/pull/2984))
and the review of the instance design this file first recorded, which it
supersedes.

### Problem

NaNVM *evaluates* its runtime. `gen.runtime.rs` is the compiled module
`fjs/js/runtime`, and evaluating it builds closures: every body is a
function with a frame, `is` holding `isNegativeZero` and `isNaN_` in its
slots, `startsWith` holding `found` and `position`. A function built twice
is two functions, so `Object.is === Object.is` holds only if one evaluation
is held and every read answers from it. That holder is the problem:

- **A `thread_local!`.** `naive` keeps the evaluated runtime in a
  thread-local `OnceCell`, initialized inside the first lookup that needs
  it. It is hidden per-thread state, lazily built, one per VM type and per
  thread, and it works only because evaluating the runtime asks for no
  binding, an invariant [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md)
  has to state and every runtime change has to keep. It should never have
  been written.
- **A lookup per read.** A compiled read of `Object.is` is
  `static_binding::<A>(&["Object", "is"])?`: a walk of the evaluated object
  by keys, answering a `Result`, for a value the parser resolved at compile
  time.
- **The wrong shape for a compiled VM.** The runtime is code. A VM that
  runs compiled code should hold no runtime state at all, and a program
  should reach a built-in the way it reaches any static function: by name,
  at no cost, with no evaluation behind it.

The first design recorded here made the VM an instance holding its runtime,
reached through `get(&self, name)` and carried by every function. It fixed
the holder's placement, not the evaluation: the runtime's own bodies would
hold the VM that held them, which is a cycle under `Rc`, and breaking the
cycle needed a second VM for the runtime to be built under. The
exploration is on the branch of the superseded pull request; none of it is
needed once the runtime is static.

### Proposal

**The runtime is static Rust code, and a built-in's identity is its name.**

#### A function is one of two kinds

```rust
/// A built-in: a static function the compiled runtime defines, generic
/// over the VM, described once and held by reference. `name` is its
/// identity, unique by construction; `code` is called directly;
/// `length` and `text` answer `f.length` and `String(f)`.
pub struct RuntimeFunction<A: IVm> {
    pub(crate) name: &'static str,
    pub(crate) code: fn(Array<A>) -> Result<Any<A>, Any<A>>,
    pub(crate) length: u32,
    pub(crate) text: &'static str,
}

pub enum Function<A: IVm> {
    /// What `IStaticFunction::static_function` makes: the VM's own value,
    /// an `Rc` in `naive`, compared by identity, `IComplex::ptr_eq`.
    Closure(A::InternalFunction),
    /// A built-in, compared by `name`.
    Runtime(&'static RuntimeFunction<A>),
}
```

`Unpacked::Function` stays one variant, so every match, `Dispatch` impl,
`typeof`, `instanceof`, conversion and JSON writer in the library is
untouched; `call`, `length`, `text`, `PartialEq` and `Debug` in
`vm/function` branch on the kind, and a closure is never equal to a
built-in. The alternative, a second `Unpacked` variant beside `Function`,
is the same model with every one of those sites changed, and is not taken.

The fields are the crate's: a descriptor is written by the compiled
runtime, which the crate includes through `#[path]`, and by `vm/runtime.rs`
for the one native no body defines, so the names are theirs to keep unique,
and no other crate can write a second descriptor under a name and have it
compare equal to the first.

**Equality compares `name`, never the reference.** A closure keeps
JavaScript's identity: `(() => 1) === (() => 1)` is `false`, and
`g(1) === g(1)` for `g = y => () => y` is `false`, as
[`spec/functions/names-and-identity.md`](../../../spec/functions/names-and-identity.md)
requires. A built-in is a singleton in JavaScript, so two reads of
`Object.is` are equal, and here they are equal by name whatever the
compiler did with the bytes. The reference is a handle to call and read
through, not an identity: the descriptor is a promoted constant inside a
generic function, which Rust compiles once per crate that instantiates it,
and once per codegen unit where it is inlined, so two handles to one
built-in may be two addresses. Debug builds share instantiations across
crates and release builds do not, so a pointer comparison would pass
`cargo test` and fail a release binary. Comparing the names is a short
`&'static str` compare that runs only when a program writes `===` between
two built-ins. `ptr::eq` as a shortcut before it is correct, and waits for
a measurement.

#### Every built-in is a static function with a generated accessor

```rust
// generated in gen.runtime.rs, one pair per body
fn object_is_code<A: IVm>(args: Array<A>) -> Result<Any<A>, Any<A>> { … }

pub fn object_is<A: IVm + 'static>() -> &'static RuntimeFunction<A> {
    &RuntimeFunction { name: "Object.is", code: object_is_code::<A>, length: 2, text: "…" }
}
```

The accessor allocates nothing: the literal is a constant expression, a
string literal, an integer and a function item coerced to a `fn` pointer,
so `&` of it is Rust's rvalue static promotion, evaluated at compile time
into read-only data. The `'static` bound lets a type naming `A` sit behind
a `'static` reference, which every VM type satisfies. Should a compiler
refuse the promotion, an associated `const` on a generic impl, read as
`&RuntimeFunction::<A>::OBJECT_IS`, is always promotable and reads the
same.

A built-in's `name` is JavaScript's own spelling of it: `Object.is` and
`Number.isInteger` for the `static` section,
`String.prototype.startsWith` for the `member` section. Its `text` is the
compiler's rendering of the body, as every compiled function's text is
today, as the interpreter answers it. Giving every runtime function the
NativeFunction text ECMA-262 requires of a built-in,
`function is() { [native code] }`, is
[`runtime-static.md`](../../../fjs/js/todo/runtime-static.md)'s open task,
decided for both executors alike; the static runtime makes NaNVM's side
one line, the descriptor's `text` formed from the name's last segment,
taken when the interpreter answers the same; `Object.entries`, the one native no body defines, is a hand-written
`RuntimeFunction` in `vm/runtime.rs` over `Any::entries` with
`ENTRIES_TEXT`, no longer created per VM.

#### Generated code reads a built-in as a value

A compiled read of `['Object.is']` prints `object_is::<A>().to_any()`: a
value, not an operation, so no `Result` and no `?`. One function on every
read, by name, and nothing for the VM to answer: `IVm::runtime_static`,
`IVm::runtime_method`, `static_binding`, `Runtime`, `runtime_object` and
`naive`'s `thread_local!` all go. The parser admits a static only from
[`fjs/js/static`](../../../fjs/js/static/module.f.js), and the accessors
are generated from the same runtime, so a static the parser admits and the
runtime lacks fails to compile; the completeness test over `STATICS` keeps
checking the names agree.

A member call's dispatch stays where it is, in `Member::call`: the
receiver's own property, the native table, then the runtime's body, now
`runtime::member::<A>(type_name, key)`, a generated match from the
receiver's type and the key to the body's accessor, then the `TypeError`
for calling `undefined`. The runtime README's resolution order is
unchanged; what it resolves to is a static function.

#### The runtime module is lifted, not evaluated

This is the compiler's work: a **static-module mode** of the Rust backend,
used by `fjs/nanvm/runtime` for `fjs/js/runtime` alone. Where the module
mode prints a scope of temporaries and closures with frames, the static
mode prints items:

- **Every module-level function is a static `fn`**, with no `self_` and
  no frame. Recursion through `self` is recursion of the `fn`; a loop
  function is a loop in place as it is today.
- **A frame slot is resolved at compile time.** A body's `['frame', i]`
  names a module-level node. One that is a function prints as that
  function's accessor, `is_nan::<A>().to_any()`; one that is a literal is
  inlined; one that is a module-level object read by a literal key,
  `{ isNegativeZero: c0 }.isNegativeZero`, which is how the lowering
  spells an import, is folded to the node it reads. Anything else at
  module level, an object or array a body would capture, is **refused**:
  the runtime's module scope holds functions and literals. The refusal
  names the node, and the runtime is written within the rule.
- **A function a body makes at call time is refused.** It would be a
  closure the VM makes, `A::static_function`, which bounds the item on
  `IStaticFunction` where every item, and so the tables and the lookups
  for any `A: IVm`, is bound on `IVm` alone. No body of the runtime makes
  one; the day one needs to, the bound is the question to answer.
- **The `runtime` export object is the table**, read at compile time:
  its `static` section gives the accessors their names and the generated
  user-code spelling, its `member` section gives `member`'s match. The
  object is printed nowhere and evaluated never.

A body may call another body, through a member call or by reading it as a
value: both resolve statically, so there is nothing a body may not do that
user code may, and the runtime README's rule that no initializer calls a
member function becomes a compile-time refusal, since an initializer that
calls anything cannot be lifted.

#### What this gives up

Two runtimes cannot run side by side on one VM type, and a VM cannot carry
a runtime of its own: the runtime is the library's code. The instance
design listed both as motivations; neither has a use today, and the
represented interpreter, which passes its runtime in its context, still
has them. A VM shared across threads needs nothing here: a static function
is `Sync`.

### Critique and open questions

- **A known callee as a direct Rust call.** A body calling a module-level
  helper, `found(self, s, start)`, prints as `Any::call` of the helper's
  accessor, through the generic call path, as every call does. A direct
  `found_code::<A>(args)` would skip the dispatch and is the obvious
  optimization; it waits for a measurement, as the design principles ask.
- **Helpers are named by index.** A module-level function no section
  names, `found`, `position`, `toNumber` or the imported `isNegativeZero`,
  is an item too, since a body reads it, and its descriptor needs a name:
  `f0`, `f1`, … in the module walk's order, since the EDAG keeps no
  source names. The name is unique against the sections' dotted names and
  observable only through `===` between two helpers, which no body
  writes; its accessor is the module's own, not exported.
- **Lifting's reach.** The rule "functions and literals" is what today's
  runtime needs. A future body wanting a module-level table, an array of
  code points say, meets the refusal; the answer then is a per-use
  construction, an `Rc` allocation per call, or a `static` of plain Rust
  data, decided when a body asks.
- **A loop function at module level** prints as an item that calls
  itself, through `Any::call` of its own accessor, where a closure of the
  same shape prints as a `loop`. Correct, and a round per stack frame;
  the runtime has no such function, and the loop printing joins the items
  when one does.
- **Helpers are named by index.** A module-level function no section
  names, `isNegativeZero` or `found`, is `f0`, `f1`, … in the walk's
  order, since the EDAG keeps no names. Its descriptor's `name` is that,
  unique and observable only through `===` between helpers, which no body
  writes.
- **`IStaticFunction` for closures only.** `static_function` stays the
  VM's capability to make a closure out of a Rust static function; a
  built-in needs no VM to be made. A VM that cannot run a body cannot run
  a built-in either, and there is no such VM.
- **The `IAny` split** ([#2998](https://github.com/functionalscript/functionalscript/pull/2998)),
  which separated the value type from the VM type for the instance design,
  is no longer needed by this one. It stays a cleaner trait; keeping it or
  dropping it is the owner's call and does not block this.

### Tasks

- [x] `RuntimeFunction<A>`, and `Function<A>` as its two kinds: `call`,
      `length`, `text`, equality by name, `Debug`. `Object.entries` as a
      hand-written `RuntimeFunction`. Tests: two reads of a built-in are
      equal and `same_value`; two closures from one arrow are not; a
      closure and a built-in are not.
- [x] The static-module mode of the Rust backend and the compiler's
      printer: items for module-level functions, frame slots resolved and
      folded, the refusal, accessors with names from the `static` and
      `member` sections, and the two tables. `fjs/nanvm/runtime` uses it
      for `gen.runtime.rs`. `IVm::runtime_static`, `IVm::runtime_method`,
      `Runtime`, `runtime_object` and `naive`'s `thread_local!` removed;
      `runtime_static(name)` and `runtime_method(type_name, key)` search
      the tables for any VM.
- [ ] Generated user code prints a static read as the accessor's value,
      and `static_binding` goes. `npm run gen`.
- [ ] Update `fjs/js/runtime/README.md`: "How NaNVM finds it", "Three
      places the binding could have lived", "Two invariants".
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md): how
  each VM binds the runtime today, and the thread-local this removes.
- [`fjs/js/static/module.f.js`](../../../fjs/js/static/module.f.js): the
  admitted statics, the names the accessors carry.
- [`fjs/edag/rust/module.f.mjs`](../../../fjs/edag/rust/module.f.mjs): the
  Rust backend the static-module mode joins.
- [`spec/functions/names-and-identity.md`](../../../spec/functions/names-and-identity.md):
  the identity a closure keeps.
- [`src/vm/function/mod.rs`](../src/vm/function/mod.rs): `Function<A>`.
- [`src/vm/runtime.rs`](../src/vm/runtime.rs): `Runtime`,
  `static_binding`, `object_entries`, `ENTRIES_TEXT`.
- [`src/naive/mod.rs`](../src/naive/mod.rs): the thread-local.
- [`callable-function-objects.md`](./callable-function-objects.md): the
  closure representation a built-in now sits beside.
