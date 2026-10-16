## sparse-write. Write past the end of a file without filling the gap

**Priority:** P3
**Status:** open

### Problem

The shell replaces a file whole, so the host's `writeBytes` (`../module.mjs`)
reads the file, builds `offset + data.length` bytes in memory with zeros
between the old end and `offset`, and writes them all back. Node's positional
write leaves a hole instead, which a filesystem with sparse files stores
without blocks. The bytes that read back are the same; the cost is not.
Measured on SpiderMonkey 140.14.0:

- `new Uint8Array(n)` allocates up to 2³³ bytes (8 GiB), so a write at an
  offset of several GiB takes that much memory and writes that much to disk.
- Past 2³³ it throws `RangeError: invalid array length`, which the host
  returns as the write's failure, where Node succeeds.

Every write also costs the file's size, past the end or not, which
`writeChunks` pays once per 128 KiB chunk.

No caller writes past the end: `writeChunks` and `fjs/cas` each write a chunk
at the offset where the last one ended. Raised in review of
[#2991](https://github.com/functionalscript/functionalscript/pull/2991#discussion_r4297433661).

### Proposal

Wait for a program that needs a write past the end, then choose:

- **Write in place with a tool that seeks**, such as `dd` with `seek=` and
  `conv=notrunc` through `os.system`. That leaves a hole as Node does, and
  stops rewriting the whole file on every write. It is an external tool,
  waiting on approval as `mkdir` and `rm` did
  ([AGENTS.md §6](../../../../AGENTS.md#6-external-tools)), and it needs the
  bytes passed through a file or a pipe.
- **Refuse a write that starts past the end.** No caller needs one, and a
  refusal is loud, but it refuses what the host answers as Node does today, at
  every size the machine can hold.

### Tasks

- [ ] Pick one of the two when a program writes past the end of a file, and
      check it against the Node host with a write several GiB past the end.
