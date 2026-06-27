## 66O-read-streamfile-dedup. `fileCas.read` should delegate to `streamFile`

**Priority:** P3
**Status:** open

### Problem

`fs/cas/module.f.ts` contains two near-identical recursive chunk-reader loops
with the same control flow: read a `chunkBytes` chunk at `offset`; on `error`
emit a single error item and stop; on an empty read `end()`; otherwise emit the
chunk as `ok` and recurse at `offset + chunkBytes`.

`fileCas.read`'s inner `loop` (`fs/cas/module.f.ts:140-152`):

```ts
const loop = (offset: number): List<FileCasOperation, IoResult<Vec>> =>
    readBytes(p, offset, chunkBytes)
    .step((result): List<FileCasOperation, IoResult<Vec>> => {
        const [t, v] = result
        if (t === 'error') { return cons<FileCasOperation, IoResult<Vec>>(result, end()) }
        return length(v) === 0n ? end() : cons(ok(v), loop(offset + chunkBytes))
    })
```

`streamFile`'s inner `loop` (`fs/cas/module.f.ts:251-260`):

```ts
const loop = (offset: number): List<ReadBytes, IoResult<Vec>> =>
    readBytes(filePath, offset, chunkBytes).step((result): List<ReadBytes, IoResult<Vec>> => {
        if (result[0] === 'error') { return cons<ReadBytes, IoResult<Vec>>(result, end()) }
        const chunk = result[1]
        return length(chunk) === 0n ? end() : cons(ok(chunk), loop(offset + chunkBytes))
    })
```

The only real difference is the declared effect type: `FileCasOperation` in
`read` vs. `ReadBytes` in `streamFile`. `ReadBytes ⊆ FileCasOperation`, and the
codebase already relies on exactly this widening — `casAddFile`
(`fs/cas/module.f.ts:271`) widens `streamFile`'s `List<ReadBytes, …>` to a
generic `O` with a documented sound cast. So the EOF/error streaming invariant is
maintained in two places that must stay in sync.

### Proposal

`read` should delegate to `streamFile`, which already *is* the generic
byte-streaming loop:

```ts
read: (hash: Vec): List<FileCasOperation, IoResult<Vec>> =>
    streamFile(join(path, toPath(hash))),
```

widening `List<ReadBytes, …>` to `List<FileCasOperation, …>` with the same sound
cast pattern `casAddFile` already uses (`ReadBytes ⊆ FileCasOperation`). This
removes one copy of the chunk/EOF/error invariant. `streamFile` may need to move
above the `fileCas` definition (or stay where it is and be referenced — confirm
ordering).

### Tasks

- [ ] Replace `fileCas.read`'s inline `loop` with a call to `streamFile`,
      widening the effect type as `casAddFile` does.
- [ ] Confirm definition ordering compiles; keep the `read` JSDoc about
      "missing shard / read error is an explicit error item, never EOF".
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/cas/proof.f.ts` still passes,
      including the short-final-chunk and read-error paths.

### Related

- `fs/cas/module.f.ts:271` — `casAddFile` already performs the
  `ReadBytes ⊆ FileCasOperation` widening this change reuses.
