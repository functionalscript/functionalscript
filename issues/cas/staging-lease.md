# Simple CAS Staging Upload

## Purpose

This document records the staging algorithm for uploads into the content-addressed store.
It intentionally avoids trying to prevent every low-probability race. The system already
accepts that a CAS cannot prevent every possible error: hash verification and scrub/repair
are the backstop for detecting committed corruption later. Staging should therefore cover
the common, significant failures — interrupted uploads, missing directories, write errors,
and failed commits — with a small protocol that fails by deleting partial data and returning
an upload error.

## Core idea

A writer streams bytes into a unique file under `.cas/_stage/`, computes the content hash
while writing, then atomically renames the finished file to the shard path for that hash.
The random suffix prevents practical name collisions between concurrent uploaders. The
deadline prefix makes abandoned staging files easy for a cleaner or operator to recognize.

```
.cas/_stage/<deadline>-<random-value>
```

- **`<deadline>`** — `now + ttl`, formatted as fixed-width, zero-padded UTC epoch
  milliseconds so lexical order matches chronological order.
- **`<random-value>`** — a freshly generated random value with enough entropy that a
  collision is not a significant operational concern.

The deadline is not a lock and not a promise that every unusual interleaving is impossible.
It is a simple cleanup hint: a stage file whose deadline is in the past is abandoned enough
for GC to delete. If GC deletes a live but too-slow upload, the next write or rename fails
and the uploader reports an upload error.

## Upload algorithm

The upload path is:

1. Generate a random value.
2. Read the current time and add the configured delta; this is the stage file's deadline.
3. Create `.cas/_stage/${deadline}-${random-value}`, recursively creating required
   directories first.
4. Iteratively write chunks to that file and update the hash state. The uploader keeps the
   next offset. Any error while writing, reading input, or updating the staged file deletes
   the staging file if possible and returns an upload error.
5. Create the prefix directories required for the final hash path.
6. Rename the staging file to the final shard path.
7. Return the hash.

In pseudocode:

```
upload(source, ttl):
  random = randomValue()
  deadline = now() + ttl
  stage = `.cas/_stage/${fmt(deadline)}-${random}`

  mkdir(parentOf(stage), { recursive: true })
  createExclusive(stage)

  offset = 0
  hash = shaInit()

  for chunk in source:
      writeBytes(stage, offset, chunk)
      hash = shaUpdate(hash, chunk)
      offset = offset + len(chunk)

  key = shaFinal(hash)
  dst = `.cas/${shard(key)}`
  mkdir(parentOf(dst), { recursive: true })
  rename(stage, dst)
  return key
```

If any step from `createExclusive` through `rename` fails, the uploader attempts
`rm(stage)` and returns an upload error. `rm(stage)` itself is best-effort: if the file is
already gone, the upload has still failed safely because no shard was reported.

## Commit and deduplication

The final shard path is derived from the hash accumulated while streaming the exact bytes
written to the stage file. The uploader must not accept an external key as the destination
without comparing it to the accumulated hash first.

Concurrent uploads of the same bytes are allowed. If the final rename fails because a shard
for the same hash already exists, the implementation may treat that as success only after
checking that the destination exists as the expected shard. Otherwise, the rename failure is
reported as an upload error and the staging file is deleted.

This keeps the normal path small while preserving the important invariant: returning a hash
means either this uploader installed that shard or the shard for that hash was already
present.

## Garbage collection

GC is intentionally simple. It scans `.cas/_stage/`, parses canonical stage names, and
removes files whose deadline is in the past. Invalid names may be ignored or removed by a
more conservative maintenance tool; they are not part of the upload protocol.

```
gc(now):
  for name in sort(readdir(`.cas/_stage/`)):
      if deadline(name) < now:
          rm(`.cas/_stage/${name}`)
      else:
          break
```

Manual cleanup follows the same rule: delete stage files whose deadline is in the past.
Deleting a stage file can only make an in-progress upload fail and restart; it cannot by
itself corrupt an already committed shard because committed shards live outside
`.cas/_stage/`.

## Failure handling philosophy

The staging protocol covers failures with meaningful probability:

- the stage directory does not exist;
- the input stream stops;
- a write fails;
- the stage file is deleted by cleanup;
- creating the final shard directories fails;
- the final rename fails;
- a process exits before commit and leaves an expired stage file behind.

The response is deliberately uniform: delete the stage file when possible and return an
upload error. The caller can retry the upload, and scrub/hash verification can later detect
committed-store problems that staging cannot prove away.

The protocol does not add complex machinery for extremely unlikely cases. In particular,
it does not try to make deadline leases into distributed ownership transfer, resumable
handoff, power-loss-durable partial uploads, or a complete corruption-prevention system.
Those concerns belong either to a future, separately designed feature or to the existing
hash verification and scrub/repair layer.

## Relationship to the existing `casUpload` path

`casUpload` (`fs/cas/module.f.ts`) currently stages into `.cas/.stage/`. Migrating it to
this design means writing unique `<deadline>-<random-value>` files under `.cas/_stage/`,
streaming chunks with explicit offsets while accumulating the hash, creating the final
prefix directory, renaming to `.cas/${shard(hash)}`, and returning the computed hash.
