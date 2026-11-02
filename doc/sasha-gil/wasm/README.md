# NaNVM behind a WASM interface

Design notes for isolating the NaNVM runtime behind a WebAssembly
interface, so that a program compiled from FunctionalScript can run on an
alternative runtime. Direct-to-WASM code generation comes after this and
targets the same interface.

These are working notes, not a spec. Each section separates what is
**decided** from what is **proposed**. Proposals stay open until the owner
decides them, and a decision is recorded in [Decisions](#decisions).

## Why

Today the boundary between a compiled program and NaNVM exists only in Rust
source. Generated Rust is generic over `A: IVm`
([`internal/mod.rs`](../../../nanvm/lib/src/vm/internal/mod.rs)), and the
program and the runtime are compiled together into one `.wasm`
([`gen.build.sh`](../../../nanvm/demos/gen.build.sh)). `IVm` abstracts how
values are stored, not how they behave: every operator, coercion and member
access is generic Rust compiled into the program. An alternative Rust VM can
change storage, and nothing else can be swapped.

A boundary at the WASM module level lets a runtime change behaviour too, and
lets it be written in something other than Rust.

## Layers

The interface has three layers. A program and the stock runtime are both
ordinary modules that import L1 and L0. A runtime must provide L0. It
provides L1 natively, or by linking the reference bodies.

```text
  program module          stock runtime module (L2)
          \                     /
           v                   v
  L1 operations: a closed, versioned list
     each one native in the runtime, or a reference body in FJS over L0
                     |
                     v
  L0 core: values, allocation, lifetime, calls and returns, errors, identity
           ^                   ^
          /                     \
  NaNVM: L0 + native L1     alternative runtime: L0, L1 from reference bodies
```

| Layer | Holds | Note |
| --- | --- | --- |
| L0 | The FJS data model: values, allocation, lifetime, calls, errors, identity | [l0-core.md](./l0-core.md) |
| L1 | The JavaScript operations: `+`, `===`, `typeof`, member access, coercions, natives | [l1-operations.md](./l1-operations.md) |
| L2 | The built-ins: statics such as `Object.is`, member bodies such as `startsWith` | [l2-stock-runtime.md](./l2-stock-runtime.md) |

A runtime may also offer small WASM fragments that the compiler inlines in
place of a call to it: [inline-fragments.md](./inline-fragments.md).

The same three layers already exist in NaNVM's Rust source. The notes for
each layer say where.

## Plan

The plan is still rough. Each step ends in a discussion before the next one
starts.

1. **Inventory.** Sort every operation that generated code and
   `gen.runtime.rs` use today into L0, L1 or L2, with a signature for each and
   the questions each one raises. No code.
2. **ABI choices.** Decide the open questions below, one axis at a time:
   the WASM type of `any`, allocation, lifetime, calls, errors, identity.
3. **Smallest proof.** NaNVM built as its own `.wasm` that exports L0 and L1.
   One small program, written as WAT through
   [`fjs/media/wasm`](../../../fjs/media/wasm/README.md), imports it and runs
   in Node, first with an opaque `any` and every operation imported. Then
   the same program specialized for NaNVM, with its `to_f64` and `from_f64`
   inlined as fragments. A small second runtime in JavaScript implements the
   same imports and runs the portable program.
4. **Spec and conformance.** The agreed interface as a spec, and the
   existing harness corpus run against any runtime, in both the portable and
   the specialized mode.

After these steps, the direct-to-WASM code generator targets this
interface, and an unboxing pass over the EDAG keeps values typed where it
can. Binaryen may be tried after that, to compare with our own linker and
inliner.

## Decisions

| Date | Decision |
| --- | --- |
| 2026-11-02 | The boundary has a separate L1 layer for the JavaScript operations, between the core and the stock runtime. |
| 2026-11-02 | L0 does not choose a boxing: a value is an opaque `any`, unpacked once into typed values where the compiler knows the type ([l0-core.md](./l0-core.md#values)). |
| 2026-11-02 | Linking and inlining use our own tools, built on `fjs/media/wasm`. Binaryen is at most a later comparison ([inline-fragments.md](./inline-fragments.md#our-own-linker-first)). |

## Open questions

1. Is the WASM type of `any` fixed by the ABI, or chosen per target
   runtime when code is generated? See
   [l0-core.md](./l0-core.md#the-wasm-type-of-any).
2. Are UTF-16 strings acceptable in L0, or should strings be opaque, with
   every string operation in L1? See [l0-core.md](./l0-core.md#allocation).
3. Is reference counting, with borrowed arguments and owned results, the
   baseline? Is object-grouping forward reference, which would make cycles
   possible, likely to land? See [l0-core.md](./l0-core.md#lifetime).
4. May a content-addressable runtime give structural identity, or must every
   runtime keep reference identity? See
   [l0-core.md](./l0-core.md#identity).
5. Is the reading of "stock runtime building ops" in
   [l2-stock-runtime.md](./l2-stock-runtime.md) the intended one?
6. How small and how simple must an inline fragment be, and how does a
   specialized program name the runtime it was built for? See
   [inline-fragments.md](./inline-fragments.md#open).
