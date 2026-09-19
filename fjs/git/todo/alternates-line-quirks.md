## alternates-line-quirks. Two alternates lines this reader does not follow Git on

**Priority:** P4
**Status:** open

### Problem

`fjs/git/store` reads `objects/info/alternates` as Git does, measured line shape
by line shape — with two exceptions, each a place the file names a directory
this reader does not look in. Both are **misses and never wrong answers**: what
comes back from any directory is hashed against the id asked for, so a
divergence here can only fail to find an object, never hand back a different
one.

Neither is refused. An earlier revision refused the whole file for each, and
that was the worse trade: the refusal took a repository Git reads and made *all*
of it unreadable — the objects the store holds itself included — to avoid a miss
on a line no Git command writes. It cost three review rounds to learn, which is
why it is written down here rather than only in the history.

**1. Text after a closing quote.** Git takes the quoted path *and* makes a second
entry out of the remainder — missing its first character. Measured on Git
2.43.0, a line of

```
"<donor1>/objects"../../../donor/.git/objects
```

made Git look for `<borrower>/objects/./../../donor/.git/objects`, one level
short of what is written; sacrificing a character to it,
`"<donor1>/objects"x../../../donor/…`, made Git read the donor. So the second
entry is a path nobody wrote, out of what looks like an off-by-one in how the
reader advances past the closing quote. This module takes the quoted path alone.

A store named *only* by that mangled second entry is unreachable here. No Git
command writes such a line; hand-editing is the only way to one.

**2. A path spelled in bytes.** `"/tmp/\377/objects"` names a directory whose
fourth-from-last byte is `0xFF`. Every path in this layer is a JavaScript
string, so the escape decodes to one *character* of that value and the host
writes it back as the two UTF-8 bytes `c3 bf` — a different directory. The same
holds for a file whose own bytes are not UTF-8, where the decoder answers `ÿ`
for a lone `0xFF` rather than failing.

This is [byte-paths.md](./byte-paths.md)'s subject and is fixed there, not here:
the paths have to be byte lists at the effects boundary before this reader can
do anything about it.

**A third shape was here and is closed.** A `NUL` inside a path — `"…\000x"` —
used to reach the host whole. Git ends the path at it and reads what is behind
it (measured on 2.43.0: `"<donor>/objects\000x"` gave the blob at exit 0, where
`"<donor>/objectsx"` and `"<donor>/objects\001x"` both exited 128), and so does
every system call, so `alternatesIn` ends it there too and there is no
divergence left to record.

It is written down because of what it was, not what it is: carrying the `NUL`
through was a **refusal** and not a miss, which is the one outcome this file
exists to argue against. Node will not pass a path holding one to the system
call at all — `TypeError [ERR_INVALID_ARG_VALUE]`, "must be a string … without
null bytes" — and `fjs/effects/node` turns that into a channel error carrying
the code. `ERR_INVALID_ARG_VALUE` is not `ENOENT`, so the store read was refused
rather than missing, on a repository Git reads. Every other row here is a miss;
that one was not, which is why it was fixed instead of listed.

### What an investigation would settle

- Whether the suffix is worth following at all, given that only a hand-written
  line produces one, and whether Git's off-by-one is a bug worth reporting
  upstream rather than reproducing.
- Whether a byte no decoder round-trips is better answered as a miss, as here,
  or named as a line that was skipped.
- Whether a reader wants somewhere to *report* a line it did not follow. Git
  prints `error: object directory … does not exist; check
  .git/objects/info/alternates` and carries on; the effects here have a channel
  for failure and none for a remark, so this carries on silently. That question
  is bigger than alternates and is noted in [byte-paths.md](./byte-paths.md)
  too.

### Tasks

- [ ] Measure how Git's `unquote_c_style` advances past the closing quote, and
      decide whether the second entry is intended.
- [ ] Move the `NUL` cut to the effects boundary once a path is a byte list —
      it is a fact about paths and not about alternates, and `alternatesIn` is
      only the first place it bit.
- [ ] Decide whether a remark channel is worth having, or whether a reader
      should answer which directories it skipped.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/git/store`](../store/module.f.mjs) — owns where a store looks; this
  issue owns the two lines it looks at differently.
- [byte-paths.md](./byte-paths.md) — owns what a path can spell, and where the
  `NUL` cut belongs once one is a byte list.
- [`fjs/git/store`](../store/module.f.mjs) — `alternatesIn`, and its note on why
  neither is refused; `untilNul` for the shape that was a third.
