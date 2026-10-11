# naive

`Naive` is a minimal working reference implementation of the VM core. It is
also an educational example: a reader should be able to understand the core
without first learning a memory-management algorithm. Its simplicity is an
intentional, lasting part of its scope.

## Core and shared operations

The implementation uses ordinary Rust types and reference counting:

- [`Naive`](./mod.rs) wraps `Unpacked<Naive>` and implements `IVm`'s
  conversions and internal types.
- [`Container`](./container.rs) stores a header and an `Rc` of its items,
  covering strings, bigints, arrays, and objects.
- [`Function`](./function.rs) holds static Rust code and its captured frame
  behind an `Rc`; `Naive` implements `IStaticFunction` to construct it.

The surrounding value types, operators, and utilities live in
[`vm`](../vm/README.md) and are generic over `IVm`. Implementing another VM
means supplying its core representation and the internal traits in
[`vm/internal`](../vm/internal/mod.rs), then reusing that infrastructure.
`IStaticFunction` is needed when the new VM supports constructing functions
from static Rust code. The existing test corpus can also be reused to check
the new implementation's behavior.

## Scope

Keep `naive` small, direct, and easy to compare with another implementation.
Fix semantic bugs and maintain compatibility with the shared VM interfaces.
Simplicity does not permit a plausible but incorrect result.

Performance optimizations and stronger resource guarantees that require
specialized storage or memory-management machinery belong in another VM
implementation alongside `naive`. Keep that implementation's core separate
and reuse the generic operations; `naive` remains the reference against which
it can be understood and checked.

## Resource limitations

`naive` relies on Rust's ordinary `Rc` destruction. Releasing the last
reference to a deeply nested array, object, or captured function frame can
recursively release its children, overflow the stack, and abort the process.
It does not guarantee stack-safe destruction at arbitrary depth. The depth
that fits depends on the platform, build profile, and available stack.

This limitation is tracked in
[deep-value-drop](../../todo/deep-value-drop.md), which proposes work in
another VM implementation. Recursive walks in shared operations are a
separate concern, tracked in
[array-deep-nesting](../../todo/array-deep-nesting.md); changing the core's
destruction alone does not fix those walks.
