## Store CAS content in a Git branch

**Priority:** P3
**Status:** wip

### Problem

CAS currently stores content in the filesystem. Its CLI constructs
`fileCas(sha256)(home)` for `add`, `get`, and `list`. A consumer such as
the [build cache](../../ci/todo/097-smart-ca-ci.md) needs to keep CAS
content in a separate Git branch while the source checkout stays on its
current branch, so that the content travels with the repository: `git push`
and `git fetch` carry it, and `git merge` joins what two writers added.

### Proposal

A Git branch backend for CAS with the three commands the filesystem CAS
has, against a local branch, and nothing else:

```sh
fjs cas git add <branch> <file>
fjs cas git get <branch> <key> <path>
fjs cas git list <branch>
```

The repository is the one the current directory is in, found as `git`
finds it. The branch's tree is a map from canonical CAS paths —
`.cas/ab/cd/<rest>`, the layout [`toPath`](../module.f.mjs) spells — to the
content, each entry a regular, non-executable file (`100644`). `get` and
`list` read the commit the branch is at. `add` writes the blob and the
trees above it into the repository's own objects and moves the branch to
one new commit whose parent is the commit it was at — and writes no object
and no commit where the branch already holds the content under its key.
The source checkout's `HEAD`, index and working tree are never touched:
the writes are below `objects/` and at `refs/heads/<branch>`.

Content keys stay CAS's hashes, SHA-256 over the payload as the CLI keys
content today; Git object ids are internal to the backend. `contentKey`
computes a key without storing anything, with the hash `write` uses, and
agrees with the key `write` returns for the same bytes.

Everything between repositories is Git's own and needs nothing here:
`git push` and `git fetch` move the branch; `git merge` joins two writers'
branches, and since different keys are different paths and the same key is
the same bytes, independent additions never conflict; a deletion commit, or
`git rm` on a checkout of the branch, takes content out. The backend syncs
nothing, publishes nothing and retries nothing.

### Tasks

- [x] Provide content-key computation without storage, sharing CAS's
      configured hash implementation. Prove agreement with the key returned
      by `write` for the same bytes — `contentKey` in
      [`fjs/cas`](../module.f.mjs).
- [x] Read a branch as a CAS: `Branch` names the repository and the branch,
      `branchRef` is the ref read, and `snapshot` is the commit it names as
      a `CasReader`, the read half of `Cas<O>`, byte-preserving over the
      existing encoding, paths and Git primitives, in SHA-1 and SHA-256
      repositories — [`fjs/cas/git`](../git/module.f.mjs).
- [x] Write to a branch: `branchCas` is the whole `Cas<O>`, whose `write`
      stores the blob and the rebuilt trees as loose objects and moves the
      branch to one new commit, or writes nothing where the key is already
      there, by the author `configuredAuthor` reads as `git commit` does.
      The proof compares the filesystem to show the source checkout's
      `HEAD`, working tree and index unchanged —
      [`fjs/cas/git`](../git/module.f.mjs).
- [ ] Add the three CLI commands over the same backend, the repository found
      from the current directory, and document them. Prove CLI and API
      behavior agree without a second implementation.

### Related

- [Build cache](../../ci/todo/097-smart-ca-ci.md) — consumes branch CAS to
  remember successful build contracts and input sets.
- [CAS](../README.md) and [CAS CLI](../cli/module.f.mjs) — existing storage
  and command behavior to reuse.
- [Command architecture](./command-architecture.md) — shared operation
  declarations and transport boundaries.
- [Git](../../git/README.md) — repository and object primitives.
