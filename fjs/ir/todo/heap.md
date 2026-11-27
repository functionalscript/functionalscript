## A heap in the IR: the bump arena first

**Priority:** P2
**Status:** wip — design proposed ([heap.md](../../../doc/sasha-gil/ir/heap.md)); the owner took the review's five choices and the arena counted in debug builds only (2026-11-26), and memory as an interface of instructions (2026-11-27)

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
      (memory and the five choices answered; how a build asks for debug,
      the first client, and a trap for misuse still open)
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
      owner's answer is still open)
- [ ] **H2** — The arena under `fjs/ir/runtime/heap`, in the IR's eDSL:
      `module` for release, `counted` for debug, with proofs on the
      counting host against a plain FunctionalScript model; it traps on
      misuse by H2a's mark
- [ ] **H3** — The first client: long strings in the IR heap, after a note on
      NaNVM holding references into it, with the root table that holds
      the references of constants and of the host
- [ ] **H4** — Paged size classes behind the same interface, and a `recover`
      that recounts from the roots

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
