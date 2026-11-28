## A heap in the IR: the bump arena first

**Priority:** P2
**Status:** wip — design proposed ([heap.md](../../../doc/sasha-gil/ir/heap.md)); the owner took the review's five choices and the arena counted in debug builds only (2026-11-26), memory as an interface of instructions (2026-11-27), and the six choices of the first client, long strings ([long-strings.md](../../../doc/sasha-gil/ir/long-strings.md), 2026-11-27)

### Problem

The runtime written in the IR has Any and short strings, and no heap, so
every object still lives in NaNVM, and every reference still costs import
calls: `dup_ref`, `drop_ref` and the container imports
([benchmark.md](../../../doc/sasha-gil/ir/benchmark.md#after-the-inline-reference-kind-d1)).

### Proposal

A Heap runtime module written in the IR, in variants behind one interface,
as String's are ([short-strings.md](./short-strings.md)). First the bump
arena: in a release build it neither counts nor frees, and in a debug build
it counts in a header and traps on misuse. Memory enters the IR as a
`Memory` interface that the emitter writes as instructions. Full note:
[`doc/sasha-gil/ir/heap.md`](../../../doc/sasha-gil/ir/heap.md).

### Tasks

- [x] Design note and this `todo/`, the claim
- [ ] Owner approval of the design, and answers to its open questions
      (memory, the five choices, how a build asks for debug and the
      first client answered; a trap for misuse still open)
- [x] **H1** — `Memory`: loads and stores of 8 to 64 bits, `size` and `grow`;
      the emitter writes them as instructions and imports the loader's
      memory, and an effect of their own keeps their calls in place: L0's
      `Memory` says `instructions`, the checker takes only it or a part of
      it as such, and proofs show that the passes keep each of its calls
      where it was; the effect's inference comes with the first pass that
      moves calls
- [x] **H2a** — A trap on misuse, `misuse(reason)`, that the checker does
      not count as failing, as the card on a trap for misuse recommends
      (2026-11-27; the owner's answer is still open), so Any's `kind` no
      longer fails
- [x] **H2b** — Flow refinement's rule 2: a branch on `lt`, `le` or `eq` of
      two integers, or on its negation, narrows a local, and the emitter
      reads it in the narrower word, so the arena's pointer arithmetic
      needs no masks (2026-11-27, the card's recommended option; the
      owner's answer is still open). Keep as shipped; formal rules below
- [x] **H2b formal rules** — Lattice, sound transfer, and conservative
      joins/loops for comparison-narrowing, written so the checker can be
      checked against them; not a redesign of shipped H2b
      ([comparison-refinement.md](../../../doc/sasha-gil/ir/comparison-refinement.md);
      docs/spec alongside H3, 2026-11-28)
- [ ] **H2b transfer model** — Executable FunctionalScript lattice +
      transfer beside the checker (`fjs/ir/check/refinement`), proofs vs
      `compared` / join-loop conservatism; not a redesign of shipped H2b
- [x] **H2c** — The Heap interface and the release arena, `module`, under
      `fjs/ir/runtime/heap`, in the IR's eDSL, with a plain FunctionalScript
      model and a host proof that runs both on the same seeded sequences
- [x] **H2d** — The debug arena, `counted`: the header, the size word before
      it, the traps on misuse and `live()`, proven against the model's map
      from offset to block; `free` also traps on a live block and on a
      second `free`, which it marks in the size word; a bitmap of block
      starts, through a directory of pages, makes every address where no
      block starts trap
- [x] **H3 note** — [long-strings.md](../../../doc/sasha-gil/ir/long-strings.md):
      long strings are the first client, and NaNVM holds no reference into
      the IR heap, since a long IR string is copied into a NaNVM string
      wherever it crosses; the root table waits for H4 (the owner chose A
      on each of the six choices, 2026-11-27)
- [x] **H3a** — IR references in Any: kind nibble 9, and hooks that send an
      IR reference to the Heap's `dup`, `drop` and `free`, in `withHeap`
      and, for debug, `checkedWithHeap`, which asks the debug arena's new
      `type_of`; no program links them before H3d
- [x] **H3b** — Long strings in the IR: String's `concat`, `substring`,
      `length` and `unit` over blocks of a length and 16-bit units, in
      `withHeap` of `runtime/string/heap.f.js`; the Heap's `alloc` counts
      new, so a `seal` of its result makes the block's one owner, a short
      box is sealed from bits that hold no address, and NaNVM's
      `make_string` reads any bytes of the memory (the owner's choices,
      2026-11-28); a FunctionalScript model of the forms is proved
      against the IR on both arenas and on NaNVM
- [ ] **H3c** — The crossing: a long IR string that crosses into NaNVM
      becomes a NaNVM string, and the IR drops its reference
- [ ] **H3d** — The heap linked, the release arena by default and
      `counted` under `debug`, and measured against today's long path
- [ ] **H3e** — benchmark.md's new rows, and what H3d's numbers change in
      the notes
- [ ] **H4** — Paged size classes behind the same interface, and a `recover`
      that recounts from the roots, with the record at each region's start
      that leads a walk of every block from region to region, which the
      debug arena takes too, the root table that holds the references
      of constants and of the host, which the recount reads, and the tag
      that a debug or test build copies from a block's header into bits 32
      to 47 of its box
      ([long-strings.md, choice 3](../../../doc/sasha-gil/ir/long-strings.md#3-the-box-of-a-reference-into-the-ir-heap))

### Related

- [type-system.md, The floor](../../../doc/sasha-gil/ir/type-system.md#the-floor-state-lives-in-one-module):
  the state lives in one module, Heap
- [runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md): Any in the
  IR, and the order in which the rest moves
- [#4144](https://github.com/functionalscript/functionalscript/pull/4144):
  the debug-variant pattern this follows
- [line-heap.md](./line-heap.md): the third variant, an experiment
- [recover-by-exceptions.md](./recover-by-exceptions.md): the other way to
  recover a caught throw, an experiment
- [long-strings.md](../../../doc/sasha-gil/ir/long-strings.md): H3, the
  first client
- [comparison-refinement.md](../../../doc/sasha-gil/ir/comparison-refinement.md):
  formal H2b rules (lattice, transfer, joins/loops), alongside H3
- [one-byte-strings.md](./one-byte-strings.md): long strings of 8-bit
  units, a String variant of their own, an experiment
