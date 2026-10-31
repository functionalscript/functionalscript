## Chunked, push-style inflater

**Priority:** P3
**Status:** open — merged as built; the shape awaits the owner's confirmation

### Problem

[`fjs/zlib/inflate`](../inflate/module.f.mjs) reads a zlib stream as a push-style
machine using the shared `init`, `update(state, chunk)`, `end` protocol. The
chunks are `Vec`s, so a chunk is at most what a `Vec` holds (128 KiB); the
output is emitted in arrays of `Vec` chunks, each at most one decoding step's
worth. The state between chunks is plain data (a phase, the bytes not yet used,
the Huffman tables of the block, a 32 KiB window), so it can be kept, fed
again and compared. [`fjs/git/inflater`](../../git/inflater/module.f.mjs) feeds
it from `readWhole` and from the windows of a pack, and everything Git reads
now stands on that shape, so changing it later is the expensive direction.

It was built since the first step of [inflate](../../../todo/inflate.md) without
the owner saying it is the shape wanted. That is the question here.

### Alternatives

- **Pull-style**: a reader asked for the next bytes. Natural for a consumer that
  wants a stream, but the reader holds the input, which an immutable value
  cannot do without a state of its own — which is the push machine again with
  one more layer.
- **One call over the whole input**: `Vec -> Vec`, as the host `inflate` effect
  is. Simplest to state and the thing this replaced: it refuses a stream or a
  result over a `Vec`, which is the limit that started the task.
- **Chunks of `List<number>` instead of `Vec`**: no 128 KiB per chunk, but a
  number a byte, about eight bytes of heap a byte, where a `Vec` is a bit a bit.

### Proposal

Keep it. The state is immutable data, so a proof drives it a chunk at a time
and compares states; the output is bounded per call, which is what lets a
reader stop a stream that expands (a loose object at its envelope's length, a
pack entry at its header's size, each checked after every piece of 1 KiB of
input); and only `fjs/git` calls it, so a different shape can be adapted at the
boundary.

### Tasks

- [ ] The owner confirms the shape, or names the one wanted. If it changes,
      `fjs/git/inflater` is the one place that adapts.
- [ ] Speed: at `4376bd611` the inflater decoded about 0.3 to 0.7 MB of output a
      second, led by the garbage collector and the list-based `Vec` conversions
      at the boundary. Not a task until a use needs more: the native decoder in
      `nanvm-effects-node` is the fast path, and
      [simplicity comes before optimization](../../../doc/DESIGN.md).

### Related

- [inflate](../../../todo/inflate.md) — the task this is a step of.
- [delta-ceiling](../../git/pack/todo/delta-ceiling.md) — the other decision the
  same work left.
