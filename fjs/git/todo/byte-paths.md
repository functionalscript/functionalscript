## byte-paths. A path this layer cannot spell is a path it cannot read

**Priority:** P4
**Status:** open

### Problem

Every path in `fjs/effects/node` is a JavaScript string, and every path a
`fjs/git` module builds is one too. A POSIX path is not a string: it is a
sequence of bytes that is not `/` and not `\0`, and nothing requires it to be
valid UTF-8. Git treats a path as bytes throughout and opens whatever it is
given.

Where a path *comes from a file* rather than from a caller, the difference is
reachable. `objects/info/alternates` holds one path per line, as bytes, and
`fjs/git/store` reads that file to find the object directories a repository
borrows from. The decoder does not refuse what is not UTF-8 — `utf8ToString`
answers `ÿ` for a lone `0xFF` rather than failing — so a file naming a
directory in some other encoding would decode to a *different* string, and the
store would look in a directory that is not the one the file names. The objects
that directory holds would be missing with no error, which is the one answer
`fjs/AGENTS.md` does not allow.

`store` does not refuse the file for it. An earlier revision did —
`ERR_ALTERNATES_ENCODING`, naming the path — and that cost more than it caught:
refusing took a repository Git reads and made *all* of it unreadable, the
objects the store holds itself included, to avoid a miss on one borrowing. The
line is an ordinary path now that simply is not found, which is a miss and never
a wrong object, since the id is checked against whatever answers.
[alternates-line-quirks.md](./alternates-line-quirks.md) records it as one of
the two places this reader and Git look in different directories. This issue is
what makes them look in the same one.

**A line can name such a byte while being ASCII itself.** The file's quoting is
C-style, so `"/tmp/\377/objects"` spells the byte `0xFF` in octal and the file
round-trips as UTF-8 perfectly. The escape decodes to one *character* of that
value and the host writes it back as two bytes, so the directory opened is not
the one the file names — the same gap by a second road, and one no check on the
file's bytes can see.

A path that is merely not ASCII is not affected: it is already UTF-8, and the
host writes back the bytes it came from. `\400` and above are not affected
either — they name no byte, so Git calls the unquoting failed and reads the
whole line as a path, quotes included, which is what this does.

**There is nowhere for a warning to go, which is the other half.** Git reports
an unusable alternate — `error: object directory … does not exist; check
.git/objects/info/alternates` — and carries on. `store` carries on too, because
failing the whole read would make a repository Git reads unreadable, but it does
so in silence: the effects have a channel for failure and none for a remark. A
reader that wants to tell its caller "this borrowing was skipped" needs one.

The same gap is under every other path that comes from outside and not from a
caller. `.git` gitfiles, `commondir`, and a `config` naming a directory are each
read as text today.

### Shape

A path becomes a byte list at the effects boundary, as a file's contents already
are:

```ts
type Path = List<number>
```

with the string form kept as the *spelling* a caller writes, converted once.
That is a change to `fjs/effects/node`'s whole surface and to `fjs/path`, so it
is not `fjs/git`'s to make — this issue records why `fjs/git` wants it and what
it refuses until then.

Two smaller shapes are worth measuring first:

- **Only the operations that take a path from a file** take bytes, leaving the
  rest as strings. Smaller, but it splits the vocabulary in two.
- **The string stays and carries the bytes unchanged**, as a WTF-8-style
  round-trippable encoding. No API change; a subtle invariant everywhere.

### Tasks

- [ ] Measure what a non-UTF-8 path costs today: an alternates file naming one,
      a gitfile naming one, against Git on the same repository.
- [ ] Choose among the three shapes above, with the measurement behind it.
- [ ] Carry it through `fjs/effects/node` and `fjs/path`.
- [ ] Make `fjs/git/store` open the directory such a line names, rather than a
      string approximation of it. There is no refusal to remove — the line is
      read as an ordinary path today and simply finds nothing.
- [ ] Ask the host which roots it has, rather than reading it off the store's
      own path. `C:/donor/objects` is an absolute path on Windows and a
      directory named `C:` on POSIX, and `alternatesIn` tells them apart by
      whether the object directory holding the file is itself drive-rooted —
      a signal that is right in every case anyone writes and is still an
      inference rather than an answer.
- [ ] Decide where a remark goes, so an unusable borrowing is reported rather
      than passed over. This is its own question and may want its own issue.

### Related

- [object-store.md](./object-store.md) — owns where a store looks; this issue
  owns what it can spell.
- [alternates-line-quirks.md](./alternates-line-quirks.md) — carries this as one
  of the two lines where that reader and Git look in different directories.
- [`fjs/git/store`](../store/module.f.mjs) — `alternatesIn`, which reads such a
  line as an ordinary path.
