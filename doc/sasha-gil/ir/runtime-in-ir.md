# A runtime written in the IR: slice 1, NaN-boxed scalars

2026-11-23. Proposed, not decided. This is the first slice of the owner's
next task (2026-11-21): a runtime written in the IR itself, in the style of
the [modular runtime](../wasm/modular-runtime.md) and
[modular L0](../wasm/modular-l0.md), with the NaN box of
[Sergey's design](../../sergey-shandar/nanvm/README.md) coded by hand.

## Why this slice first

The perf demos now spend their L0 calls on boxing numbers, measured on
`main` after #4092:

| Demo | L0 calls | `kind`, `to_f64`, `from_f64`, `dup`, `drop` |
| --- | --- | --- |
| collatz below 30,000 | 39.4M | 39.4M, 99% |
| sort of 100,000 | 86.8M | 57.9M, 67% |

Each one is an import call into NaNVM's `.wasm`, and `from_f64` allocates
a NaNVM slot that `drop` frees. In Sergey's box a number is its own `f64`
bits, and a boolean, `undefined` or `null` is a constant, so all of these
are a few bit operations, written inline in the program, with no call.
The rest of the sort profile is container work (`item`, `push`, `seal`),
which this slice leaves in NaNVM.

## Summary

- **Any is written in the IR**, over the NaN box, and linked into the
  program, as L1 is. The program's calls to Any's functions become inline
  bit operations; only a reference's `dup`, `drop` and `same` still call
  the runtime.
- **NaNVM keeps every reference** (strings, bigints, arrays, objects,
  functions), but its ABI speaks the box: every `i64` that crosses the
  ABI is a NaN box, and a reference carries NaNVM's handle in the box's
  payload bits.
- **The IR gains the integer bit operators and `to_bits` / `from_bits`**
  that [definition.md](./definition.md#terms) already lists (checkpoint 2,
  #4095), and a way for the module that declares a sealed type to see its
  carrier.
- **Short strings, short bigints and a Heap in the IR come later.** Slice 1
  makes no string or bigint inline, so nothing that reads one changes.
- **Four checkpoints**, each a PR that keeps every proof green: this
  note, the IR operators, NaNVM speaking the box, then Any in the IR.

## The box in slice 1

Sergey's layout, restricted to what slice 1 makes:

| Value | Bits | Note |
| --- | --- | --- |
| a finite number | its `f64` bits | exponent not all ones |
| `±Infinity` | `0x7FF0…0000`, `0xFFF0…0000` | the README's non-finite numbers |
| `NaN` | `0x7FF8_0000_0000_0000` | the one NaN: `from_f64` canonicalizes |
| `false`, `true` | `0x7FF0…0010`, `0xFFF0…0010` | the sign bit is the boolean |
| `undefined`, `null` | `0x7FF0…0020`, `0x7FF0…0030` | |
| a reference | `0111_1111_1111_tttt_p…p_10` | `tttt` its kind, `p…p` NaNVM's handle |

Every other pattern of the README (short strings, short bigints, static
references with `s = 1`) is valid in the layout but never made in slice 1.
The tests below are written so that they stay right when later slices
make them ([choice 6](#6-the-tests-are-the-frames)).

## Design choices

### 1. NaNVM's ABI speaks the box

- **Pick:** every `i64` that crosses NaNVM's ABI is a NaN box. NaNVM's
  `put` answers a number as its bits, a boolean, `undefined` or `null` as
  its constant, and a reference as `REF | kind << 48 | handle << 2`; its
  `get` decodes them back. NaNVM's own `kind`, `to_f64` and the rest keep
  working on boxes, so a program that still imports Any runs as before.
- **Alternative:** NaNVM keeps today's handles, and Any in the IR converts
  at the boundary: a value from `item` is a handle, so Any calls NaNVM's
  `kind`, `to_f64` and `drop` to unbox a number. That keeps today's calls
  for every number that goes into or comes out of a container, which is
  most of sort.
- **Why:** with the box on both sides, a number that `item` answers is
  already its bits, and one that `push` takes needs no `from_f64` call.
  It is the shape the README describes for NaNVM itself.

### 2. A reference keeps NaNVM's handle, and `tttt` is L0's kind

- **Pick:** the payload `p…p`, bits 2 to 47, holds NaNVM's handle. A
  handle is 32 bits of slot index and 32 of generation today, so it
  shrinks to 32 and 14. A slot whose 16,383 generations are spent is
  retired and never reused, as `Slab::take` does today, so a stale handle
  never names another value; only the number of times one slot can be
  reused drops. `tttt` holds L0's kind (4 string, 5 bigint, 6 array,
  7 object, 8 function), and NaNVM checks it against the kind it stored
  for the handle.
- **Alternative:** the README's `Type` numbering (object 3, string 4,
  bigint 5, function 6). It has no array, which L0's `kind` needs, and
  maps `null` to object, as `typeof` does.
- **Why:** L0 and L1 test L0's kinds, so the nibble needs no table
  once NaNVM has checked the handle. This is a deviation from the README's numbering for
  Sergey to confirm.

### 3. The IR gains the bit operators

- **Pick:** the integer operators `and`, `or`, `xor`, `shl` and `shr`
  (logical, on an unsigned range), and `to_bits(f64c) -> u(64)` and
  `from_bits(u(64)) -> f64`, as [definition.md](./definition.md#terms)
  lists them. Each is one WASM instruction: `i64.and` and the others, and
  `i64.reinterpret_f64` / `f64.reinterpret_i64`. The checker types a
  shift's result by the interval rules it uses for `add`. `to_bits` takes
  an `f64c` only, as [type-system.md](./type-system.md#floats) says, so
  no program can read which NaN an `f64` holds; `canon(f64) -> f64c`,
  which replaces any NaN by the one NaN, comes with checkpoint 4, where
  `from_f64` first needs it.
- **Alternative:** host imports for the bit work. A call per operation is
  what this slice removes.

### 4. Any sees its own carrier

- **Pick:** inside the module that declares a sealed type, two new terms
  convert between the type and its carrier: `unseal(any) -> u(64)` and
  `seal(any, u(64)) -> any`. The checker refuses them in any other module,
  so a program still sees `any` only through Any's functions, as
  [definition.md](./definition.md#modules-and-interfaces) says.
- **Done in 4c:** the module says which types it owns with `defines`, a
  name and the types under it, as an interface gives them (Sasha's pick,
  2026-11-24). Its `kind` is a function of its own. A defined type names
  no `dup` or `drop` yet: a drop written in the module would leave the
  value it owns for the lifetime pass to drop again. 4d lifts that with
  hooks over the carrier's bits, as
  [defined-hooks.md](./defined-hooks.md) gives in full (Sasha's pick C,
  2026-11-24).
- **Done in 4d-1:** a defined type may be counted by hooks over its bits,
  which only the lifetime pass calls, through the new `release` (#4108),
  and `Ref` gives NaNVM's functions of references to those hooks only
  (#4109). **Done in 4d-2:** Any's own module in the IR
  (`fjs/ir/runtime/any`). **Done in 4e:** the counting host speaks NaN
  boxes (#4114), `linkAny` merges Any into programs (#4115), and the IR
  benchmarks were remeasured (#4116): numeric loops keep essentially no
  scalar import calls (`sumTo` / `fib` ≈ JavaScript on NaNVM).
- **Alternative:** step 7 of definition.md's
  [order of work](./definition.md#order-of-work) first: `bits(64, …)`
  layouts with the layout proof and frames, as
  [nan-box-in-ir.md](./nan-box-in-ir.md) prototypes. That is the safe
  form of the same code and needs several slices before any number is
  measured.
- **Why:** slice 1's Any is about fifteen small functions over raw bits.
  Writing them over `u(64)` now measures the gain soon; step 7 later
  rewrites them over the layout, and the tests below are already the
  frame's ([choice 6](#6-the-tests-are-the-frames)), so the rewrite
  changes types, not bits.

### 5. Any is linked into the program and inlined

- **Pick:** Any's IR module lives in `fjs/ir/runtime/any`, beside the
  lowering, and joins a program the way L1 does (`link`): the program's
  `Any.kind` and the rest become calls of the program's own functions
  under linked names `any.kind` (as L1 uses `l1.add`), so a program may
  still export `kind`, and slice 5's rule inlines a helper that is not
  exported at each call. Any's constants (`undefined`, `null`, `true`,
  `false`) become the module's globals under `any.*`. The calls that stay
  imports are NaNVM's: `dup_ref`, `drop_ref` and `same_ref`, which take
  a box that is a reference and trap on a dropped or forged one, and
  `kind_ref` in a debug build only: otherwise `kind` reads a reference's
  `tttt` bits itself.
- **Alternative:** Any as a separate `.wasm` in import form, the modular
  L0's portable mode. Each call stays a call across modules, which is
  today's cost.
- **Why:** this is modular-l0.md's template form for Any, written in the
  IR instead of as WAT fragments.

### 6. The tests are the frame's

The functions below are derived from the README's layout, as
[nan-box-in-ir.md §5.2](./nan-box-in-ir.md#52-any-is-written-over-its-frame)
proposes: from the frame, not from what slice 1 happens to make. With
`EXP = 0x7FF0_0000_0000_0000`:

| Function | Body |
| --- | --- |
| `is_number(x)` | `x & EXP != EXP` or `x & TAG8 == NON_FINITE` (`TAG8 = 0x7FF0…00FF`) |
| `to_f64(x)` | `from_bits(x)` |
| `from_f64(f)` | `to_bits(canon(f))` |
| `to_bool(x)` | `x >> 63` |
| `from_bool(b)` | `b ? TRUE : FALSE` |
| `kind(x)` | below |
| `is_ref(x)` | `x & 0xFFF0_0000_0000_0003 == 0x7FF0_0000_0000_0002`, the README's `is_dyn_ref` |
| `dup(x)` | `is_ref(x) ? dup_ref(x) : x` |
| `drop(x)` | `if is_ref(x) then drop_ref(x)` |
| `same(a, b)` | `same_ref(a, b)` where either is a reference, else `a == b` |

`kind` answers L0's numbering (undefined 0, null 1, boolean 2, number 3,
string 4, bigint 5, array 6, object 7, function 8), not the README's
`Type`, so the scalar tags are mapped:

| Box | `kind` |
| --- | --- |
| a number (`is_number`) | 3 |
| `x & 1 == 1`, a short bigint | 5 (a later slice) |
| `x & 2 == 2`, a reference | its `tttt` bits, with no call (a `tttt` outside 4 to 8 traps); a debug build (`checkedKind`) calls `kind_ref(x)`, where NaNVM also checks the handle is live |
| a scalar with `x & 0xC != 0`, a short string | 4 (a later slice) |
| a scalar with tag `(x >> 4) & 3` = 1, boolean | 2 |
| tag 2, undefined | 0 |
| tag 3, null | 1 |

The last three are `((x >> 4) + 1) % 3` over the tag. Reading `tttt`
straight from the bits would answer a plausible kind for a dropped
reference, where NaNVM's `kind` traps today, so the reference branch
stays a checked call. A later slice can drop the check where the IR
proves the reference is live.

`same` calls NaNVM for two references because NaNVM's `dup` makes a new
handle for the same value, so two boxes of one array can differ in bits. It
calls NaNVM even when the bits are equal, so a dropped or forged
reference traps, as `abi::same` does today.

## Checkpoints

Each is one PR that leaves every proof green, so it can merge on its own.

1. **This note.**
2. **The IR operators** (choice 3): types, checker, printer, WASM
   emitter and proofs. Nothing uses them yet.
3. **NaNVM speaks the box** (choices 1 and 2): `put`/`get` in
   `nanvm/lib/src/l0/abi.rs` and the NaNVM host's constants. Programs still import
   Any, so the demos run as before; their timings show what the encoding
   alone costs or saves.
4. **Any in the IR** (choices 4 to 6): `seal`/`unseal`, `canon`, the counting
   host in the box encoding, NaNVM's `kind_ref`, `dup_ref`, `drop_ref`
   and `same_ref` exported, `fjs/ir/runtime/any`, its proofs against the
   L0 view on the parity tables, linking it into programs, and the demos
   measured. It may land as several PRs.

Short strings: design in [short-strings.md](./short-strings.md) (approved).
S1 skeleton: [`fjs/ir/runtime/string`](../../../fjs/ir/runtime/string/module.f.js).
S2: counting host / NaNVM ABI accept short boxes; emit per variant.

## Open questions

1. **Choice 2's numbering** of `tttt` departs from the README. Is L0's
   kind numbering fine, or should the README's `Type` gain an array?
2. **The counting host** speaks the box (4e-1): scalars are immediates,
   references pack a cell index as a dyn-ref, and the host supplies
   `kind_ref` / `dup_ref` / `drop_ref` / `same_ref`. Linking Any into
   programs (4e-2) and remeasure (4e-3) are done.
3. **The `s` bit** (a static reference) stays unused until literals live
   in a data segment.
