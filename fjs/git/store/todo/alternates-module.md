## alternates-module. The `alternates` decoder is a module living inside the object store

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs)'s subject is "from an id to the object
it names, checked" — `tryRead`, `storeOf`, `objectsDirs` and the search
under them. About a quarter of the file is instead a pure decoder for
`objects/info/alternates`: `untilNul`, `alternateLine`, `escapes`,
`isOctal`, `octalAt`, `unquoted`, the rooted-entry test (`isAbsolute`,
`isDrive`, `isWindows`), and the one export they serve, `alternatesIn`.
`unquoted` is a C-style unquoter with its own escape table and its own
octal reader; `fjs/git/config` carries the sibling table for Git's other
C-style unquoter. The two sets legitimately differ, which is not a DRY
finding but evidence that "decode a Git-quoted string" recurs and has no
module, and that in `store`'s case it sits between `objectsDir` and the
hash check.

Both of this file's issues, [alternates-line-quirks](../../todo/alternates-line-quirks.md)
and [byte-paths](../../todo/byte-paths.md), are about the decoder alone;
each points at a region of a file rather than at a module.

### Proposal

`fjs/git/alternates/module.f.mjs` with `alternatesIn` as its one export and
the decoder private to it, its rooted-entry test built on `fjs/path`'s
exported predicates per [export-drive-predicates](../../../path/todo/export-drive-predicates.md).
`store` imports one function and keeps the path builders and the search.
The decoder's proof then runs line shape by line shape against the
measurement table already in its doc, with no filesystem.

### Tasks

- [ ] `fjs/git/alternates/` with proof at 100%; `store` imports
      `alternatesIn`.
- [ ] Re-point `alternates-line-quirks.md` and `byte-paths.md` at the new
      module.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../todo/alternates-line-quirks.md`](../../todo/alternates-line-quirks.md) —
  what the decoder answers; entirely about the code this moves.
- [`../../../path/todo/export-drive-predicates.md`](../../../path/todo/export-drive-predicates.md) —
  the rooted-entry test's owner.
