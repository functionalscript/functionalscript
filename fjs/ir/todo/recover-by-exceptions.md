## Recover a caught throw by WASM exceptions, as an experiment

**Priority:** P3
**Status:** open

### Problem

A throw traps
([l0-throw-trap.md](../../../doc/sasha-gil/wasm/l0-throw-trap.md)), so the
frames between the `throw` and the host never run their drops, and the
host's `recover` must undo what they held before it goes on with the same
instance. Once counts live in the object headers of the IR heap, NaNVM's
rule, which frees what was made since `enter`, leaks: an abandoned frame's
owned reference to an older object leaves that object's count too high.
The owner chose a recount from the roots once no program frame is live
(2026-11-26): exact, free on the normal path, and about one mark and sweep
of the heap for each recovered throw
([heap.md, A caught throw](../../../doc/sasha-gil/ir/heap.md#a-caught-throw)).

### Proposal

Try the other exact way, the exceptions of Wasm 3.0, as an experiment
beside the recount (the owner, 2026-11-26). A throw raises an exception
instead of trapping; a frame that holds owned references catches it, runs
its drops and throws it again; and the host catches it last. It is exact at
any depth, below a nested call too, and a caught throw pays only the drops
themselves.

Against it: it reopens the throw ABI decided on 2026-11-04 (a trap, and the
host reads `thrown()`), and it puts a handler around nearly every call made
while a frame holds an owned reference, which the normal path may pay for.
[l0-throw-trap.md](../../../doc/sasha-gil/wasm/l0-throw-trap.md) already
names WASM exceptions as the way to a future `try`, so what the experiment
learns serves that too.

### Tasks

- [ ] A note: the exception's tag and payload, which frames get a handler,
      what the lifetime pass writes in it, and what the hosts do, NaNVM's
      and the counting host
- [ ] A prototype in the emitter behind a flag, with the proofs of the
      throw ABI passing in both modes
- [ ] Measured against the recount on the programs of
      [benchmark.md](../../../doc/sasha-gil/ir/benchmark.md), on the normal
      path and on programs that catch many throws; the result decides
      whether the throw ABI changes

### Related

- [heap.md](./heap.md): its H4 builds the recount from the roots
- [l0-throw-trap.md](../../../doc/sasha-gil/wasm/l0-throw-trap.md): the
  throw ABI that this would change
