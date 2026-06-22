# CAS Implementation Plan

Make the content-addressable store stream-native and build it on the lock-free staging
algorithm, removing the key-value layer it is currently (awkwardly) built on.

Design references: [staging-lease.md](staging-lease.md) (the upload algorithm), [scrub.md](scrub.md)
(corruption detection/repair), [README.md](README.md) (strategy layering). Current code:
`fs/cas/module.f.ts`.

## Goal interface

```ts
type Cas<O extends Operation> = {
    // stream the content out in <=128 KiB chunks; not-found surfaces on the first pull
    readonly read:  (hash: Vec) => ListEffect<O, Vec>
    // consume a chunk stream, compute the hash incrementally, return the address
    readonly write: (payload: ListEffect<O, Vec>) => Effect<O, IoResult<Vec>>
    // all stored content hashes
    readonly list:  () => Effect<O, readonly Vec[]>
}
```

`ListEffect<O, T> = Effect<O, readonly[T, ListEffect<O, T>] | undefined>` (from
`fs/effects/module.f.ts`) — a lazy, effectful cons-stream: each pull yields `[chunk, rest]`
or `undefined` at end. This is what keeps memory constant for arbitrarily large files.

## Step 1 — Remove the key-value interface

The CAS is currently `cas = (sha2) => (kvStore) => Cas`, layered on a generic
`KvStore.read/write(key,value)/list`. That doesn't fit content addressing: the key is
*derived* from the value (never supplied), streaming has no shape in `write(key, value)`,
and `fileKvStore.write` is truncate-in-place where CAS needs no-clobber publish. The effect
system already provides the mockability the KV layer was giving.

- Delete `KvStore<O>`, `Kv`, `fileKvStore`, and the `cas(sha2)(kvStore)` wrapper from
  `fs/cas/module.f.ts`.
- Define `Cas` directly over filesystem effects (no intermediate store).
- Keep `toPath` (sharding) and `random256`.
- Update the `add` / `get` / `list` CLI commands to the new direct CAS.
- `readFile` / `writeFile` stay as the ≤128 KiB small-object effect primitive (Strategy 3
  nodes use them directly) — only the *KV facade over CAS* is removed, not these effects.

## Step 2 — Stream payloads with `ListEffect`

Replace whole-`Vec` in/out with chunk streams:

- `write(payload: ListEffect<O, Vec>)` — fold the stream, feeding each chunk to both the
  staging file and the running SHA-2 state; return the computed hash. Never holds the whole
  payload in memory.
- `read(hash)` — produce a `ListEffect<O, Vec>` that pulls `readBytes(toPath(hash), offset,
  CHUNK_BYTES)` lazily, `CHUNK_BYTES = maxLengthBytes`. The final short/empty chunk ends the
  stream; a missing shard surfaces as an error on the first pull.
- `list()` stays `readonly Vec[]` (or a `ListEffect` of hashes if we want it lazy too).

This is the interface the lock-free algorithm consumes (`write`) and produces (`read`); the
existing `streamHash` helper folds into `write`.

## Step 3 — Implement the lock-free staging algorithm

Implement `write` as the `upload` algorithm from [staging-lease.md](staging-lease.md):

1. `rand = random256()`; staging file `.cas/_staging/<deadline>-<rand>` (the `_` prefix
   excludes it from `list` via `cBase32ToVec`).
2. `mkdir(_staging, {recursive})`; `createExclusive` the file.
3. Fold the payload stream: `writeBytes(path, offset, chunk)`, advance `offset`, update the
   hash, and renew the lease each chunk by renaming to a fresh `now()+delta` deadline. Any
   error ⇒ `rm(path)` and return an upload error.
4. `hash = shaFinal(...)`; `dst = .cas/${toPath(hash)}`.
5. `mkdir(dirOf(dst), {recursive})`, `rename(path, dst)`, `rm(path)` — results ignored.
6. Success iff `stat(dst).size === offset`; else upload error.

### New effects (`fs/effects/node/module.f.ts`)

`rename`, `rm`, `mkdir`, `readBytes`, `readdir` already exist. Add:

- `createExclusive(path) => IoResult<void>` — `O_CREAT|O_EXCL`.
- `writeBytes(path, offset, data: Vec) => IoResult<void>` — open existing (no create),
  pwrite at `offset`; the mirror of `readBytes`.
- `stat(path) => IoResult<{ size }>` — used by the publish size check (and future resume).

No `fsync`, `FileHandle`, or read-only effects in the baseline (durability is best-effort;
corruption is caught by scrub — see staging-lease.md *Future optimizations*).

### Garbage collection

Lazy, piggy-backed on `write`: `readdir(_staging/)`, delete entries whose `<deadline>` is in
the past (sorted lexically = chronologically, so expired names are a prefix).

### Migrate `casUpload`

Replace the existing `casUpload` (`.cas/.stage/` move-hash-move) with the new pipeline writing
into `_staging/`; remove the `.stage/` path once no callers remain.

### Tests

Virtual-runner coverage in `fs/effects/node/virtual/`: streaming write of a multi-chunk
payload, read-back streaming, dedup (same content ⇒ same hash, second upload is a no-op
publish), a simulated mid-stream error (staging file deleted, error returned), and GC
reclaiming an expired staging file.

## Dependency order

Step 1 and Step 2 reshape the interface (`Cas` direct + streaming); Step 3 implements `write`
behind it and adds the three effects. Land them in order: remove KV → stream interface →
staging algorithm + effects + GC + `casUpload` migration.
