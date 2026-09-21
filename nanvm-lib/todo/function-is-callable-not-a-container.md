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
harness's `function_any` and two tests, each stuffing an empty container to
have something a function-shaped `Any` can refuse.

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
it, which is the language's own rule. Construction is a *capability of a
VM*, in a trait of its own:

- Generated code is generic over the VM and must build the function values
  a compiled module holds, so a compiled module bounds on a capability
  trait whose one method makes a function from a static `fn` pointer and
  its captured `Array<A>` — the compiled kind. `naive` implements it. The
  corpus harness's `function_any` needs the same bound, and says so.
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
around a `fn(captured: &Array<Naive>, args: &Array<Naive>) -> Result<Any<Naive>, Any<Naive>>`,
the captured `Array<Naive>` and the `length`. A `fn` pointer is `Copy`,
`PartialEq` and allocates nothing of its own; the `Rc` is the one allocation
every function value needs, since each evaluation of an arrow is a new
function in JavaScript, and `ptr_eq` compares it. `to_string` answers
`() => {}` until a spelling exists — low priority, and honest: the VM knows
the value is a function and nothing more. `naive` holds no EDAG: it stays
the simple VM an AOT target wants, and every headache of interpreting or
building code stays in the compiler.

This decides the representation question
[callable-function-objects.md](./callable-function-objects.md) left open
between two container-shaped options: there is no container to fit a code
pointer into. That document's staged plan — parameters, captured values,
self-reference, the generator — is unchanged and builds on this shape.

### Tasks

- [ ] `IComplex`, `IContainer: IComplex`, `IFunction: IComplex`; `IVm`
      binds `InternalFunction: IFunction<Self>`.
- [ ] The native-construction capability trait; `naive` implements it and
      `IFunction`, as an `Rc` over a `fn` pointer, a captured array and a
      length; `to_string` answers `() => {}`.
- [ ] `Function<A>`: `call`, `length`, `to_string`, identity; `name`, the
      header and the `pub` field go; `Debug` prints `to_string`.
- [ ] `function_any` in the corpus harness and the two test constructions
      go through the capability trait; the corpus's generated functions
      carry its bound.
- [ ] A test that `call` runs the code with its captured array and the
      arguments, and that two functions made from the same code are not
      `===`.
- [ ] `callable-function-objects.md`: reduce its representation section to
      a pointer here; declare the `IVm` break.
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
