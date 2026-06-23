# TODO

## 66G-cas-get-verify-option. Option to verify the hash during cas get / read

**Priority:** P3
**Status:** open

### Problem

`Cas.read` / `fileKvStore.read` (`fs/cas/module.f.ts:51-57, 85-92`) and the `cas get`
command (`fs/cas/module.f.ts:126-146`) return the bytes stored at an address without
recomputing their hash. If a blob was corrupted, truncated, or misnamed — for example by
disk corruption or by a copy-files synchronization that has not yet been verified — a reader
between the copy and a later scrub can consume invalid content under a hash that was signed
or referenced elsewhere. The reader has no way to ask "and prove these bytes actually hash
to the address I requested."

A separate batch [`cas verify`](todo.md) command catches corruption
eventually, but there is a window before it runs, and some callers want certainty at the
moment of read rather than relying on a background scrub.

### Proposal

Offer an **opt-in verification mode** on read:

- a flag on `cas get` (e.g. `--verify`) that recomputes the SHA-2 hash of the returned bytes
  and confirms it matches the requested address before writing the output file, failing with
  a clear error otherwise;
- a corresponding option at the library level (e.g. a `verifiedRead` wrapper, or a parameter
  on `cas(sha2)`) so embedders can require verification per call or per store.

Keep it opt-in: verification costs a full rehash per read, which is wasteful for hot paths
that already trust the store. Callers that need integrity (untrusted source, security-sensitive
content, freshly synced data not yet scrubbed) turn it on.

Open design points:

- default off vs. on for `cas get`;
- whether to expose it through the MCP CAS tools as well;
- error shape on mismatch (treat as not-found vs. a distinct "corrupted" error).

### Tasks

- [ ] Add a `verifiedRead`-style helper that rehashes and compares against the requested key
- [ ] Add a `--verify` flag to the `cas get` command
- [ ] Decide whether MCP CAS read tools expose the same option
- [ ] Tests: corrupted blob read with verification fails; clean blob passes
- [ ] Document the option in `fs/cas/README.md`

### Related

- [i66G-cas-verify-command](todo.md) — batch scrub for the same invariant
- `issues/plan/vision.md` — protocol-agnostic synchronization / copy-files sync

---

## 66G-cas-verify-command. CAS verify command: rehash stored blobs and delete corrupted ones

**Priority:** P3
**Status:** open

### Problem

`fileKvStore.read` (`fs/cas/module.f.ts:51-57`) returns whatever bytes live at the
addressed path without recomputing the hash. After **synchronization by copying files**
(see `issues/plan/vision.md`), or simply over time on a faulty disk, a blob can become
corrupted, truncated, or misnamed and no longer hash to the address it sits under. Nothing
in the store currently detects this, so the `same hash = same content` invariant the rest
of the design relies on can silently break, and a bad no-overwrite file can even block a
later correct sync of the same hash.

The vision doc allows deferred verification for trusted-source copies ("copy first, verify
later, delete what fails"). That deferred step needs an actual command to run.

### Proposal

Add a `cas verify` command (and a reusable library function behind it) that:

- iterates every stored hash via `Cas.list` / `KvStore.list`,
- re-reads each blob, recomputes its SHA-2 hash, and compares it to the address,
- deletes (or quarantines) any blob whose recomputed hash does not match its path,
- reports a summary: number checked, number corrupted, hashes removed.

Intended uses:

- run once right after a copy-files synchronization from a trusted source, to catch
  corruption introduced in transit/on disk;
- run periodically (e.g. a scheduled scrub) to detect bit-rot independently of any sync.

Open design points:

- delete vs. move-to-quarantine (safer: don't destroy until reviewed);
- whether deletion needs `Rm`/unlink effects added to the CAS operation set;
- exit code / output format so it is scriptable in CI and cron.

### Tasks

- [ ] Add a `verify` function over `Cas`/`KvStore` that rehashes and reports mismatches
- [ ] Wire it as a `cas verify` CLI command in `fs/cas/module.f.ts`
- [ ] Decide delete vs. quarantine for corrupted blobs and implement it
- [ ] Tests: seed a store with a corrupted/truncated/misnamed blob and assert it is caught
- [ ] Document the command in `fs/cas/README.md`

### Related

- [i66G-cas-get-verify-option](todo.md) — per-read verification for the same invariant
- `issues/plan/vision.md` — protocol-agnostic synchronization / copy-files sync

---

## 66J-cas-periodic-stage-recovery. Periodic recovery of incomplete staged files

**Priority:** P3
**Status:** open

### Problem

The staging directory `~/.cas/.stage/` may accumulate incomplete uploads if the CAS service crashes or is killed mid-process. These files are orphaned and consume disk space indefinitely.

Additionally, if a user manually restarts the upload process for a partially staged file, or if multiple CAS services are running in parallel, we need a way to detect and resume/complete incomplete staged files.

### Proposal

Add a periodic background task (e.g., every hour or on startup) that:

1. **Scans `~/.cas/.stage/`** for staged files matching the pattern `${rnd}-${fileName}`.

2. **Attempts to recover each file**:
   - Read the file in chunks
   - Compute its content hash
   - Move the file to the final location `~/.cas/${hash}`

3. **Handles failure gracefully**:
   - If the file disappears before completion (another CAS service may have finished it), log and continue—this is not a critical error.
   - If hash computation fails, log the error and leave the file in staging for manual inspection/retry.

4. **Logs recovery actions** for observability (which files were recovered, how many bytes).

#### Assumptions

- Multiple CAS services may run in parallel and share the same `~/.cas/` directory.
- Files can safely disappear from staging if another service completes the process.
- Manual intervention is not required for "missing file" errors.

### Tasks

- [ ] Define periodic task interface/scheduling (timer, cron-like, or manual trigger)
- [ ] Implement staged file scanner and recovery logic
- [ ] Reuse streaming hash computation from large-file upload
- [ ] Add logging/observability for recovery actions
- [ ] Handle concurrent writes (what if multiple services try to move the same file?)
- [ ] Add integration tests for recovery scenarios (normal completion, file disappears, hash failure)
- [ ] Document recovery behavior in `fs/cas/README.md`

### Related

- [i66J-cas-large-file-support](todo.md) — staging directory and streaming upload design

---

## 66J-cas-readfile-size-limit. Handle large files in CAS read

**Priority:** P2
**Status:** open
**Blocked by:** —

### Problem

Currently, when CAS tries to read a file larger than `readFile`'s size limit:
1. `fileKeyValue` read throws an exception
2. This crashes the MCP server or CLI process
3. The temporary fix in the current branch makes CAS get return `not found` for huge files, which is incorrect

This is a critical issue for reliability and correctness.

### Proposal

1. **readFile should return `'toobig'` error**: Instead of returning a generic error when a file exceeds the size limit, `readFile` should return a special `'toobig'` error variant. This allows callers to handle size-limited reads gracefully.

2. **CAS read should handle the toobig error**:
   - When `readFile` returns `'toobig'`, `cas_get` should:
     - Get the file size without reading content
     - Return file metadata:
       - `size`: actual file size
       - `type`: `'base64'` (unknown binary format)
       - `mime_type`: `'application/octet-stream'`
   - This allows MCP clients to know the file exists, its size, and that it's too large to fetch inline.

3. **Update error handling**:
   - MCP should report the file metadata without crashing
   - CLI should provide a helpful error message indicating the file size and suggesting alternative access methods

### Tasks

- [ ] Add `'too big'` error variant to fileKeyValue read result type
- [ ] Update CAS read to catch size errors from fileKeyValue read
- [ ] Return file metadata (size, type, mime_type) when file is too large
- [ ] Update MCP tool handler to format response correctly
- [ ] Add test cases for files at and above the size limit
- [ ] Document the size limit in CAS README

### Related

- Current branch: docker-mcp (temporary fix in place)
- File: `fs/cas/mcp/module.f.ts` (cas_get implementation)

---

## 66J-cas-large-file-support. Support files larger than 131 KB via streaming upload

**Priority:** P3
**Status:** wip

### Problem

CAS currently has a hard limit of 131 KB per file and stores content in memory before computing hashes. This prevents storing practical file sizes:
- Binary artifacts (compiled executables, archives)
- High-resolution images
- Video thumbnails
- Large datasets or JSON exports
- Generated code files

Storing files in memory is infeasible for large files (GBs+), and the 131 KB artificial ceiling must be removed or significantly increased.

### Proposal

Two-phase staged move for `cas upload` (or `cas_add` with restricted paths):

1. **Move from `~/cas_upload/` to staging**: File is atomically moved from `~/cas_upload/${fileName}` to `~/.cas/.stage/${rnd}-${fileName}`, where `rnd` is a random 256-bit number in CBase32.

2. **Stream-hash the staged file**: Read the file in `maxLengthBytes` (128 KiB) chunks via `readBytes` and incrementally compute the SHA-256 hash, avoiding large memory allocations.

3. **Move to final location**: Once hash is computed, rename the staged file to `~/.cas/<shard>/<hash>` using the existing sharded layout.

#### Rationale

- **Move vs. copy**: Fast—no data duplication. Files in `~/cas_upload/` exist *only* to be uploaded; once moved to staging, they're committed to the process.

- **Staging before hashing**: Prevents time-of-check-time-of-use (TOCTOU) races where the file could be modified between hash computation and final move.

- **Randomized staging names**: Avoids collisions between concurrent uploads.

- **Local staging instead of `/tmp`**: Supports recovery if the upload is interrupted—staged files remain available for cleanup or resumption.

#### Cleanup & Recovery

- **Abandoned staged files**: Add a background job or CLI command to clean up `~/.cas/.stage/` after a timeout (e.g., 24 hours).
- **Failed hashes**: If hash computation fails, leave the file in staging with an error logged; manual cleanup or retry is explicit.
- **Resumable uploads** (future): Staged files could be resumed if the process is killed mid-stream.

### Tasks

- [x] Add `randomInt`, `readBytes`, and `rename` primitives to `fs/effects/node`
- [x] Implement `random256` helper — 8 × `randomInt` calls folded into a 256-bit `Vec`
- [x] Implement `streamHash` — chunk-loop over `readBytes` feeding an incremental `Sha2` state
- [x] Add `cas upload <fileName>` command that orchestrates the move-hash-move pipeline
- [x] Add proof tests: happy path, upload-then-get roundtrip, wrong args, missing source file
- [ ] Reject symlinks in `~/cas_upload/` before the first rename (i66K-cas-upload-reject-symlinks)
- [ ] `cas get` is still limited by `readFile`'s 128 KiB cap — return path/URL instead (i66K-cas-get-return-path)
- [ ] Define cleanup policy and CLI command for `~/.cas/.stage/` abandoned files
- [ ] Document the upload flow in `fs/cas/README.md`

### Related

- [i66K-cas-upload-reject-symlinks](todo.md) — reject symlinks before staging
- [i66K-cas-get-return-path](todo.md) — `cas get` should return path/URL for large-file support

---

## 66J-cas-symlink-escape. Close symlink escape in `cas_add` path validation

**Priority:** P2
**Status:** open

### Problem

The `cas_add` path validation checks if a path starts with `${home}/cas_upload/` and doesn't contain `..`. However, if `~/cas_upload` is writable by the agent or user, they can place a symlink within it to escape the sandbox:

```
/home/user/cas_upload/passwd-link -> /etc/passwd
```

When `readFile` is called on this path, Node.js follows the symlink and reads `/etc/passwd`, despite the path passing the prefix check.

**Threat model**: This requires the attacker to already have write access to `~/cas_upload`. If they do, they have significant system access already. This is different from the arbitrary-read vulnerability (P1), which requires no pre-existing access.

### Proposal

Validate the **canonical real path** (resolving symlinks, `..`, and `.`) before reading:

1. **Resolve the path** to its canonical absolute form using `realpath()` or equivalent
2. **Verify** that the canonical path is still within the approved directory
3. **Then** call `readFile()`

This ensures that symlinks and other filesystem tricks cannot escape the sandbox.

### Tasks

- [ ] Add `realpath` effect to `fs/effects/node/module.f.ts` (or `canonicalizePath`)
- [ ] Update `cas_add` validation to resolve the canonical path
- [ ] Add tests for symlink-escape attempts (e.g., `/home/user/cas_upload/link -> /etc/passwd`)
- [ ] Verify the canonical path is within the approved directory after resolution
- [ ] Update `fs/cas/mcp/README.md` to document the symlink handling

### Related

- [i66J-normalize-home-paths](todo.md) — defense-in-depth path normalization (will subsume this issue)

---

## 66J-cas-upload-dir-command. Add `cas_upload_dir` command for batch uploads

**Priority:** P4
**Status:** open

### Problem

After large-file support is implemented, users will want a convenient way to upload multiple files from `~/cas_upload/` in batch without calling `cas_add` individually for each file.

### Proposal

Add a new MCP tool `cas_upload_dir` that:

1. Scans `~/cas_upload/` for all files
2. Processes each file through the streaming upload pipeline (stage → hash → finalize)
3. Returns a summary: count of uploaded files, total bytes, any errors

Usage:
```
cas_upload_dir({}) → {uploaded: 42, total_bytes: 1234567, errors: []}
```

### Tasks

- [ ] Implement `cas_upload_dir` tool in `fs/cas/mcp/module.f.ts`
- [ ] Reuse staging and recovery logic from large-file support
- [ ] Return structured summary (uploaded count, bytes, error list)
- [ ] Add tests for empty directory, mixed file types, permission errors
- [ ] Document in `fs/cas/mcp/README.md`

### Related

- [i66J-cas-large-file-support](todo.md) — streaming upload infrastructure
- [i66J-cas-periodic-stage-recovery](todo.md) — recovery mechanism

---

## 66J-normalize-home-paths. Normalize `~/` to absolute paths and validate directory containment

**Priority:** P3
**Status:** open

### Problem

The current path validation in `cas_add` uses the `home` parameter from `NodeProgramOptions` and rejects paths with `..`, which blocks common directory escape attempts. However, this is a string-based check that doesn't account for:
- Symlinks that point outside the directory
- Case-insensitive filesystems where directory boundaries are ambiguous
- Relative paths like `./subdir/../../../etc/passwd` that contain `..` in a less obvious way
- Future edge cases with canonical path resolution

**Better approach**: Normalize the path (resolve `..` and `.`, handle symlinks) into a canonical absolute path, then verify containment using filesystem semantics rather than string matching.

### Proposal

1. **Add a Node effect** (e.g., `normalizePath`) that:
   - Expands `~` to the home directory (using `os.homedir()`)
   - Resolves relative components (`..`, `.`)
   - Returns the canonical absolute path

2. **Update `cas_add` path validation** to:
   - Normalize the input path
   - Compute the canonical approved directory path (e.g., `${HOME}/cas_upload`)
   - Check that the normalized path starts with the approved directory (with proper directory boundary checking, not just string prefix)
   - Reject if outside the directory

3. **Handle errors gracefully**:
   - If path normalization fails (e.g., EACCES), return an error
   - If the normalized path escapes the sandbox, return a clear security error

### Tasks

- [ ] Define `normalizePath` effect in `fs/effects/node/module.f.ts` or similar
- [ ] Implement path normalization: expand `~`, resolve `..`, get canonical path
- [ ] Update `cas_add` to use normalized paths with proper directory boundary check
- [ ] Add test cases for path traversal attacks: `~/cas_upload/..`, `~/cas_upload/../etc/passwd`, etc.
- [ ] Ensure the check is robust: compare normalized paths, not string prefixes

### Related

- [i66J-cas-periodic-stage-recovery](todo.md) — will also need path normalization for staging directory

---

## 66K-cas-cli-mcp-shared-core. Share code between CAS CLI and MCP

**Priority:** P3
**Status:** open

### Problem

The CAS CLI (`fs/cas/module.f.ts` `commands`) and the CAS MCP server
(`fs/cas/mcp/module.f.ts`) both implement the same three operations — add,
get, list — but with duplicated logic:

- Both construct `cas(sha256)(fileKvStore(home))` independently.
- Both encode/decode hashes with `cBase32ToVec` / `vecToCBase32` in separate
  call sites.
- Content encoding policy (UTF-8 detection, base64, magic-byte sniffing,
  `url` type) lives only in the MCP layer; the CLI (`add`, `get`) bypasses it
  and deals in raw bytes, so any future encoding rule must be maintained in
  two places.
- Error messages for invalid hashes and missing blobs are written twice.

If a new operation or encoding rule is added, both transports must be updated
separately, with no compile-time guarantee they stay in sync.

### Proposal

Extract a transport-agnostic CAS operation layer — a small set of typed
functions that each accept a `Cas<O>` and return an `Effect` — shared by both
the CLI command handlers and the MCP tool handlers. This layer owns:

- building `cas(sha256)(fileKvStore(home))` once (or accepting it as a
  parameter),
- hash parsing and error reporting,
- content encoding/decoding rules (text / base64 / url / mime detection).

The CLI and MCP modules become thin adapters: CLI maps flags/args to the
shared calls; MCP maps JSON-RPC tool args to the same calls.

#### `add` operation — unified design

The shared layer defines a single `add` input type with two mutually exclusive
sources:

| Source | CLI | MCP |
|--------|-----|-----|
| Inline content (bytes / text / base64 string) | `cas add <content>` | `cas_add { content, type? }` |
| File path (`url`) | any path allowed | only paths inside `~/cas_upload/` |

**Path handling** uses a staging area (`./cas/stage/`) to avoid partial writes
and to mark blobs read-only before they enter the store:

1. **Path inside `~/cas_upload/`** (both CLI and MCP):
   - Move the file into `./cas/stage/`.
   - Mark the staged file read-only.
   - Compute hash; move the file to its final CAS location.

2. **Path outside `~/cas_upload/`**:
   - **CLI**: Copy the file into `./cas/stage/` while computing the hash; mark
     it read-only; move it to its final CAS location.
   - **MCP**: Return `isError: true` with message `"access denied"` — the MCP
     server does not have filesystem access beyond the upload directory.

The staging step is the same in both cases; only the initial acquire differs
(move vs copy) and MCP enforces the path restriction before staging begins.

#### `KvStore` interface change

The current `KvStore.write` accepts a `(key, value: Vec)` pair and writes the
bytes directly. To support the staging pipeline, `KvStore` needs a second entry
point:

```ts
move: (stagePath: string, key: Vec) => Effect<O, void>
```

`move` assumes the blob is already on disk at `stagePath` (inside
`./cas/stage/`), marked read-only, and simply renames it into its final CAS
location. This avoids re-reading large files into memory and keeps the
`write`-by-value path for inline content.

### Tasks

- [ ] Identify all logic duplicated between `commands` (CLI) and
      `casToolRegistry` (MCP) — hash codec, store construction, encoding rules.
- [ ] Add `move: (stagePath: string, key: Vec) => Effect<O, void>` to `KvStore`
      and implement it in `fileKvStore`.
- [ ] Design the staging directory (`./cas/stage/`) and the acquire-stage-store
      pipeline; add `Rename` / `Copy` effects if missing from
      `fs/effects/node/module.f.ts`.
- [ ] Define a shared `casOps` (or similar) module/functions in
      `fs/cas/ops/module.f.ts` (or inline in `fs/cas/module.f.ts`) that
      expose typed operations independent of transport, including the unified
      `add` with path-restriction parameter.
- [ ] Refactor CLI `commands` to delegate to the shared layer (pass
      `allowAnyPath: true`).
- [ ] Refactor `casToolRegistry` to delegate to the shared layer (pass
      `allowAnyPath: false`, returning `"access denied"` for out-of-sandbox
      paths).
- [ ] Verify no behaviour change: existing CLI and MCP tests still pass; add
      new tests for the staging flow and the MCP path-restriction error.

### Related

- `fs/cas/module.f.ts` — CLI commands and core types
- `fs/cas/mcp/module.f.ts` — MCP tool registry and server

---

## 66K-cas-cli-mcp-shared-upload. CLI and MCP should share `cas_add`/`cas upload` logic

**Priority:** P3
**Status:** open

### Problem

The CLI (`fs/cas/module.f.ts`) and MCP server (`fs/cas/mcp/module.f.ts`) both
implement "store a file from `~/cas_upload/`" independently:

| Path | Implementation |
|------|---------------|
| `cas upload <name>` (CLI) | move-hash-move via `random256` + `streamHash` + `rename` — no size limit |
| `cas_add { type:'url' }` (MCP) | `readFile` — capped at 128 KiB |

As the upload pipeline gains correctness fixes (symlink rejection, read-only
chmod, cleanup policy), each fix must be applied in two places. The MCP path
currently lags: it can silently truncate or reject large files while the CLI
handles them correctly.

### Proposal

Extract the upload pipeline into a shared function in `fs/cas/module.f.ts` (or a
new `fs/cas/upload/module.f.ts`) that both the CLI handler and the MCP tool
delegate to:

```typescript
// proposed shared primitive
const casUpload = (home: string) => (fileName: string): Effect<..., Vec>
```

The function encapsulates `random256` → `mkdir` → `rename` to stage →
`streamHash` → `mkdir` → `rename` to final, and returns the hash. Both callers
then reduce to argument validation + calling `casUpload`.

The MCP `cas_add` with `type:'url'` should be replaced or supplemented by a
`cas_upload` tool that delegates to the same function, removing the 128 KiB cap
and ensuring the same security invariants apply regardless of transport.

### Tasks

- [ ] Export (or move) `random256` and `streamHash` from `fs/cas/module.f.ts` so
      they are reusable without re-implementing
- [ ] Extract a `casUpload(home)(fileName): Effect<..., Vec>` function shared by
      CLI and MCP
- [ ] Replace `cas_add { type:'url' }` in the MCP registry with a `cas_upload`
      tool (or upgrade the `type:'url'` branch) to use `casUpload` instead of
      `readFile`
- [ ] Ensure all future pipeline fixes (symlink rejection, chmod, cleanup) are
      applied once in `casUpload` and inherited by both transports

### Related

- [i66J-cas-streaming-upload-design](todo.md) — streaming upload pipeline (CLI only so far)
- [i66K-cas-upload-reject-symlinks](todo.md) — fix that must not be applied twice
- [i66K-cas-get-return-path](todo.md) — analogous read-path gap between CLI and MCP

---

## 66K-cas-get-return-path. `cas get` should return a path/URL rather than copy bytes

**Priority:** P3
**Status:** open

### Problem

`cas get` currently reads the full file content through `fileKvStore.read` →
`readFile`, which is capped at `maxLengthBytes` (128 KiB). Files uploaded via the
streaming path (`cas upload`) can exceed this limit: the hash is stored and the
source is removed, but `cas get <hash>` silently reports the file as missing
because `readFile` rejects oversized reads and `fileKvStore.read` maps that error
to `undefined`.

More broadly, copying the full byte content through the effect layer is the wrong
model for large files: it requires a `Vec` allocation the size of the file, passes
it back to the caller, and forces the caller to write it out again — doubling peak
memory use.

### Proposal

Change `cas get` (and the underlying read path) to return the filesystem **path**
of the stored object rather than its contents. Callers that need the bytes can
open the file themselves, stream it, or hard-link / copy it at the OS level with
no size restriction.

Two concrete forms to consider (may coexist):

- **Path** — return the absolute path string to the `.cas/…` shard file; the
  caller issues a system-level copy or `rename` as needed.
- **`file://` URL** — same information, useful when the result is consumed by a
  web client or another tool that already speaks URLs.

Additionally, mark the stored object **read-only** (e.g. `chmod 444`) immediately
after the final `rename` in the upload pipeline. This:

- Enforces the CAS immutability invariant at the OS level.
- Prevents accidental overwrites of a shard by a second upload of the same
  content.
- Signals to the OS that the file is a good candidate for de-duplication
  (copy-on-write / reflinks).

### Tasks

- [ ] Add a `stat` / `lstat` primitive (or extend an existing one) to retrieve
      file size without loading content, so callers can branch on size
- [ ] Add a `chmod` (or `setReadOnly`) effect for marking files immutable after
      write
- [ ] Change `cas get` to print the shard path (and optionally a `file://` URL)
      instead of copying bytes to a destination file
- [ ] Update `fileKvStore` (or add a parallel interface) with a `getPath` method
      that returns the path for a given hash without reading content
- [ ] Apply `setReadOnly` in the `cas upload` pipeline after the final `rename`
- [ ] Update proof tests and documentation

### Related

- [i66J-cas-streaming-upload-design](todo.md) — upload pipeline that stores files `cas get` cannot currently read back
- [i66K-cas-upload-reject-symlinks](todo.md) — related upload-path hardening

---

## 66K-cas-upload-reject-symlinks. Reject symlinks before moving them into CAS

**Priority:** P2
**Status:** open

### Problem

When the upload source in `~/cas_upload/` is a symlink, `rename(src, stagePath)`
moves the link itself rather than the target. `readBytes(stagePath)` then hashes
the target's contents, but the final CAS object at `~/.cas/<hash>` remains a
symlink.

This breaks two CAS invariants:

- **Immutability** — `cas get` / `readFile` follows the symlink at read time, so
  the bytes returned for a stored hash can change if the target is modified or
  replaced.
- **Confinement** — the link can point outside `~/cas_upload/`, bypassing any
  path restriction.

### Proposal

Before the first `rename`, verify that the source is a regular file. Two options:

1. **`lstat` check** — add an `lstat` effect that returns file-type metadata
   without following the link; reject if `isSymbolicLink()` is true. Fast and
   leaves the file in place on rejection.

2. **Materialize** — copy the dereferenced bytes into a fresh regular file in
   staging, then delete the original symlink. Avoids needing a new primitive but
   costs an extra read/write for every upload.

Option 1 is preferred: it catches the problem early with minimal overhead and
keeps the move-hash-move pipeline atomic.

### Tasks

- [ ] Add `lstat` effect (or extend `access`/`stat`) to expose `isSymbolicLink`
- [ ] In `cas upload`, call `lstat` on `src` before `rename`; return an error if
      it is a symlink or any non-regular-file type
- [ ] Add proof test: uploading a symlink must fail before touching staging

### Related

- [i66J-cas-streaming-upload-design](todo.md) — the upload pipeline where this issue arises

---

## 66N-cas-get-response-shape. Collapse `cas_get`'s three response-building arms into one helper

**Priority:** P3
**Status:** open

### Problem

The `cas_get` handler in `fs/cas/mcp/module.f.ts` decides the MIME type of a blob in
three phases — magic-byte sniff, UTF-8 validation, octet-stream fallback — and then,
in each phase, **rebuilds the same JSON response from scratch**:

```ts
// fs/cas/mcp/module.f.ts:152-201 (abridged)
const byteLength = Number(bitVecLength(value) / 8n)
// Phase 1: magic-byte sniffing
const detectedMime = detect(value)
if (detectedMime !== null) {
    const url = toUrl?.(key)
    const meta: Record<string, unknown> = {
        length: byteLength,
        mime_type: detectedMime,
        type: 'base64',
        ...(url !== undefined && { url })
    }
    if (r.content === true) {
        const blob = base64Encode(value)
        return pure(blob === null
            ? errorResult(`content is not byte-aligned: ${r.hash}`)
            : okResult(JSON.stringify({ ...meta, content: blob })))
    }
    return pure(okResult(JSON.stringify(meta)))
}
// Phase 2: UTF-8 validation
const str = fromVec(value)
const url = toUrl?.(key)
if (str !== null) {
    const meta: Record<string, unknown> = {
        length: byteLength,
        mime_type: 'text/plain',
        type: 'text',
        ...(url !== undefined && { url })
    }
    return pure(r.content === true
        ? okResult(JSON.stringify({ ...meta, content: str }))
        : okResult(JSON.stringify(meta)))
}
// Phase 3: octet-stream fallback
const meta: Record<string, unknown> = {
    length: byteLength,
    mime_type: 'application/octet-stream',
    type: 'base64',
    ...(url !== undefined && { url })
}
if (r.content === true) {
    const blob = base64Encode(value)
    return pure(blob === null
        ? errorResult(`content is not byte-aligned: ${r.hash}`)
        : okResult(JSON.stringify({ ...meta, content: blob })))
}
return pure(okResult(JSON.stringify(meta)))
```

Two distinct response-shaping concerns are copy-pasted across the three phases:

1. **The `meta` record** — `{ length, mime_type, type, ...(url && { url }) }` — is
   written out three times (`:157-162`, `:176-181`, `:187-192`), differing only in the
   `mime_type` and `type` fields.
2. **The "include content?" envelope** — *if `r.content !== true` emit `meta`, else
   encode the content and emit `{ ...meta, content }`, erroring when the encoder
   returns `null`* — is written three times (`:163-170`, `:182-185`, `:193-200`).
   Phases 1 and 3 are **byte-identical** except for the `mime_type` string: same
   `base64Encode(value)`, same `content is not byte-aligned` error, same branch shape.

`url` is also recomputed twice (`const url = toUrl?.(key)` at `:156` and again at
`:174`) when it does not depend on the phase at all.

This is the `AGENTS.md` case verbatim — *"When two code branches share most of their
structure, refactor so the shared part appears once and only the difference lives in
the conditional"* — applied across three branches whose only real differences are
(`mime_type`, `type`, *how the inline content string is produced*). The phase
selection (sniff → UTF-8 → fallback) is the genuinely varying logic; the response
construction wrapped around it is not.

### Proposal

Compute `url` once, then name the response-shaping concern in a single local helper
that takes only what actually varies between phases: the `mime_type`, the `type`
discriminant, and a thunk that produces the inline content string (or `null` when it
cannot be encoded). The helper owns the `meta` shape and the `content`-envelope
branching:

```ts
const byteLength = Number(bitVecLength(value) / 8n)
const url = toUrl?.(key)

// the one place the response shape lives
const respond = (
    mimeType: string,
    type: 'text' | 'base64',
    encode: () => string | null,
) => {
    const meta = {
        length: byteLength,
        mime_type: mimeType,
        type,
        ...(url !== undefined && { url }),
    }
    if (r.content !== true) { return pure(okResult(JSON.stringify(meta))) }
    const content = encode()
    return pure(content === null
        ? errorResult(`content is not byte-aligned: ${r.hash}`)
        : okResult(JSON.stringify({ ...meta, content })))
}

// the phases now read as just the classification decision:
const detectedMime = detect(value)
if (detectedMime !== null) {
    return respond(detectedMime, 'base64', () => base64Encode(value))
}
const str = fromVec(value)
if (str !== null) {
    return respond('text/plain', 'text', () => str)
}
return respond('application/octet-stream', 'base64', () => base64Encode(value))
```

The three `meta` literals collapse to one, the `content`-envelope branching is written
once, `url` is computed once, and the two base64 phases differ only in the `mime_type`
argument they pass. The `mime_type`/`type` pairing per phase stays visible at the call
site, so the classification logic is *more* readable, not hidden.

#### Notes

- `respond` captures `value`, `key`/`r.hash`, `r.content`, `url`, `byteLength` and
  `pure`/`okResult`/`errorResult` from the enclosing closure — it is local to the
  handler body (it cannot be hoisted to module scope because it closes over per-call
  state), which matches the existing structure of this handler.
- The text phase passes `() => str` where `str` is already non-`null`, so its
  `content === null` arm is never taken *for that phase* — but the two base64 phases
  exercise both arms, so whole-function branch coverage in
  `fs/cas/mcp/proof.f.ts` is preserved. Confirm the proof still drives: a binary
  (sniffed) blob, a valid-UTF-8 blob, an octet-stream blob, each with and without
  `content: true`, plus a non-byte-aligned blob to hit the `null` error arm.
- The literal `meta` object is built from non-literal values (`byteLength`,
  `mimeType`, `type`), so it does not need `as const`; but the explicit `Record<string,
  unknown>` annotation in the current code can be dropped — let inference type `meta`,
  per the "prefer type inference" guidance.

### Tasks

- [ ] Hoist `url = toUrl?.(key)` above the phase checks and add the local `respond`
      helper in the `cas_get` handler of `fs/cas/mcp/module.f.ts`.
- [ ] Rewrite the three phases to call `respond(...)`, removing the duplicated `meta`
      literals and `content`-envelope branches.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/cas/mcp/proof.f.ts` passes with full
      line/branch coverage (the response is byte-identical for every case).

### Related

- The `cas_get` tool (text/base64 split, MIME metadata, get/add unification) was
  implemented in prior work. This issue is the internal-readability follow-up on the
  handler those changes left behind; it changes no behaviour or wire format.

---


