# 66N-strategy-1-effects. Strategy 1 effects: `FileHandle`, `openExclusive`, `appendHandle`, `commitHandle`, `abortHandle`, `tryLockExclusive`, `stat`

**Priority:** P2
**Status:** open

## Problem

Strategy 1 (Staging + Rename, see [cas/strategy-1.md](./cas/strategy-1.md)) cannot be
implemented with the current effect set in `fs/effects/node/module.f.ts`. Six new
effects and one new nominal type are required before any CAS-layer code can be
written.

The current `Fs` union (`Mkdir | ReadFile | ReadBytes | Readdir | WriteFile | Rm | Rename | Exec | Access`)
covers stateless filesystem operations. Strategy 1's write pipeline requires a
stateful file handle — an opaque token that carries a live OS resource (open file
descriptor + lock) through `openExclusive → appendHandle → commitHandle/abortHandle`
— which has no equivalent in the current effect set.

## Proposal

Add the following to `fs/effects/node/module.f.ts`:

### `FileHandle` nominal type

```ts
export type FileHandle =
    Nominal<'fileHandle', `<sha-of-definition>`, unknown>
```

Opaque black-box value, analogous to `Server`. The Node runner stores the live OS
resource (fd + flock) in its interpreter state and maps the nominal token to it.
Nothing outside the runner can inspect or forge a `FileHandle`.

### Write-side effects

| Effect | Signature | Notes |
|---|---|---|
| `openExclusive` | `(path: string) => IoResult<FileHandle>` | Creates the file if absent; acquires an exclusive lock (`flock(LOCK_EX)` on POSIX, inherent on Windows via open handle). |
| `appendHandle` | `(handle: FileHandle, data: Vec) => IoResult<void>` | Writes `data` through the held file descriptor. Bounded to ≤128 KiB per call. |
| `commitHandle` | `(handle: FileHandle, destPath: string) => IoResult<void>` | Renames the staging file to `destPath`, marks it read-only (`chmod 444`), closes the fd, and releases the lock. On Windows: if `destPath` already exists with ReadOnly attribute, delete the staging file and return success (CAS invariant: same hash ⇒ same bytes). |
| `abortHandle` | `(handle: FileHandle) => IoResult<void>` | Closes the fd and releases the lock, then deletes the staging file. |

### Read/stat-side effects

| Effect | Signature | Notes |
|---|---|---|
| `tryLockExclusive` | `(path: string) => IoResult<FileHandle \| undefined>` | Non-blocking attempt: returns a `FileHandle` if the lock was acquired (file is orphaned, safe to delete), or `undefined` if another process holds it (writer is active, skip). Maps to `flock(LOCK_EX \| LOCK_NB)` on POSIX; attempted open on Windows. |
| `stat` | `(path: string) => IoResult<{ readonly size: number, readonly mtimeMs: number }>` | Returns file metadata without reading content. `mtimeMs` is required by the POSIX cleaner's mandatory mtime grace check (see [cas/staging.md](./cas/staging.md)). Currently `fs.promises.stat` is used internally by the Node runner's `readFile` but is not exported as an effect. |

### `Fs` union update

Add all six new effects to the `Fs` union alongside the existing filesystem
effects, and add them to `NodeOp`.

## Tasks

- [ ] Add `FileHandle` nominal type to `fs/effects/node/module.f.ts`
- [ ] Add `OpenExclusive`, `AppendHandle`, `CommitHandle`, `AbortHandle` effect types and `do_` constructors
- [ ] Add `TryLockExclusive`, `Stat` effect types and `do_` constructors
- [ ] Extend `Fs` union and `NodeOp` to include all six new effects
- [ ] Implement all six effects in the Node runner (`fs/effects/node/module.ts`)
- [ ] Add `FileHandle` map to the runner's interpreter state (alongside the `Server` map)
- [ ] Implement the virtual/mock runner stubs in `fs/effects/node/virtual/module.f.ts` for test use
- [ ] Unit tests covering the happy path and error cases for each effect

## Related

- [cas/strategy-1.md](./cas/strategy-1.md) — full design including Windows asymmetries and cleaning protocol
- [cas/staging.md](./cas/staging.md) — mtime grace period rationale and POSIX `flock`/`unlink` asymmetry
- [66N-strategy-1-impl](./66N-strategy-1-impl.md) — the CAS-layer implementation that depends on these effects
