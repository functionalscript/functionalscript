## stat-then-read. The entry validated is not the entry read

**Priority:** P3
**Status:** open

**It is what makes
[streaming-http-bodies](../../effects/node/todo/streaming-http-bodies.md) cheap,
and it used to be what made it possible** — the direction the status line has no
value for, `blocked` being the one for an
issue *waiting on* another and nothing holding this one up
([todo/README.md](../../../todo/README.md)). That issue serves a file in chunks,
and a chunk loop over a *name* resolves it once per chunk rather than once per
body: a replaced entry can be spliced into a response that is clean, correctly
sized, and made of two files. The handle effect below is what binds every chunk
of one response to one inode while the body stays lazy, so it stops being a
slower-guard fix. It was a prerequisite of that feature until `readWhole` landed
on 2026-09-14 (`11e3533f`), which binds the chunks too by materializing the whole
file. That issue's 2026-09-22 note records the trade and keeps the eager route as
an alternative. Its remaining `fjs/web` task is the handle effect's.

**The eager route has since landed, and it took most of this issue's problem with
it.** `fjs/web` reads through `readWhole`, so what is left here is the window
*inside* that one operation — it `stat`s the path and then opens it — rather than
the window between two operations `respond` performs. The Problem below says what
each of the two original guards costs now. What this issue still owes is
undiminished: a body that is lazy as well as bound to one inode, which no
operation in `Fs` can give.

### Problem

`respond` calls `stat(path)` and then `readWhole(path)`. Those are two
operations on a *name*, not one operation on a file, so what the second one
opens need not be what the first one described. Replace the entry in between and
the guard that `stat` made possible answers for something that is gone.

There were two such guards when this was reported on
[#1693](https://github.com/functionalscript/functionalscript/pull/1693), and
`readWhole` changed what each one costs:

- **The size guard is gone**, and so is the race against it. It existed because a
  response could not carry more than one `Vec`; a chunk list can carry any file,
  so no size is checked before the read and there is no `413` for a swap to turn
  into a `500`.
- **The kind guard remains, and its window moved inside one operation.**
  `readWhole` refuses a path that is no regular file itself, before it opens —
  and then opens, so the swap has to land between *its* `stat` and *its* `open`
  to be answered at all. That is the host's own race and not one the operation
  creates; what it removes is the race between the reads. A FIFO substituted in
  that window is still opened, and the read blocks until something writes.

Two things bound it, and neither is a fix. The server binds loopback, and
whoever can swap an entry inside the served tree can already put anything they
like there — the window turns a guard into a slower guard rather than opening a
door that was closed. What it does defeat is the *promise*: the module's table
says `404` for a non-regular entry, and under a race it stops answering at all.

### Proposal

Validate and read through one opened handle: `open`, `fstat` that handle, then a
bounded read from it. A handle names an inode, so nothing can be substituted
underneath it.

`Fs` has no such operation. `ReadFile` takes a path and returns the whole
`Vec`; `ReadWhole` takes a path too, and the handle it opens is internal to it, as
is the one the Node runner opens for `writeFromStream`. So this needs a new
effect — an open handle as a value, with
`fstat` and a bounded read on it — and the virtual runner needs to model handles
before any of it can be proven. That is the same shape as
[symlink-containment](./symlink-containment.md), and for the same reason: a
guard that a name cannot express needs the file system to offer something other
than names.

`O_NONBLOCK` on the open would answer the FIFO half on its own, on a host, which
is now the whole of the race rather than one of two halves of it — and it is a
flag the effect layer has no way to pass.

**A handle can outlive the effect that opened it, and then its `close` needs an
owner.** `fjs/web`'s will: a streamed response is pulled by the runner's pump,
which stops wherever it stops — a `HEAD` body it never pulls at all, a client
that hangs up mid-download, a refusal before the headers — so the `close` can be
neither the last cell of the body nor the reader's own business.
[streaming-http-bodies](../../effects/node/todo/streaming-http-bodies.md) gives
it to the runner, as a `release` the response carries beside its body. What is
left here is the operation that `release` calls, and a virtual file system whose
open handles a proof can count.

### Tasks

- [ ] Design the handle effect: `open`, `fstat`, bounded read, close.
- [ ] Model handles in the virtual file system, so the guard is provable and an
      unclosed handle is something a proof can fail on.
- [ ] Read through it in `fjs/web`, retiring the `stat`-then-`readWhole` pair and
      making the body lazy with it.

### Related

- [`fjs/web`](../README.md) — the response table this race can contradict, and
  "A path that descends through a file", whose `ENOTDIR` mapping re-stats the
  root and so degrades a *permanent* wrong status into this request-local one.
  A root held **open** would answer that case and the deleted-root case with no
  re-check at all, which is a second reason to want this effect.
- [symlink-containment](./symlink-containment.md) — the other guard that cannot
  be written against a name.
- `fjs/effects/node/module.mjs` — `readWhole`, whose own `stat`-then-`open` is
  where the remaining window lives.
