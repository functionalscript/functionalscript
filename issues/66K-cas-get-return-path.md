# 66K-cas-get-return-path. `cas get` should return a path/URL rather than copy bytes

**Priority:** P3
**Status:** open

## Problem

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

## Proposal

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

## Tasks

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

## Related

- [i66J-cas-streaming-upload-design](./66J-cas-streaming-upload-design.md) — upload pipeline that stores files `cas get` cannot currently read back
- [i66K-cas-upload-reject-symlinks](./66K-cas-upload-reject-symlinks.md) — related upload-path hardening
