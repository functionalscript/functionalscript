## Rename `fjs/fsc` to `fjs/compiler`

**Priority:** P3
**Status:** open

### Problem

FunctionalScript is abbreviated **FJS**, no longer FS
([fjs-abbreviation](../../todo/fjs-abbreviation.md)). `fjs/fsc` — "FS
compiler" — is named after the old abbreviation.

Renaming it to `fjs/fjsc` would fix the abbreviation but repeat the prefix:
the package path already starts with `fjs/`, so `fjs/fjsc/parser` says it
twice. And an abbreviation of the brand ties the directory to the brand, which
is how this one came to need renaming at all. Its siblings abbreviate too
(`cli`, `ebnf`, `js`, `mcp`, `rtti`), but what they abbreviate is the
subject, a term a reader already knows, not the project's name.

### Proposal

Rename the directory to `fjs/compiler`. It is what the module's README already
calls itself ("FunctionalScript Compiler"), it names the thing behind
`fjs compile`, and it does not need renaming again when a brand changes.

Where prose names the compiler as a tool — "FSC should support `#` comments",
"the FSC function serializer" — write "the compiler", or `fjs compile` when the
command is meant, rather than coining "FJSC".

Directory paths are the public API (there is no `exports` map, see
[group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)),
so this is a breaking change: the pull request declares it in a `Changelog:`
section with a `**BREAKING CHANGES:**` item and updates every importer.

### Tasks

- [ ] `git mv fjs/fsc fjs/compiler`.
- [ ] Update every import, link and path that names `fjs/fsc` or a relative
      `../fsc/` — about a hundred files outside the directory, among them the
      root `README.md`'s CLI table, `todo/README.md`, `CONTRIBUTING.md`'s
      `fsc/tokenizer` topic example, `fjs/ebnf`'s README, and a comment in
      `nanvm-lib`'s `to_json.rs`.
- [ ] Rename the issue files named after it —
      `fjs/fsc/todo/047-fsc-meta-programming.md`, `070-fsc-flags.md`,
      `083-fsc-hash-comments.md` — to `…-compiler-…`, and fix their links.
- [ ] Replace every whole-word "FSC" in the tree with "the compiler", found by
      searching rather than from this list, which is only where it was when
      this issue was filed: the moved issue files, including
      `lint-compiler-compatible-files.md`, whose heading and body name FSC,
      and `fjs/edag/todo/entry.md`,
      `fjs/emergent_testing/todo/imports-promises-realms.md`,
      `spec/README.md`, `spec/todo/serialization.md` and
      `todo/fjs-javascript-compatibility.md`.
- [ ] Run `npm run gen` so generated outputs (website pages, CI) follow the
      move; run the full check set.
- [ ] Leave historical `changelog/*.md` entries as they are: they record what
      shipped under the old name.

### Related

- [fjs-abbreviation](../../todo/fjs-abbreviation.md) — the rebrand this
  rename belongs to.
- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — why a directory move is a breaking change.
