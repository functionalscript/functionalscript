# Git objects

Readers and writers for Git's objects — `blob`, `tree`, `commit`, `tag` —
as typed values over bytes, built on the EBNF front end over the byte
alphabet ([`fjs/ebnf/byte`](../ebnf/byte/README.md)). The design, and the
record of what a grammar can and cannot do for the formats, is
[`todo/git-objects.md`](../../todo/git-objects.md); the pieces shipped so
far are below, and the rest of that issue's task list is what is still to
come.

- [`object/`](object/module.f.mjs) — the loose object envelope,
  `<type> SP <size> NUL`: a grammar up to the NUL, a reader that slices the
  payload and holds it to the size, and a writer.
- [`header/`](header/module.f.mjs) — the header block a commit and a tag
  share, and the message after it: a generic grammar over `key SP value LF`
  lines with continuation, a reader to a header list, and a writer that
  returns the block byte for byte.
- [`ident/`](ident/module.f.mjs) — an `author`, `committer` or `tagger`
  value, `name SP <email> SP time SP tz`, read as a second pass over the
  bytes a header holds: a `try*` reader that refuses what the grammar does
  not cover, and a writer.
- [`tree/`](tree/module.f.mjs) — a tree's entries, `mode SP name NUL id`,
  for a repository's id width: a reader that reads what `git fsck` would
  flag, a `validate` that refuses it the way `fsck` does, `mode` as the
  number an entry's digits spell, and a writer.
- [`commit/`](commit/module.f.mjs) — a commit as a second pass over the
  header block: `tree`, `parent`, `author` and `committer` by position,
  `encoding`, `gpgsig` and `mergetag` by key, the last read as a tag by
  the tag module, and a `validate` that refuses what `git fsck` does.
- [`oid/`](oid/module.f.mjs) — an object id between its two spellings, the
  raw bytes a tree entry holds and the hex text a header holds.
- [`tag/`](tag/module.f.mjs) — a tag as a second pass over the header
  block: `object`, `type`, `tag` and `tagger` as functions over the header
  list, read by position as Git reads them, and a `validate` that refuses
  what `git fsck` does.
- `types.ts` — `Bytes`, the type of a field the format leaves unbounded,
  `Oid` and `OidBytes`, the one fixed-width field and its width, and
  `ObjectType`.

What is not here, by design: inflating a loose object (a host effect at
the boundary until a FunctionalScript inflater exists), SHA-1, packfiles.
