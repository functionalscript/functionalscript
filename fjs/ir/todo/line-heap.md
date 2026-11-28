## A line heap, as an experiment

**Priority:** P3
**Status:** open

### Problem

The Heap module of the runtime written in the IR has two variants planned
behind one interface: the bump arena, then paged size classes as the
production heap ([heap.md](./heap.md)). Paged size classes place a new
object in a free slot of its class's page, so objects made together may
sit apart. RC Immix found that this scattering by free lists was the main
cause of the last gap between reference counting and the fastest tracing
collectors, and closed it with lines and blocks (Shahriyar, Blackburn,
Yang and McKinley,
[Taking Off the Gloves with Reference Counting Immix](https://microsoft.com/en-us/research/wp-content/uploads/2016/02/rcix-oopsla-2013.pdf),
OOPSLA 2013).

### Proposal

A third variant behind the same Heap interface, after the arena and paged
size classes, as an experiment (the owner, 2026-11-26): a line-counted
bump allocator. Memory is cut into blocks of lines, such as 32 KiB blocks
of 128-byte lines, and each line counts the live objects that overlap it.
`alloc` bumps a pointer through a run of free lines and adds 1 to each
line that the object covers; when an object's count reaches 0, each of
its lines loses 1, and a line at 0 is free again.

RC Immix fights fragmentation by copying objects, which this heap cannot
do: a reference is a raw offset in WASM locals, and nothing updates it. So
the experiment measures what lines are worth without copying, where one
surviving object pins its line, and an object larger than a line needs a
run of free lines. The design and its trade-offs:
[heap.md, The line heap](../../../doc/sasha-gil/ir/heap.md#the-line-heap-an-experiment).

### Tasks

- [ ] A note: the sizes of blocks and lines, the path for objects larger
      than a line, and how the recount from the roots walks lines
- [ ] The variant under `fjs/ir/runtime/heap`, with the proofs of the other
      variants: the FunctionalScript model, the balance check and the
      differential runs
- [ ] Measured against the arena and paged size classes on the programs of
      [benchmark.md](../../../doc/sasha-gil/ir/benchmark.md) and the perf
      demos, with an imported mimalloc as the yardstick; the result decides
      whether the variant stays

### Related

- [heap.md](./heap.md): the Heap module, whose interface the variant
  implements; this experiment starts after its paged size classes
- [`doc/sasha-gil/ir/heap.md`](../../../doc/sasha-gil/ir/heap.md): the
  Heap module's design, with the alternatives weighed
