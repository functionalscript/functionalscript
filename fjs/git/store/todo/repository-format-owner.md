## The repository-format reader lives in `store`, which never calls it

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/store`](../module.f.mjs) is, by its own header, "from an id to the
object it names, checked": `objectsDirs`, `readIn`, `tryRead`, `objectPath`.
About a third of the module is something else — the policy Git applies to
`core.repositoryformatversion` and `extensions.*`: the tables `v0Extensions`,
`v1OnlyExtensions`, `knownExtensions` and `booleanExtensions`, `noVersion`,
the subsection rule in `extensionAt`, `extensionValuesRead`, and the five
version rules in `tryOidBytes`, which `oidBytes` runs over the `config` file.

None of the object readers call any of it. The format rules call one
another — `oidBytes` runs `widthOf`, which composes `tryEntries` with
`tryOidBytes` — and nothing else in the module calls them: every reader of
an object takes the width as a parameter, `readIn(ods, oidBytes)`,
`tryRead(dir, oidBytes)`, so the format reader is exported for callers and
read by nothing the module is for. It is also the only reason `store` imports
[`fjs/git/config`](../../config/module.f.mjs), and `store` is the only
importer of `config` in the tree. The neighbours already describe it as if it
lived elsewhere: `config`'s header says the format and the width it names are
"`fjs/git/store`'s `tryOidBytes`", and `repo`'s `tryCommonDir` says whether a
repository is there "is what reading `config` at [the answer] says, and that
is `fjs/git/store`'s `oidBytes`". A reader of `store` meets two subjects, and
a reader looking for the format rules has no module named for them.

### Proposal

Move `tryOidBytes`, `oidBytes` and the tables they read into a module of their
own, `fjs/git/format`: the repository format a `config` declares — the
version, the extensions Git 2.43 knows, and the id width that follows. `store`
then imports nothing from `config`; `config` and `repo` point at `format`
where they now point at `store`.
[git-sha1-collisions](../../../../todo/git-sha1-collisions.md) expects
`extensions.compatObjectFormat` to be read one day, and it lands in `format`
rather than growing `store` further.

An alternative is [`fjs/git/repo`](../../repo/module.f.mjs), whose subject is
already "from a worktree to the repository directory" and which is the step a
caller takes just before asking the width. A module of its own keeps `repo` to
paths and leaves the format rules findable by name; that is the preference
here, and the choice is the owner's.

### Tasks

- [ ] Create `fjs/git/format` with `tryOidBytes`, `oidBytes` and the extension
      tables, moved from `store` with their proof cases.
- [ ] Update the importers and the doc references in `config`, `repo` and
      `store`.
- [ ] `store` no longer imports `config`.

### Related

- [`fjs/git/config`](../../config/module.f.mjs) — the file reader `format`
  runs over.
- [`fjs/git/repo`](../../repo/module.f.mjs) — `tryCommonDir`, the step before
  the width.
- [git-sha1-collisions](../../../../todo/git-sha1-collisions.md) —
  `compatObjectFormat`, a future reader of the same section.
