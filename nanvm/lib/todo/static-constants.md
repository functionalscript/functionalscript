## Hold a compiled module's constants as static data

**Priority:** P3
**Status:** open — proposed by the language designer; no design yet

### Problem

A compiled module builds every value it holds when it starts. The generated
Rust is code that allocates: each array, object, string and closure a module
exports or captures is made in dynamic memory, one `Rc` each on the naive
VM, before the program does anything.

Most of those values do not depend on a function's arguments. With the
modules evaluated at compile time
([host values](../../../fjs/edag/todo/host-values.md) names that evaluation),
a module's whole value is known when its Rust is written.

One measurement, of an experiment and not of a commit: the compiler
evaluated at compile time and written as Rust is about 8.5 MB of source in
one function, builds in a little over four minutes without debug
information into a binary of about 63 MB, and starts in about 0.3 s. The
start is small already. What the code that builds the values costs in build
time, binary size and reference counts is not measured.

### Proposal

Write a constant as a Rust `static`, and let a value be a reference to one.

- The constants are written in a type that names no VM, something like

  ```rust
  enum StaticAny {
      Number(f64),
      String(&'static [u16]),
      Array(&'static [StaticAny]),
      Object(&'static [(&'static [u16], StaticAny)]),
      // …
  }
  ```

  A `static` cannot be generic, and a generated module is generic over its
  VM (`fn module<A: IStaticFunction>`); a type without `A` can be a
  `static` in it. It holds no `Rc`, so it is `Sync`, which a `static` has to
  be, with no `unsafe`.
- `Any<A>` and `Unpacked<A>` hold a static reference as well as the VM's
  container: an array, object, string or function is one or the other. Each
  VM packs a static reference its own way and never frees one.

A program then starts without building its constants, a clone of a constant
is a copy with no count ([reduce `Rc` clones](./087-reduce-rc-clone.md)),
and the same data is a data segment in WebAssembly.

### What a design has to settle

- **Lending slices.** `IContainer::items()` answers `&[Any<A>]`, and an
  array is indexed as a slice of `Any<A>`. A static array holds `StaticAny`
  and cannot lend that slice: such reads become reads by index that answer
  a value, or the static form is made the one both hold.
- **Functions.** A function's code is `StaticCode<A>`, which names the VM,
  so a `static` without `A` cannot hold the pointer. An id the generic
  module answers with its code is one way.
- **Identity.** A value's identity is its address
  (`IComplex::address`). Two different constants must not share one, which
  zero-sized statics, two empty arrays, may.
- **Which values are constant.** What a module exports and what its
  closures captured are each one value. Whether a literal inside a function
  body that reads no argument is one value or a new one at each call is the
  EDAG's to say, and a new one at each call cannot be a `static`.
- **The runtime's functions.** A constant that holds a function it was
  given through the module's `runtime` argument is no constant unless those
  are static too.
- **A VM's packing.** A NaN-boxed VM needs a tag that tells a static
  reference from an owned one.

### Tasks

- [ ] Measure first: build time, binary size and start of one module with
  its constants as statics, written by hand, against the same module as
  generated today.
- [ ] Settle the static type, the function id and the slice reads.
- [ ] Add the static forms to `Unpacked` and to the naive VM.
- [ ] Have the Rust serializer write constants as statics.

### Related

- [Host values](../../../fjs/edag/todo/host-values.md) — what an evaluated
  module's value is, which is what would be written.
- [Reduce `Rc` clones](./087-reduce-rc-clone.md).
- [Optimal NaNVM](./optimal-nanvm.md) — the packed representation a static
  reference has to fit.
