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

**`\000` is the same road's far end, and is cut in the reader for now.** A path
cannot hold a `NUL` anywhere this runs: Git decodes the escape and the C library
ends the path at it — measured on 2.43.0, `"<donor>/objects\000x"` read the
donor's blob at exit 0 — and Node will not even attempt the call, throwing
`TypeError [ERR_INVALID_ARG_VALUE]`. That asymmetry is why `alternatesIn`'s
`untilNul` ends the path there rather than waiting for this issue: carried
through, the entry produced a channel error whose code is not `ENOENT`, which
`store` reads as corruption and turns into a refusal of the whole read — a
repository Git reads, unreadable. A cut in the reader is the wrong *place* for a
fact about paths, but it was the only place that existed; once a path is a byte
list the cut belongs at the boundary, with the rest of what a path can spell.

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
- [ ] Take the `NUL` cut off `alternatesIn` and give it to the boundary, where
      every path that comes from a file gets it rather than this one.
- [ ] Ask the host which roots it has, rather than reading it off the store's
      own path. `C:/donor/objects` is an absolute path on Windows and a
      directory named `C:` on POSIX, and `alternatesIn` tells them apart by
      whether the object directory holding the file is itself drive-rooted.
      That is the only spelling that settles it: no POSIX absolute path has a
      drive root, since a directory named `C:` at the root spells `/C:/…`.

      Two roots it cannot settle, each a miss and never a wrong object:

      - **`//`.** A UNC share begins with one, and so does a perfectly ordinary
        POSIX path — Linux resolves `//tmp/r` as `/tmp/r`. Measured on Git
        2.43.0, a borrower opened through `//<tmp>/b` read a `C:/donor/objects`
        entry as a name below its own `objects/` and answered the blob at exit
        0, so the ambiguous root is read as the platform that can be measured.
        A Windows store on a share loses a drive-rooted or backslash-led entry
        for it. A revision that read `//` as Windows instead sent such an entry
        to the host unprefixed, where node resolves it against the *process*
        directory — a third place named by nobody, and worse than the miss.
      - **A relative path.** `fjs/git/repo`'s `tryCommonDir` answers one for a
        `.git` beside the caller, and it carries no root at all, so a Windows
        caller's `C:/donor/objects` is joined below the store.

      Asking the host removes the guess and both gaps together.
- [ ] Decide where a remark goes, so an unusable borrowing is reported rather
      than passed over. This is its own question and may want its own issue.

### Related

- [object-store.md](./object-store.md) — owns where a store looks; this issue
  owns what it can spell.
- [alternates-line-quirks.md](./alternates-line-quirks.md) — carries this as one
  of the two lines where that reader and Git look in different directories, and
  the `NUL` as the shape that was a third until it was cut.
- [`fjs/git/store`](../store/module.f.mjs) — `alternatesIn`, which reads such a
  line as an ordinary path.
