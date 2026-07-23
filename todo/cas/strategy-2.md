# Strategy 2: Array of Bit Vectors

## Overview

A file is represented as a `readonly Vec[]` — an ordered list of chunks, each no
larger than `maxLengthBytes` (128 KiB). The whole file is read and written as one
array: there is no windowed access and no streaming handle. This lifts the
per-`Vec` size cap while keeping the interface as simple as the original
whole-file read/write.

## Effect-layer changes

The file operations move from a single `Vec` to an array of `Vec`, and the
windowed read is retired:

| Operation   | Before                                  | After                                    |
|-------------|-----------------------------------------|------------------------------------------|
| `readFile`  | `(path) => IoResult<Vec>`               | `(path) => IoResult<readonly Vec[]>`     |
| `writeFile` | `(path, Vec) => IoResult<void>`         | `(path, readonly Vec[]) => IoResult<void>` |
| `readBytes` | `(path, offset, size) => IoResult<Vec>` | **retired**                              |

`readFile` returns every chunk at once; `writeFile` accepts every chunk at once.
`readBytes` existed only to read a file in bounded windows without exceeding the
`Vec` cap — once `readFile` returns a bounded-chunk array, windowed reads serve no
purpose and are removed.

## Why an array rather than a single `Vec`

A single `Vec` is capped at `maxLengthBytes`, so any file larger than that cannot
be represented at all. Splitting into a list of bounded chunks lifts the cap to the
total of all chunks while keeping every individual allocation within the runtime
limit. The chunk boundary is an implementation detail of storage, not of content.

## Why this is simpler than Strategy 1

Strategy 1's staging-and-rename machinery exists because it streams: it never holds
the whole file, so it must write the bytes before the hash (and therefore the final
name) is known. Strategy 2 holds the entire file in memory as an array, so the hash
is computed *before* the write:

1. Build / read the `readonly Vec[]` into memory.
2. Compute the hash over the array.
3. `writeFile(finalPath, array)` directly.

This removes the reason for the two-phase write entirely:

- **No `WriteHandle`, no `openWrite` / `append` / `commit` / `abort`** — a plain
  `read(key) => readonly Vec[]` / `write(key, readonly Vec[])` key-value interface
  suffices.
- **No staging-for-unknown-key** — the key is known before the single `writeFile`.
- **No lock / dead-man's switch / cleaning** — nothing is ever written under a name
  it does not yet match.

## Trade-off

The whole file is materialized in memory as the array. Strategy 2 is therefore
bounded by available memory (across all chunks), not by disk — it does **not**
stream. This is the opposite trade-off from Strategy 1, which streams in constant
memory but needs the staging pipeline. Strategy 2 suits the in-memory / virtual
store (tests, non-filesystem backings) and files that comfortably fit in memory;
Strategy 1 suits arbitrarily large files on a real filesystem.

> Note: on a real filesystem a single `writeFile` of a large array is not
> crash-atomic — a crash mid-write can leave a partial file under its final hash
> name. Where that matters, Strategy 2 would still borrow Strategy 1's
> write-to-staging-then-rename for atomicity. In the virtual store, `writeFile` is a
> single atomic assignment, so the concern does not arise.

## Meta and read path

`Meta.size` is the sum of the byte lengths of the chunks. Obtaining size without
reading the content still requires a separate `stat`; otherwise the size falls out
of the array `readFile` already returns. Reads are pure: a committed file is
immutable.
