## alternates-line-quirks. Three alternates lines this reader does not follow Git on

**Priority:** P4
**Status:** open

### Problem

`fjs/git/store` reads `objects/info/alternates` as Git does, measured line shape
by line shape — with three exceptions, each a place the file names a directory
this reader does not look in. All three are **misses and never wrong answers**:
what comes back from any directory is hashed against the id asked for, so a
divergence here can only fail to find an object, never hand back a different
one.

None is refused. An earlier revision refused the whole file for two of them, and
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

**3. A NUL in the middle of a quoted path.** Git's documentation lists neither
this shape nor its outcome. Measured on Git 2.43.0, a line of

```
"/nxroot\000x"
```

made Git report `error: object directory /nxroot does not exist` — it decodes
the escape to a `NUL` byte, then hands the result to the C library, where the
path *ends* there and the `x` is never seen. This reader keeps the `\u0000` as
an ordinary character of the string, so it looks for a directory named
`/nxroot\u0000x` and misses where Git would have looked in `/nxroot/`.

Truncating at the NUL here would agree with Git on this line, and it would still
be the same class of problem as 2: it is a fact about C strings, not about
alternates, and the boundary that knows a path is bytes is the place to decide
what a `NUL` in one means. It is listed here so the divergence is written down,
and owned by [byte-paths.md](./byte-paths.md).

### What an investigation would settle

- Whether the suffix is worth following at all, given that only a hand-written
  line produces one, and whether Git's off-by-one is a bug worth reporting
  upstream rather than reproducing.
- Whether a path that cannot survive the trip to the host — one holding a `NUL`,
  or a byte no decoder round-trips — is better answered as a miss, as here, or
  named as a line that was skipped.
- Whether a reader wants somewhere to *report* a line it did not follow. Git
  prints `error: object directory … does not exist; check
  .git/objects/info/alternates` and carries on; the effects here have a channel
  for failure and none for a remark, so this carries on silently. That question
  is bigger than alternates and is noted in [byte-paths.md](./byte-paths.md)
  too.

### Tasks

- [ ] Measure how Git's `unquote_c_style` advances past the closing quote, and
      decide whether the second entry is intended.
- [ ] Decide where a `NUL` in a decoded path is answered — at the escape, or at
      the effects boundary that knows a path is bytes.
- [ ] Decide whether a remark channel is worth having, or whether a reader
      should answer which directories it skipped.
- [ ] `tsc`, `fjs test`.

### Related

- [object-store.md](./object-store.md) — owns where a store looks; this issue
  owns the three lines it looks at differently.
- [byte-paths.md](./byte-paths.md) — owns what a path can spell, the `NUL`
  included.
- [`fjs/git/store`](../store/module.f.mjs) — `alternatesIn`, and its note on why
  none of the three is refused.
