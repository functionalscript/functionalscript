## Refs: `HEAD`, `refs/`, and `packed-refs`

**Priority:** P3
**Status:** open

### Problem

An object is reached by id, and a repository is entered by name: `HEAD`,
a branch, a tag. Nothing here reads a ref, so the readers can be handed an
id and cannot find one. [git-name-resolution](../../../todo/git-name-resolution.md)
starts from a name.

### Proposal

Three files, all text, all delimiter-framed and so grammars over the byte
alphabet like the objects:

- `HEAD`, and any symbolic ref: `ref: <name> LF`, or a bare hex id.
- `refs/<name>`: a hex id and LF, one file per loose ref.
- `packed-refs`: an optional `# pack-refs with:` header line, then
  `<hex> SP <name> LF` per ref, a `^<hex>` line after a tag naming what it
  points to.

A `resolve(name)` that reads the loose file, falls back to `packed-refs`,
and follows a symbolic ref to a bounded depth, answering the id or refusing:
a name that is no ref name is refused by the rules
[`fjs/git/tag`](../tag/module.f.mjs) already holds for a tag's name, which
move to a shared place then. Reading is through `readFile` and `readdir`;
writing a ref, with the lock file Git takes, is a later task.

### Tasks

- [ ] Grammars for the three files, and their readers.
- [ ] The ref-name rules shared with the tag module.
- [ ] `resolve`, over the effects, with the virtual filesystem as its proof.

### Related

- [`fjs/git/README.md`](../README.md) — the objects a ref names.
- [object-store.md](./object-store.md) — from an id to the object.
