## Hashing pays for a whole 64 KiB chunk however few bytes there are

**Priority:** P3
**Status:** open

### Problem

`chunks` in [`fjs/git/oid`](../module.f.mjs) cuts the bytes of an object into
the `Vec`s the hash takes, 65,536 at a time. It gathers each one with

```js
const gathered = Array.from({ length: chunkBytes }, () => {
    const r = next(rest)
    if (r === null) { return 0 }
    rest = r.tail
    taken += 1
    return r.first
})
```

which allocates an array of 65,536 and calls `next` 65,536 times whatever the
list holds — an object of seven bytes costs the same walk as one of 64 KiB,
because the loop runs to the array's length rather than to the end of the list.

Measured on node 22, each figure the mean of repeated calls after a warm-up:

| what | cost |
| --- | --- |
| `digestOf(20)([])` — no bytes at all | 4.1 ms |
| `digestOf(20)` over 64 KiB | 45 ms |
| `digestOf(20)` over 64 KiB + 1, so two chunks | 43 ms |
| `of(20)('blob', payload)` where `payload` is what `fjs/git/object`'s reader hands back for the empty blob | 68 ms |
| the same bytes as an array | 9.6 ms |
| the same over a 3,000-byte payload from the reader | 8.9 ms |

The two rows that do not fit a cost-per-byte story are the point. Hashing
*nothing* costs 4 ms, and hashing the empty blob as the envelope reader hands it
over costs more than hashing a 3,000-byte one: the fixed 65,536 calls dominate,
and what each call costs depends on the shape of the list they are made on. A
list already exhausted answers `null` cheaply when it is an array's tail and
expensively when it is a `take` over a lazily built one, which is what the
reader produces.

End to end, one `fjs/git/store` read of the empty blob through the mock host
took 570 ms, against 38 ms for a 3,285-byte commit in the same run. Every read
of a loose object pays this, since the store hashes what it reads and checks the
id.

### Proposal

Stop gathering where the list ends rather than where the array does. The
obvious spelling — a `while` filling a fixed-size array and breaking out —
mutates a local array, which [§3.1](../../../AGENTS.md) does not want, so the
shape wants a decision rather than a patch:

- gather into a `List` with `concat` and materialise once per chunk, as
  `fjs/git/pack`'s `deltaPieces` gathers its pieces, and measure — one `concat`
  cell per byte may cost more than it saves at 64 KiB;
- or take the chunk with `take`/`toArray` from `fjs/types/list`, which walks the
  list once and allocates what it found, and let the tail the next chunk starts
  from come from a second walk of the same prefix — cheap in bytes, and the
  doc's warning about a dropped list walking every byte before it still applies
  to the *file*, not to one chunk;
- or keep the array and give `chunks` the count it needs, which nothing has: the
  envelope's own `size` says how long the payload is, and the header is a known
  length, so `of` knows the total where `digestOf` does not.

Whichever it is, the case to pin is the one the table above exposes: an object
of a few bytes must not cost a 64 KiB walk, and a payload as the envelope reader
hands it over must not cost more than the same bytes as an array.

### Related

- [`fjs/git/oid`](../module.f.mjs) — `chunks`, and the `of`/`digestOf` pair
  above it.
- [`fjs/git/store`](../../store/module.f.mjs) — hashes every object it reads,
  which is where this is paid.
- [`fjs/git/packidx`](../../packidx/module.f.mjs) — hashes a whole index when it
  opens one, and [`todo/lazy-index-ids.md`](../../packidx/todo/lazy-index-ids.md)
  is the other half of what an index read costs.
