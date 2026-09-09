## 66O-read-streamfile-dedup. `fileCas.read` should delegate to `streamFile`

**Priority:** P3
**Status:** open, and **closer than written**. A `List` cell can fail now, so
neither `read` nor `streamFile` emits an error item and stops; both loops are
two-case, which is most of what the sketches below spend their length on. The
duplication is still real and smaller than described.

**Destination moved:**
[streaming-http-bodies](../../effects/node/todo/streaming-http-bodies.md) puts
the shared loop in `fjs/effects/node/module.f.mjs` beside `writeFromStream`,
because `fjs/web` becomes a third caller and the loop stops being `fjs/cas`'s
to own. So `read` delegating to `streamFile` is no longer the end state, and
the deduplication happens there rather than here. What survives the move is the
caveat below: `read` is pinned to `List<FileCasOperation, …>` by the `FileCas`
interface either way. Retire this issue with that work.

### Problem

`fjs/cas/module.f.mjs` contains two near-identical recursive chunk-reader loops
with the same control flow: read a `chunkBytes` chunk at `offset`; on `error`
emit a single error item and stop; on an empty read `elEmpty()`; otherwise emit
the chunk as `ok` and recurse at `offset + chunkBytes`.

`fileCas.read`'s inner `loop` (`fjs/cas/module.f.mjs:262-276`):

```ts
const loop = (offset: number): List<FileCasOperation, Vec, IoChannel> =>
    readBytes(p, offset, chunkBytes)
    .step((result): List<FileCasOperation, Vec, IoChannel> => {
        const [t, v] = result
        if (t === 'error') { return nonEmpty<FileCasOperation, IoResult<Vec>>(result, elEmpty()) }
        return length(v) === 0n ? elEmpty() : nonEmpty(ok(v), loop(offset + chunkBytes))
    })
```

`streamFile`'s inner `loop` (`fjs/cas/module.f.mjs:323-333`):

```ts
const loop = (offset: number): List<ReadBytes, Vec, IoChannel> =>
    readBytes(filePath, offset, chunkBytes).step((result): List<ReadBytes, Vec, IoChannel> => {
        if (result[0] === 'error') { return nonEmpty<ReadBytes, IoResult<Vec>>(result, elEmpty()) }
        const chunk = result[1]
        return length(chunk) === 0n ? elEmpty() : nonEmpty(ok(chunk), loop(offset + chunkBytes))
    })
```

(`nonEmpty` / `elEmpty` are `nonEmpty` and `empty as elEmpty` from
`fjs/effects/list/module.f.mjs`.) The only real difference is the declared effect
type: `FileCasOperation` in `read` vs. `ReadBytes` in `streamFile`, with
`ReadBytes ⊆ FileCasOperation`. So the EOF/error streaming invariant is
maintained in two places that must stay in sync.

### Proposal

`read` should delegate to `streamFile`, which already *is* the generic
byte-streaming loop:

```ts
read: (hash: Vec): List<FileCasOperation, Vec, IoChannel> =>
    streamFile(join(path, toPath(hash))),
```

**Caveat on the type.** `casAddFile` (`fjs/cas/module.f.mjs:347-351`) is *not* a
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

- [ ] Point `fileCas.read` at the one shared loop — the moved one, per
      streaming-http-bodies — and run `tsc` to see whether an explicit cast is
      required for the `List<ReadBytes,…>` → `List<FileCasOperation,…>`
      conversion.
- [ ] Confirm definition ordering compiles; keep the `read` JSDoc about
      "missing shard / read error is an explicit error item, never EOF".
- [ ] Run `tsc` and `fjs t`; confirm `fjs/cas/proof.f.mjs` still passes,
      including the short-final-chunk and read-error paths.

### Related

- `fjs/cas/module.f.mjs:347-351` — `casAddFile`, which absorbs `ReadBytes` via a
  union return type (not an `as` cast); noted here because `read` cannot reuse
  that mechanism.
