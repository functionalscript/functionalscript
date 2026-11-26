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
| [runtime-in-ir.md](./runtime-in-ir.md) | Built: slice 1 of the runtime written in the IR, all four checkpoints merged (#4094–#4116). Any over Sergey's NaN box, linked into programs; NaNVM keeps references but speaks the box; the IR's bit operators; four checkpoints |
| [short-strings.md](./short-strings.md) | Design approved (#4118), built through S4 (#4121–#4127): short strings as the next runtime-in-IR phase. String runtime-module interface, interchangeable implementations (host-backed, NaN memory-saving, NaN CPU-saving), experiment plan |
| [defined-hooks.md](./defined-hooks.md) | Decided (choice C): how a module counts a type that it defines. Its `dup` and `drop` are functions over the carrier's bits, the lifetime pass wraps them with `unseal`, `release` and `seal`, and Any's hooks call NaNVM only for a reference |
| [benchmark.md](./benchmark.md) | A measurement of untyped programs lowered to WASM on NaNVM's `.wasm`, beside JavaScript and the counting host: after slice 12, after the first three levers, and after the number paths, object reads in place and bulk `concat` (#4055 to #4057). Where the time goes (still NaNVM's handle layer), and the levers left |

A note's companion files are named after it: `definition.check.mjs` and
the other `definition.*.mjs` files belong to
[definition.md](./definition.md), `nan-box-in-ir.check.mjs` and the other
`nan-box-in-ir.*` files to [nan-box-in-ir.md](./nan-box-in-ir.md),
`nan-box-patterns.check.py` to
[nan-box-patterns.md](./nan-box-patterns.md), and the `benchmark.*.mjs`
files to [benchmark.md](./benchmark.md). They are prototypes,
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

The owner's direction of 2026-11-12 put the IR's role between FAST and
WASM first. That role is built: slices 1 to 12 of
[`fjs/ir/todo/slices.md`](../../../fjs/ir/todo/slices.md) are merged, so
steps 2 to 6 of definition.md's [order of work](./definition.md#order-of-work)
are done, and untyped programs run on NaNVM's `.wasm`. Step 1 still lacks
its proof that every function of the L0 view has a row
([What fjs/ir builds](./definition.md#what-fjsir-builds)).

The owner's next task (2026-11-21) is the IR's other role: a runtime
written in the IR itself, in the style of the
[modular runtime](../wasm/modular-runtime.md) and
[modular L0](../wasm/modular-l0.md), with the NaN box of
[Sergey's design](../../sergey-shandar/nanvm/README.md) coded by hand in
`f64` bits. That is steps 7 to 10 of the order of work, and the
[open questions](./type-system.md#open-questions) of type-system.md are
about it.

Still waiting for the owner:

1. **The review of [definition.md](./definition.md).** Its
   [open questions](./definition.md#open-questions) each carry a
   recommendation; `fjs/ir` already follows most of them.
2. **The edits that follow from it**, which
   [definition.md](./definition.md#what-changes-in-the-other-notes) and
   [TODO_DESIGN.md](./TODO_DESIGN.md) list.
