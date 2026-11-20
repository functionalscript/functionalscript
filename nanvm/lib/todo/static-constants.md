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
- Turning a static into a value is the VM's. The VM's trait converts each
  static container into its own: a `StaticString` to a `String<A>`, and the
  same for a big integer, an array, an object and a function, as
  `static_function` already makes a function out of static code. `Any<A>`
  and `Unpacked<A>` stay as they are, and so does every operation written
  over them.

  A VM chooses what the conversion does. The simplest copies the static
  into a container of its own, which is right and gains nothing; a better
  one keeps the reference and never frees it. A VM can be moved from the
  first to the second one container at a time.

  A string and a big integer have items, `u16` and `u64`, that name no VM,
  so a VM's container can lend a static's slice as it lends its own, and
  neither has an identity to keep.

  An array and an object need no contiguous run of values either. An item
  of a static container is wrapped into an `Any<A>` when it is asked for,
  and what is wrapped is still a reference to its own static. An operation
  that answers a new container, `slice` or `substring`, may answer a
  dynamic one; answering a part of the static is an optimization for later.

An earlier form of the proposal put the static reference into `Any<A>` and
`Unpacked<A>` themselves, an array being the VM's container or a static.
Every operation then meets both forms, which the conversion above keeps
inside the VM.

A program then starts without building its constants, a clone of a constant
is a copy with no count ([reduce `Rc` clones](./087-reduce-rc-clone.md)),
and the same data is a data segment in WebAssembly.

### What a design has to settle

- **One static, one value.** An array, an object and a function have an
  identity. A static converted twice has to answer values that are `===`,
  so a VM that copies has to answer the same copy, or count the static's
  address as the identity. The trait's contract has to say it.
- **An item by value.** A container's items are already behind an
  abstraction, `IContainer::Items: SizedIndex<usize, Output = Item>`, and
  not a slice by contract. What it answers is a reference, `&Item`, as
  `Index<u32> for Array<A>` does, and an item wrapped on request is a new
  value with nothing to refer to. The read has to answer the item itself,
  and every reader of `array[i]` as a place changes with it.
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
- [ ] Settle the static types, the conversions in the VM's trait and what
  they promise about identity.
- [ ] Strings first: `StaticString` to `String<A>`, the naive VM keeping
  the reference, and the Rust serializer writing string constants as
  statics.
- [ ] Then big integers, then arrays, objects and functions.
- [ ] Have the Rust serializer write constants as statics.

### Related

- [Host values](../../../fjs/edag/todo/host-values.md) — what an evaluated
  module's value is, which is what would be written.
- [Reduce `Rc` clones](./087-reduce-rc-clone.md).
- [Allocation-free calls](./allocation-free-calls.md) — what still
  allocates once constants are static: a call's arguments and a closure.
- [Optimal NaNVM](./optimal-nanvm.md) — the packed representation a static
  reference has to fit.
