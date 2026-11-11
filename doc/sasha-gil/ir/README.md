# Code IR

Design notes for the code IR: a typed tree, written as an eDSL, one phase
before each target. These notes moved here from
[`../wasm`](../wasm/README.md) on 2026-11-11, because the IR is shared by
every backend, not only WASM: WASM first, then Rust, and later other
targets such as C++, Zig or LLVM IR
([modular runtime](../wasm/modular-runtime.md)).

These are working notes, not a spec. A decision is recorded in the
[WASM README's Decisions](../wasm/README.md#decisions) until this folder
has its own table.

## Notes

| Note | Holds |
| --- | --- |
| [ir-design.md](./ir-design.md) | The first, independent design: types, op tables, effects, control flow, the lifetime pass, emitters, and the unpacked `str` |

## What the IR builds on

The runtime boundary stays in [`../wasm`](../wasm/README.md). The IR names
it through its tables:

- the `l0` table is the [L0 design](../wasm/l0-design.md), and with a
  [modular L0](../wasm/modular-l0.md#the-code-ir), its rows are grouped by
  module;
- the `l1` table is the [L1 design](../wasm/l1-design.md);
- the `str` table is the String module of the
  [modular runtime](../wasm/modular-runtime.md), inlined as
  [fragments](../wasm/inline-fragments.md#runtime-modules).

## Next

1. **The comparison round.** Compare [ir-design.md](./ir-design.md) with
   Binaryen's IR, Cranelift's CLIF, Rust's MIR, the WAT folded form and
   Perceus, as its [comparison round](./ir-design.md#comparison-round)
   lists.
2. **The lowering.** From prepared FAST into the IR: typing, closure
   conversion and lifetimes. [ir-design.md](./ir-design.md#where-it-sits)
   calls it a separate design.

Both wait for the owner's go-ahead.
