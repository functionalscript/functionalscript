# A heap in the IR: the bump arena first

2026-11-27. Proposed, not decided. The owner chose the bump arena as the
first Heap module and asked that it count references in debug builds only
(2026-11-26). This note is what the first steps build;
[`fjs/ir/todo/heap.md`](../../../fjs/ir/todo/heap.md) lists them.

## Why

The runtime written in the IR has Any and short strings, and no heap, so
every object still lives in NaNVM. After
[#4144](https://github.com/functionalscript/functionalscript/pull/4144),
the benchmark programs that touch references still make 10,000 to 190,000
L0 calls each: `dup_ref`, `drop_ref` and the container imports
([benchmark.md](./benchmark.md#after-the-inline-reference-kind-d1)). With
the heap written in the IR and linked into the program, an allocation is a
few inline instructions, and in a release build a reference is not counted
at all.

## The arena

One region and a pointer that only moves up. `alloc(n)` rounds `n` up to 8
bytes, moves the pointer, and grows the memory when the region is full.
Nothing is ever freed, so memory only grows. That makes the arena the speed
ceiling in benchmarks, and in debug builds a heap that turns misuse into a
trap. A production heap, paged size classes, comes later behind the same
interface.

| | Release, `module` | Debug, `counted` |
| --- | --- | --- |
| Header | none | 8 bytes before the block: the count and the size |
| `alloc(n)` | moves the pointer | moves the pointer and writes a count of 1 |
| `dup(p)` | nothing | adds 1, and traps on a count of 0 |
| `drop(p)` | answers `false` | takes 1, traps on 0, and answers `true` when the count reaches 0 |
| A block whose count reaches 0 | none does | is never reused, so a stale reference finds 0 and traps |
| `live()` | not exported | the blocks whose count has not reached 0, for balance checks in proofs |

`drop` answers whether the caller must release what the block holds. In
release it never must: nothing is freed, so nothing that a block holds
needs a `drop`.

A program that uses the heap correctly gives the same results in both
builds, and the debug build traps where it does not.
[#4144](https://github.com/functionalscript/functionalscript/pull/4144) set
the pattern: a builder takes the variant, `module` is the default, and a
runtime asks for the debug variant when it links.

**Later, a release `any` with no counting at all.** Once every kind of
reference lives in the arena, a release build's Any can list every variant
as copy, and the lifetime pass then writes no `dup` and no `drop`.

## Memory in the IR

The IR has no memory yet.
[type-system.md](./type-system.md#one-language-two-levels) plans `load` and
`store` as operators of a low level. The first step adds them instead as a
**`Memory` interface whose functions the emitter writes as WASM
instructions**:

- `load8`, `load16`, `load32` and `load64` take an address, a `u(32)`, and
  answer a `u(8)` to a `u(64)`. `store8` to `store64` take an address and a
  value and answer `unit`. All of them may fail: an address past the memory
  traps.
- `size()` answers the memory's size in 64 KiB pages. `grow(n)` adds `n`
  pages and answers the size before, or `-1` when the memory cannot grow.
- The memory is the one that the loader makes
  ([L0 §5](../wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)),
  imported from the interface's `abi`.

Why calls and not operators: every pass already keeps calls in order, and
the checker already infers `fails` from them. No operator has an effect or
can fail today, so each pass and the checker would first have to learn that
some do. The emitter writes the same instruction either way.

## Where the heap keeps its state

The IR has no mutable globals. A module constant records, once in `init`,
where `Memory.grow` put the arena's first region, and the region's first 16
bytes hold the state: the pointer, the region's end and, in debug, the live
count. When the region is full, `alloc` grows the memory. Where the new
pages follow the region, it extends the region; elsewhere it starts a new
region there and leaves the old one's tail unused. NaNVM's allocator grows
the same memory, and each allocator uses only the pages that its own `grow`
answered. Running out traps.

## Open questions

1. **Memory as an interface of instructions**, as proposed, or as
   low-level operators, as type-system.md plans.
2. **How a build asks for debug.** A runtime flag beside `checkedKind`,
   such as `countedHeap`, or one `debug` flag that links every debug
   variant, `checkedKind`'s Any included. One flag is the proposal.
3. **The first client.** Long strings in the arena mean that NaNVM's arrays
   and objects hold references into the IR heap. In release such a
   reference needs no count; in debug NaNVM must call the heap's `dup` and
   `drop`. That needs a note of its own before H3.
