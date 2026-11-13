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
| [definition.md](./definition.md) | Proposed, not decided: one definition shaped from the two notes below, with the FAST-to-WASM role first. Modules and interfaces, sixteen term forms, ownership as two capabilities, a core that needs no memory, the lowering from normalized FAST, and an order of work. A prototype takes three bodies of the L1 module to WASM |
| [TODO_DESIGN.md](./TODO_DESIGN.md) | The review of 2026-11-12: where the notes contradict each other, stale statements, design gaps, and words that mean two things |
| [ir-design.md](./ir-design.md) | The first, independent design: types, op tables, effects, control flow, the lifetime pass, emitters, and the unpacked `str` |
| [type-system.md](./type-system.md) | Proposed, not decided: the IR as both the code generator's IR and a safe typed language for writing the runtime by hand, with exact integer ranges, sums with declared bit layouts, derived ownership, and a low level under the high one; revised after a second review, the comparison and the NaN box check |
| [comparison.md](./comparison.md) | The comparison round: the plan set against Binaryen's IR, CLIF, MIR, MLIR, Lean's IR, Perceus and Habit's bitdata, and where each finding went |
| [pointer-width.md](./pointer-width.md) | Decided: how a heap reference fits the NaN box on Rust, where pointers may be wider than 48 bits. Rust's heap is one buffer read in safe code, and a reference is an offset into it, as on WASM |
| [nan-box-patterns.md](./nan-box-patterns.md) | The 23 bit patterns of the NaN box that type-system.md's layout proof checks, with what each holds, and the check that ran on them |
| [nan-box-in-ir.md](./nan-box-in-ir.md) | A check of type-system.md: the whole NaN box and nineteen functions over it, written in its eDSL and run by a prototype. Its two main points and thirteen smaller rules are now in type-system.md, still proposed |

A note's companion files are named after it: `definition.check.mjs` and
the other `definition.*.mjs` files belong to
[definition.md](./definition.md), `nan-box-in-ir.check.mjs` and the other
`nan-box-in-ir.*` files to [nan-box-in-ir.md](./nan-box-in-ir.md), and
`nan-box-patterns.check.py` to
[nan-box-patterns.md](./nan-box-patterns.md). They are prototypes,
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

[definition.md](./definition.md#modules-and-interfaces) proposes to name
it through interfaces instead: one for each of L0's five modules and one
for L1's native rows.

## Next

The owner's direction of 2026-11-12 puts the IR's role between FAST and
WASM first, and keeps its role as the language of the runtime.

1. **The owner's review of [definition.md](./definition.md).** Its
   [open questions](./definition.md#open-questions) each carry a
   recommendation. The first is whether the note becomes the reference,
   and the second, which FAST the lowering reads, also needs the view of
   the compiler's owner.
2. **The edits that follow from it**, which
   [definition.md](./definition.md#what-changes-in-the-other-notes) and
   [TODO_DESIGN.md](./TODO_DESIGN.md) list.
3. **The core**, in the [order of work](./definition.md#order-of-work)
   that ends at step 4 of the [WASM plan](../wasm/README.md#plan). The
   [open questions](./type-system.md#open-questions) of type-system.md
   are about the runtime language, and can be decided beside it.

All of it waits for the owner's go-ahead.
