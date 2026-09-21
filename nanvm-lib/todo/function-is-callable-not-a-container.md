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
it can be called, it has a `length`, and it has an identity, since `===`
compares functions by reference. (It also has a `String(f)` spelling, which
this design leaves exactly where it is — see below.) Nothing else.
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
}
```

and `IVm` binds `type InternalFunction: IFunction<Self>`. `Function<A>`
exposes exactly `call`, `length` and `PartialEq` by identity; `name` and
the header go, and `Debug` prints a fixed marker — it is a Rust diagnostic,
not a program value, so it carries no text a program could observe.
`IContainer` keeps `items_eq` and `new_ok` as the
extensions they are; `'static` is on neither trait, since nothing stores a
value where it would be needed and `IVm` itself carries no such bound.

**No constructor on `IFunction`.** A holder of a `Function<A>` can only run
it, which is the language's own rule. Construction is each VM's own:

- A VM that binds Rust static functions — usually generated ones — says
  so through `IStaticFunction`, below, which generated and hand-written
  code bound on: `A: IStaticFunction` names `IVm` and that capability.
  That is the whole of the MVP: no EDAG interpreter, `naive` implementing
  `IStaticFunction` and nothing more, and a compiler that produces the
  static functions.
- A VM that interprets may build a function from an EDAG. That is its own
  API, reached from a program only through an effect — `createFunction(e:
  Edag) => Function`, with `getEdag(f: Function) => Edag` beside it — which
  is the one door the language allows to the outside world, so
  compatibility holds: a program cannot make a function out of data by
  itself, and cannot tell how a function it holds was made.
- A VM may hold both kinds: an enum with a variant per representation,
  compiled code for the main program and an EDAG for a function made at
  run time. `call`, `length` and `ptr_eq` dispatch on the
  variant, and from outside, through `Function<A>`, the two are one type
  that composes freely — a compiled function calls a dynamic one it was
  handed, and a dynamic one calls a compiled one it captured.

**`IStaticFunction`.** A static function receives the function value it
is the code of and the arguments, the arguments by value, as every
operator on `Any` takes its operands:

```rust
/// A VM that makes a function out of a Rust static function.
pub trait IStaticFunction: IVm {
    fn static_function(code: StaticCode<Self>, length: u32, frame: Array<Self>) -> Function<Self>;
    /// The frame `static_function` was given, read by the code through its `self_`.
    fn frame(self_: &Self::InternalFunction) -> &Array<Self>;
}

pub type StaticCode<A> = fn(self_: &<A as IVm>::InternalFunction, args: Array<A>) -> Result<Any<A>, Any<A>>;
```

`self_` is the VM's own function value — an `IFunction`, so `Clone` and
`length` are its — and everything else the body needs is read through
it: the frame by `A::frame(self_)`, and `Function::from(self_.clone())`,
an `Rc`-cheap clone of the same value, is what the body's `["self"]`
names for recursion
([callable-function-objects.md](./callable-function-objects.md)). One
signature for every function, whether or not its body reads `self_`: an
unused parameter costs nothing, and one convention is simpler than a
family. The generic `Function<A>` exposes no `frame()` — that would be
the access to internals this design refuses. `IStaticFunction::frame` is
asked only by static code about itself, which is why it lives on the
binding trait and not on `IFunction`; a VM holding both kinds behind an
enum answers it for the static variant, the only one with code to ask.

**`naive` holds a static function.** Its `InternalFunction`,
`naive::Function`, is an `Rc` over one object: the static `fn` pointer,
the `length`, and the captured `frame: Array<Naive>`. `Clone` is the
`Rc`'s, and so is identity — `ptr_eq` compares the `Rc` — so identity
depends on nothing the generator does: every construction is a new
object, and every non-capturing function may share one empty frame.
`naive` implements `IStaticFunction`, and no other way to make a
function: `static_function` makes the object, `frame` reads its field,
and `call` is one line, the code with `self` and the arguments.

`naive` holds no EDAG: it stays the simple VM an AOT target wants, and
every headache of interpreting or building code stays in the compiler.

**`String(f)` is not this design's, and will not become it.** A function's
text is source reconstructed from its EDAG ([spec](../../spec/README.md)),
and `fn_to_string` in `vm/primitive_coercion.rs` answers a placeholder
today. This change leaves that path exactly as it is: `IFunction` has no
`to_string`, `static_function` takes no text, the object carries none,
and nothing here adds, routes, refuses or stubs one. The gap is
pre-existing and separately owned — what the text is, whether it
instantiates a frame, how `self` prints, is
[serialization.md](../../spec/todo/serialization.md#function-text-and-serialization)'s,
and carrying it is [callable-function-objects.md](./callable-function-objects.md)'s
Stage 7, once the EDAG spec exists. A review of this todo asking it to
carry, refuse or stub the text asks the wrong document: the answer is
here, once, and this section is it.

This is also the shape a NaN-boxing VM needs: an `Any` there is one word,
so a function value is one pointer to an object holding everything else.

This decides the representation question
[callable-function-objects.md](./callable-function-objects.md) left open
between two container-shaped options: there is no container to fit a code
pointer into. That document's staged plan — parameters, captured values,
self-reference, the generator — is written against this shape, and so is
the Stage 1 compiler plan,
[compile-noncapturing-functions-to-rust.md](../../fjs/fsc/todo/compile-noncapturing-functions-to-rust.md).

### Tasks

- [ ] `IComplex`, `IContainer: IComplex`, `IFunction: IComplex`; `IVm`
      binds `InternalFunction: IFunction<Self>`; `IStaticFunction: IVm`
      and `StaticCode<A>`.
- [ ] `naive::Function`, an `Rc` over the `fn` pointer, the `length` and
      the captured frame, identity the `Rc`'s; `naive` implements
      `IFunction` — `call` passes `self` and the arguments — and
      `IStaticFunction`.
- [ ] `Function<A>`: `call`, `length`, identity; `name`, the header and
      the `pub` field go, `From<A::InternalFunction>` in the field's
      place; `Debug` prints a fixed marker. `fn_to_string` is untouched.
- [ ] `function_any` in the corpus harness and the three test
      constructions go through `IStaticFunction::static_function`, and
      the corpus bounds on `IStaticFunction` where it bounds on `IVm`
      today — `fjs/nanvm/rust` prints the bound — so the generated tests
      stay generic over the VM and run on `naive` as they do now.
- [ ] A test that `call` runs the code with `self` and its arguments, and
      the code reads its frame through `IStaticFunction::frame`; that two
      functions made from the same code and frame are not `===`, and
      that a function and its clone are.
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
