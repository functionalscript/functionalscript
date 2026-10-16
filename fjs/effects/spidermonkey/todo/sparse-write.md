## sparse-write. Write past the end of a file

**Priority:** P3
**Status:** open

### Problem

The host's `writeBytes` (`../module.mjs`) refuses a write that starts past the
end of a file, where Node's positional write leaves a hole that reads as zeros.
The shell replaces a file whole, so the host writes by reading the file, laying
the bytes over it, and writing it all back. Filling a gap that way would hold
the whole gap in memory. Measured on SpiderMonkey 140.14.0:

- A typed array holds up to 2³³ bytes (8 GiB). So a write several GiB past the
  end would take that much memory, and write that much to disk.
- Past 8 GiB, the allocation throws `RangeError: invalid array length`.

No caller needs a write past the end: `writeChunks` and `fjs/cas` each write a
chunk at the offset where the last one ended. An empty write succeeds at any
offset and changes nothing, as Node's does. Raised in review of
[#2991](https://github.com/functionalscript/functionalscript/pull/2991#discussion_r4297433661).

### Proposal

When a program needs one, write in place with a tool that seeks, such as `dd`
with `seek=` and `conv=notrunc` through `os.system`. That leaves a hole as Node
does, and stops rewriting the whole file on every write. It is an external
tool, waiting on approval as `mkdir` and `rm` did
([AGENTS.md §6](../../../../AGENTS.md#6-external-tools)), and the bytes would
reach it through a file or a pipe.

### Tasks

- [ ] Write in place through a seeking tool, once approved.
- [ ] Check it against the Node host: a write past the end, and one several GiB
      past it.
