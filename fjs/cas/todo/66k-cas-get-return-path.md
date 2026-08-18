## 66K-cas-get-return-path. `cas get` should return a path/URL rather than copy bytes

**Priority:** P3
**Status:** open

### Problem

`fileCas(sha2)(path).read` (`fjs/cas/module.f.mjs`) already streams the stored blob in
`<=128 KiB` chunks (`readBytes` in a loop, capped by `chunkBytes`/`maxLengthBytes` per
chunk, not per file), and `cas get` (`fjs/cas/cli/module.f.mjs`) pipes that stream to the
destination file via `writeFromStream`, so it no longer holds the whole file in memory and
is not limited to 128 KiB files. `FileCas` also already exposes a `url` method
(`fjs/cas/module.f.mjs`, and see `fjs/cas/types.ts`) that returns the path to a hash's
shard without reading its content.

What is still missing: `cas get` always copies the blob's bytes into a fresh destination
file. There is no way to ask it to just print the existing shard path (or a `file://` URL)
instead, so a caller that only wants to know where the content lives — to hard-link, open
directly, or hand the path to another tool — still pays for a full copy.

### Proposal

Add a mode where `cas get` prints the filesystem **path** (or a `file://` URL) of the
stored object instead of copying it to a destination file. Callers that need a private
copy can still request the current copy-out behavior; callers that only need to locate
the content use the new mode and open/stream/hard-link it themselves.

Additionally, mark the stored object **read-only** (e.g. `chmod 444`) immediately
after the final `rename` in the upload pipeline. This:

- Enforces the CAS immutability invariant at the OS level.
- Prevents accidental overwrites of a shard by a second upload of the same
  content.
- Signals to the OS that the file is a good candidate for de-duplication
  (copy-on-write / reflinks).

### Tasks

- [ ] Add a `chmod` (or `setReadOnly`) effect for marking files immutable after
      write
- [ ] Add a `cas get` mode (flag or subcommand) that prints the shard path — via
      the existing `FileCas.url` — instead of copying bytes to a destination file
- [ ] Apply `setReadOnly` in the `cas upload` pipeline after the final `rename`
- [ ] Update proof tests and documentation

### Related

- `fileCas.write` / `casAddFile` (`fjs/cas/module.f.mjs`) — streaming upload
  pipeline; `cas get` now reads uploaded files back via the streaming `read`
  path (design formerly tracked as `66j-cas-large-file-support`, now
  implemented and deleted)
