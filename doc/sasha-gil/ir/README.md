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
| [type-system.md](./type-system.md) | Proposed, not decided: the IR as both the code generator's IR and a safe typed language for writing the runtime by hand, with exact integer ranges, sums with declared bit layouts, derived ownership, and a low level under the high one; revised after a second review and the comparison |
| [comparison.md](./comparison.md) | The comparison round: the plan set against Binaryen's IR, CLIF, MIR, MLIR, Lean's IR, Perceus and Habit's bitdata, and where each finding went |
| [pointer-width.md](./pointer-width.md) | Decided: how a heap reference fits the NaN box on Rust, where pointers may be wider than 48 bits. Rust's heap is one buffer read in safe code, and a reference is an offset into it, as on WASM |
| [nan-box-patterns.md](./nan-box-patterns.md) | The 23 bit patterns of the NaN box that type-system.md's layout proof checks, with what each holds, and the check that ran on them |
| [nan-box-in-ir.md](./nan-box-in-ir.md) | A check of type-system.md: the whole NaN box and nineteen functions over it, written in its eDSL and run by a prototype. Two points need the owner, and thirteen smaller rules are proposed |

A note's companion files are named after it: `nan-box-in-ir.check.mjs`
and the other `nan-box-in-ir.*` files belong to
[nan-box-in-ir.md](./nan-box-in-ir.md), and `nan-box-patterns.check.py`
to [nan-box-patterns.md](./nan-box-patterns.md). They are prototypes,
not part of the build. Each `.mjs` among them starts with
`// @ts-nocheck`, because the repository's tsconfig type-checks every
`.mjs` and these are plain JavaScript without types.

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

1. **The owner's review of [type-system.md](./type-system.md).** Its
   [open questions](./type-system.md#open-questions) each carry a
   recommendation. Once decided, [ir-design.md](./ir-design.md) changes
   as the note's table lists.
2. **The lowering.** From prepared FAST into the IR: typing, closure
   conversion and lifetimes. [ir-design.md](./ir-design.md#where-it-sits)
   calls it a separate design.

Both wait for the owner's go-ahead. The comparison round that used to be
first here is done: [comparison.md](./comparison.md).
