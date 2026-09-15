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

So `store` refuses the file instead: `alternatesCode`, `ERR_ALTERNATES_ENCODING`,
naming the path. A repository Git reads is one this cannot, which is a stated
limit rather than a silence — but it is still a limit, and this issue is the
removal of it.

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
- [ ] Remove `alternatesCode` and the refusal `fjs/git/store` raises with it.

### Related

- [object-store.md](./object-store.md) — owns where a store looks; this issue
  owns what it can spell.
- [`fjs/git/store`](../store/module.f.mjs) — `alternatesCode`, the refusal this
  issue removes.
