## stat-then-read. The entry validated is not the entry read

**Priority:** P3
**Status:** open

### Problem

`respond` calls `stat(path)` and then `readFile(path)`. Those are two
operations on a *name*, not one operation on a file, so what the second one
opens need not be what the first one described. Replace the entry in between and
the guards that `stat` made possible answer for something that is gone:

- a small regular file swapped for an oversized one is `500`, not the `413` the
  size check exists to produce — the Node runner's `readFile` has its own size
  guard, but it throws a plain `Error`, which this module can only report as a
  host failure;
- a regular file swapped for a **FIFO** is opened, and the read blocks until
  something writes, which is exactly what the `isFile` guard exists to prevent.
  The runner's `readFile` checks size and not kind.

Reported on
[#1693](https://github.com/functionalscript/functionalscript/pull/1693).

Two things bound it, and neither is a fix. The server binds loopback, and
whoever can swap an entry inside the served tree can already put anything they
like there — the window turns a guard into a slower guard rather than opening a
door that was closed. What it does defeat is the *promise*: the module's table
says `413` for oversize and `404` for a non-regular entry, and under a race it
says `500` or stops answering.

### Proposal

Validate and read through one opened handle: `open`, `fstat` that handle, then a
bounded read from it. A handle names an inode, so nothing can be substituted
underneath it.

`Fs` has no such operation. `ReadFile` takes a path and returns the whole
`Vec`, and the handle the Node runner opens for `writeFromStream` is internal to
that operation. So this needs a new effect — an open handle as a value, with
`fstat` and a bounded read on it — and the virtual runner needs to model handles
before any of it can be proven. That is the same shape as
[symlink-containment](./symlink-containment.md), and for the same reason: a
guard that a name cannot express needs the file system to offer something other
than names.

`O_NONBLOCK` on the open would answer the FIFO half on its own, on a host; it
would not answer the size half, and it is a flag the effect layer has no way to
pass.

### Tasks

- [ ] Design the handle effect: `open`, `fstat`, bounded read, close.
- [ ] Model handles in the virtual file system, so the guard is provable.
- [ ] Read through it in `fjs/web`, retiring the `stat`-then-`readFile` pair.

### Related

- [`fjs/web`](../README.md) — the response table this race can contradict.
- [symlink-containment](./symlink-containment.md) — the other guard that cannot
  be written against a name.
- `fjs/effects/node/module.mjs` — `readFile`, whose own size check throws where
  this module wants a `413`.
