## Hold a compiled module's constants as static data

**Priority:** P3
**Status:** wip — the VM can load hand-written static descriptors

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

- [The static descriptors](../src/vm/static_value.rs) name their VM wherever
  a function can occur. A `StaticFunction<A>` holds its `StaticCode<A>`,
  arity and optional source text. Its code reads captured constants directly.
  Strings and big integers contain only primitive data and are
  shared across VM types. A hand-written module can declare named statics
  for a concrete VM. Emitting them for generic modules is still open.
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
  value with nothing to refer to. The naive VM retains borrowed indexing by
  caching array items on first access. Object property reads return owned pairs,
  so static objects can retain just their descriptor and load properties individually.
- **Functions.** A compiled function is generic over its VM, since its
  body calls the VM's operations, and its code is `StaticCode<A>`. A
  `static` cannot name `A`, so it cannot hold a reference to that code.
  Ways through, none chosen:
  - **An id and a table.** The static holds the function's number in its
    module. The module's code is a table that is generic over the VM,
    which a `static` cannot be and an associated constant can:

    ```rust
    trait Codes<A: IVm> { const TABLE: &'static [StaticCode<A>]; }
    impl<A: IVm> Codes<A> for Module {
        const TABLE: &'static [StaticCode<A>] = &[f0::<A>, f1::<A>];
    }
    ```

    A small program of this shape compiles and runs: neutral statics, one
    of them a function by id, called through the table for a VM chosen at
    the call. What it leaves is how a value made from a static finds its
    module's table: an item wrapped on request is wrapped inside the VM,
    which then needs the table with the reference, or the modules
    registered with it.
  - **One VM for the generated code.** The module is written for the VM
    its program uses, and a static names that VM's code directly. The
    simplest, and a compiled module is then no longer usable by another VM
    without being generated again.
  - **Code that does not name the VM.** A function takes the VM as a
    trait object, `&dyn Vm`, and each operation is a virtual call through
    its table. The body is written once for all VMs. It gives up what the
    generic form has: a function is compiled for its VM, so an addition or
    a property read can be inlined, and through a table it cannot. Values
    need a form that names no VM as well, since `Any<A>` does, and `IVm`
    is not usable as a trait object as it is written, with its associated
    types and `Sized` bound: the change is to the trait, not only to what
    is generated.

  **To decide:** which of the three. The first keeps a module generic and
  costs a table read where a function value is made; the second is the
  least work and ties a compiled module to one VM; the third costs a
  virtual call at every operation.
- **Identity.** A value's identity is its address
  (`IComplex::address`). Two different constants must not share one, which
  zero-sized statics, two empty arrays, may.
- **Which values are constant.** What module initialization made: what a
  module exports and what its closures captured are each one value. An
  array, object or arrow written inside a function body is a new value at
  each call, whether or not it reads an argument
  ([names and identity](../../../spec/functions/names-and-identity/README.md)),
  so it is no `static`: `===` and a reference map would tell the
  difference. Its parts that have no identity, its strings and numbers,
  still can be.
- **The runtime's functions.** A constant that holds a function it was
  given through the module's `runtime` argument is no constant unless those
  are static too.
- **A VM's packing.** A NaN-boxed VM needs a tag that tells a static
  reference from an owned one.

### Tasks

- [ ] Measure first: build time, binary size and start of one module with
  its constants as statics, written by hand, against the same module as
  generated today.
- [x] Use a VM-typed function pointer in native static function descriptors.
- [x] Settle the static types, the conversions in the VM's trait and what
  they promise about identity.
- [x] Strings first (native application output): `StaticString` to `String<A>`, the naive VM keeping
  the reference, and the Rust serializer writing string constants as
  statics.
- [x] Share native string descriptors across literal values, property keys and runtime lookups.
- [x] Emit big integer literals in native application output.
- [x] Emit native module-level arrays of primitive literals, preserving a distinct
  descriptor per array literal site.
- [x] Emit native module-level objects with literal string keys and primitive values.
- [x] Emit static native module-level functions without captures.
- [x] Load captured static functions by descriptor in module-level functions.
- [x] Generate the common runtime for the native application with the same static descriptors.
- [x] Emit static objects with properties that refer to named static functions.
- [x] Allow native functions to capture named static objects and their aliases.
- [x] Emit static objects with properties that refer to named static objects and their aliases.
- [x] Emit native module-level arrays with entries that refer to named static functions and objects.
- [x] Reuse named native static arrays and their aliases in arrays, objects, and captured bindings.
- [x] Emit native static functions with primitive captures and immutable aliases.
- [x] Emit inline nested array and object literals as native static containers.
- [x] Emit inline static functions as entries in native static arrays and objects.
- [ ] Extend static containers to composite members and function captures to other static values.
- [ ] Have the Rust serializer write constants as statics.

### Related

- [Host values](../../../fjs/edag/todo/host-values.md) — what an evaluated
  module's value is, which is what would be written.
- [Reduce `Rc` clones](./087-reduce-rc-clone.md).
- [Allocation-free calls](./allocation-free-calls.md) — what still
  allocates once constants are static: a call's arguments and a closure.
- [Optimal NaNVM](./optimal-nanvm.md) — the packed representation a static
  reference has to fit.
