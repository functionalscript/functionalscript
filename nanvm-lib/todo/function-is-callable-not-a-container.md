## A function value is callable, not a container

**Priority:** P2
**Status:** open

### Problem

`IVm` describes a function value as a container of bytes:

```rust
type InternalFunction: IContainer<Self, Header = FunctionHeader<Self>, Item = u8>;
```

with `FunctionHeader<A> = (String<A>, u32)`, a name and a length. The shape
predates the EDAG: it was drawn for a bytecode nothing ever produced, and
the bytes are populated by nothing. The name is a second anachronism — the
language erased it ([spec](../../spec/README.md#functions): a function
carries no name, and no program observes one) — and today it is read only
by `Debug`, which prints it beside invented parameter names and the unused
bytes in hex. The only constructions of a function value are the corpus
harness's `function_any`, two tests in `tests/test/main.rs`, and one in
`any/to_json.rs` — each stuffing an empty container to have something a
function-shaped `Any` can refuse. (`to_json` does not belong under `vm/` at
all; [to-json-fjs-migration.md](./to-json-fjs-migration.md) retires it, and
its test goes with it.)

What a program can observe of a function is what the contract should be:
it can be called, it has a `length`, it has a `String(f)` spelling, and it
has an identity, since `===` compares functions by reference. Nothing else.
In particular a program cannot look inside one: FunctionalScript has no
function constructor and no way to read a function's code, since either
would break compatibility with JavaScript. So the VM decides for itself
what a function *is* — a static Rust function, an EDAG it interprets, or
both — and nothing in `nanvm-lib`'s core may depend on the choice.

### Proposal

Identity is shared by every heap value, so it moves to a parent trait, and
the two kinds of heap value each add what only it has:

```rust
/// A heap value: cloned by reference, compared by identity.
pub trait IComplex<A: IVm>: Sized + Clone {
    fn ptr_eq(&self, other: &Self) -> bool;
}

/// A sequence with a header — a string, a bigint, an array, an object.
pub trait IContainer<A: IVm>: IComplex<A> {
    type Header: PartialEq + Clone;
    type Item: Debug + Clone;
    type Items: ?Sized + SizedIndex<usize, Output = Self::Item>;
    fn new<E>(header: Self::Header, i: impl IntoIterator<Item = Result<Self::Item, E>>) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn items(&self) -> &Self::Items;
}

/// A function: what a program can do with one, and nothing it cannot.
pub trait IFunction<A: IVm>: IComplex<A> {
    fn call(&self, args: Array<A>) -> Result<Any<A>, Any<A>>;
    fn length(&self) -> u32;
    fn to_string(&self) -> String<A>;
}
```

and `IVm` binds `type InternalFunction: IFunction<Self>`. `Function<A>`
exposes exactly `call`, `length`, `to_string` and `PartialEq` by identity;
`name` and the header go, and `Debug` prints `to_string`'s text, which is
`String(f)`'s spelling. `IContainer` keeps `items_eq` and `new_ok` as the
extensions they are; `'static` is on neither trait, since nothing stores a
value where it would be needed and `IVm` itself carries no such bound.

**No constructor on `IFunction`.** A holder of a `Function<A>` can only run
it, which is the language's own rule. Construction is each VM's own:

- `naive` binds a static Rust function, usually a generated one, through a
  constructor of its own. That is the whole of the MVP: no EDAG
  interpreter, a VM that can only link static functions, and a compiler
  that produces them. A generic trait for binding a Rust static function,
  which a module generic over the VM would bound on, may come later; it is
  not this design's.
- A VM that interprets may build a function from an EDAG. That is its own
  API, reached from a program only through an effect — `createFunction(e:
  Edag) => Function`, with `getEdag(f: Function) => Edag` beside it — which
  is the one door the language allows to the outside world, so
  compatibility holds: a program cannot make a function out of data by
  itself, and cannot tell how a function it holds was made.
- A VM may hold both kinds: an enum with a variant per representation,
  compiled code for the main program and an EDAG for a function made at
  run time. `call`, `length`, `to_string` and `ptr_eq` dispatch on the
  variant, and from outside, through `Function<A>`, the two are one type
  that composes freely — a compiled function calls a dynamic one it was
  handed, and a dynamic one calls a compiled one it captured.

**`naive` holds a static function.** Its `InternalFunction` is an `Rc`
over one object: the static `fn` pointer, the `length`, and the captured
`frame: Array<Naive>`. The object's pointer is the function's identity —
`ptr_eq` compares the `Rc` — so identity depends on nothing the generator
does: every construction is a new object, and every non-capturing function
may share one empty frame. The static function receives the frame, the
length, the function value itself and the arguments, the arguments by
value, as every operator on `Any` takes its operands:

```rust
type Code = fn(frame: &Array<Naive>, length: u32, self_: &Function<Naive>, args: Array<Naive>) -> Result<Any<Naive>, Any<Naive>>;
```

One signature for every function, whether or not its body uses each
parameter: an unused `self_` costs nothing, and one convention is simpler
than a family. `call` reads the frame and the length out of the object and
passes them, so `Function<A>` exposes no `frame()` — that would be the
access to internals this design refuses — and passes the function value
itself, which is what the body's `["self"]` names for recursion
([callable-function-objects.md](./callable-function-objects.md)). All of
this is `naive`'s own; nothing of it reaches `IFunction`.

`to_string` is owed before the MVP: `String(f)` is source reconstructed
from the function's EDAG ([spec](../../spec/README.md)), serializable data
a program returns, so the object will carry the text the generator prints
from the EDAG. Until then `naive`'s `to_string` panics as unimplemented — a
loud gap, never a plausible value in its place. `naive` holds no EDAG: it
stays the simple VM an AOT target wants, and every headache of
interpreting or building code stays in the compiler.

This is also the shape a NaN-boxing VM needs: an `Any` there is one word,
so a function value is one pointer to an object holding everything else.

This decides the representation question
[callable-function-objects.md](./callable-function-objects.md) left open
between two container-shaped options: there is no container to fit a code
pointer into. That document's staged plan — parameters, captured values,
self-reference, the generator — is unchanged and builds on this shape.

### Tasks

- [ ] `IComplex`, `IContainer: IComplex`, `IFunction: IComplex`; `IVm`
      binds `InternalFunction: IFunction<Self>`.
- [ ] `naive` implements `IFunction` as an `Rc` over the `fn` pointer, the
      `length` and the captured frame, identity the `Rc`'s, with a
      constructor of its own; `call` passes the frame, the length, `self`
      and the arguments; `to_string` panics as unimplemented.
- [ ] `Function<A>`: `call`, `length`, `to_string`, identity; `name`, the
      header and the `pub` field go; `Debug` prints `to_string`.
- [ ] `function_any` in the corpus harness and the three test
      constructions go through `naive`'s constructor. `function_any` is
      generic over the VM today and the corpus's generated functions call
      it; with construction `naive`'s own, either the generated corpus
      binds to `naive` — it runs on `naive` alone today — or the binding
      trait comes with this change. Decided at implementation, the smaller
      change preferred.
- [ ] A test that `call` runs the code with its frame, its arguments and
      itself, that two functions made from the same code and frame are not
      `===`, and that a function and its clone are.
- [ ] `to_string` carries the text the generator prints from the EDAG,
      before the MVP.
- [ ] Declare the `IVm` break.
- [ ] `cargo test`, `cargo clippy --all-targets`, `cargo fmt -- --check`;
      `npm run gen` with no drift.

### Related

- [callable-function-objects.md](./callable-function-objects.md) — the
  staged plan this shape is the foundation of.
- [mvp-roadmap.md](./mvp-roadmap.md) — the `Function` constructor and
  interpreter item, which is a VM's own capability under this design, not
  the core's.
- [`../src/vm/internal/mod.rs`](../src/vm/internal/mod.rs),
  [`../src/vm/function/mod.rs`](../src/vm/function/mod.rs) — the bound and
  the type this replaces.
- [spec: functions](../../spec/README.md#functions) — no name, no
  constructor, identity by reference.
