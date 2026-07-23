## 66O-read-streamfile-dedup. `fileCas.read` should delegate to `streamFile`

**Priority:** P3
**Status:** open

### Problem

`fjs/cas/module.f.ts` contains two near-identical recursive chunk-reader loops
with the same control flow: read a `chunkBytes` chunk at `offset`; on `error`
emit a single error item and stop; on an empty read `elEmpty()`; otherwise emit
the chunk as `ok` and recurse at `offset + chunkBytes`.

`fileCas.read`'s inner `loop` (`fjs/cas/module.f.ts:140-153`):

```ts
const loop = (offset: number): List<FileCasOperation, IoResult<Vec>> =>
    readBytes(p, offset, chunkBytes)
    .step((result): List<FileCasOperation, IoResult<Vec>> => {
        const [t, v] = result
        if (t === 'error') { return nonEmpty<FileCasOperation, IoResult<Vec>>(result, elEmpty()) }
        return length(v) === 0n ? elEmpty() : nonEmpty(ok(v), loop(offset + chunkBytes))
    })
```

`streamFile`'s inner `loop` (`fjs/cas/module.f.ts:251-259`):

```ts
const loop = (offset: number): List<ReadBytes, IoResult<Vec>> =>
    readBytes(filePath, offset, chunkBytes).step((result): List<ReadBytes, IoResult<Vec>> => {
        if (result[0] === 'error') { return nonEmpty<ReadBytes, IoResult<Vec>>(result, elEmpty()) }
        const chunk = result[1]
        return length(chunk) === 0n ? elEmpty() : nonEmpty(ok(chunk), loop(offset + chunkBytes))
    })
```

(`nonEmpty` / `elEmpty` are `nonEmpty` and `empty as elEmpty` from
`fjs/effects/list/module.f.ts`.) The only real difference is the declared effect
type: `FileCasOperation` in `read` vs. `ReadBytes` in `streamFile`, with
`ReadBytes ⊆ FileCasOperation`. So the EOF/error streaming invariant is
maintained in two places that must stay in sync.

### Proposal

`read` should delegate to `streamFile`, which already *is* the generic
byte-streaming loop:

```ts
read: (hash: Vec): List<FileCasOperation, IoResult<Vec>> =>
    streamFile(join(path, toPath(hash))),
```

**Caveat on the type.** `casAddFile` (`fjs/cas/module.f.ts:267-271`) is *not* a
reusable precedent here: it does not perform an `as` cast — it declares its
return type as the union `Effect<O | ReadBytes, …>` and lets `cas.write`'s
generic absorb `ReadBytes` (the word "cast" appears only in its comment). `read`
cannot do that: its return type is pinned to `List<FileCasOperation, …>` by the
`FileCas` interface, so it cannot widen to a union. Since TypeScript can't prove
`List<ReadBytes, T> ≤ List<FileCasOperation, T>` for the recursive `List` type
(the same limitation `casAddFile`'s comment notes), expect to need an **explicit**
cast (or a small restructuring) at this call site. Verify with `tsc` before
committing to the one-liner — if an `as` is unavoidable, weigh whether the
deduplication is worth introducing one (`AGENTS.md` treats `as` as a last resort).
`streamFile` may also need to move above the `fileCas` definition (confirm
ordering).

### Tasks

- [ ] Replace `fileCas.read`'s inline `loop` with a call to `streamFile`; run
      `tsc` to see whether an explicit cast is required for the
      `List<ReadBytes,…>` → `List<FileCasOperation,…>` conversion.
- [ ] Confirm definition ordering compiles; keep the `read` JSDoc about
      "missing shard / read error is an explicit error item, never EOF".
- [ ] Run `npx tsc` and `fjs t`; confirm `fjs/cas/proof.f.ts` still passes,
      including the short-final-chunk and read-error paths.

### Related

- `fjs/cas/module.f.ts:267-271` — `casAddFile`, which absorbs `ReadBytes` via a
  union return type (not an `as` cast); noted here because `read` cannot reuse
  that mechanism.
