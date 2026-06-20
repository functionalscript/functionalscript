# CAS File Strategies

Three strategies for storing files of arbitrary size in a content-addressable store,
each with different trade-offs between memory use, streaming, atomicity, and
deduplication.

- [Strategy 1: Staging + Rename](strategy-1.md) — stream data through a staging file
  held by an OS lock; rename to the final hash-addressed path on commit. Constant
  memory, safe for arbitrarily large files on a real filesystem.

- [Strategy 2: Array of Bit Vectors](strategy-2.md) — read and write the whole file
  as a `readonly Vec[]`; retire `readBytes`. Hash is known before the write, so no
  staging is needed. Bounded by available memory.

- [Strategy 3: Merkle Tree](strategy-3.md) — decompose any file into a tree of
  ≤128 KiB objects, each stored through the existing small-file primitive. Enables
  streaming, cheap metadata, random access, and content-defined deduplication via
  SUL. Requires garbage collection (`roots/` + `parts/` directory split).
