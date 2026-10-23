## Two writers of one repository can lose a commit

**Priority:** P4
**Status:** open

### Problem

`branchCas`'s `write` in [`fjs/cas/git`](../module.f.mjs) reads the
branch ref, builds a commit on top of what it read, and writes the ref
at the new commit through [`fjs/git/refstore/write`](../../../git/refstore/write/module.f.mjs)'s
`tryWrite`. That writer takes Git's `.lock` on the ref's file, so two
writers never corrupt it, but it compares nothing: it writes the id it is
given whatever the file held in between. Two processes writing to the same
repository's branch at once can each read commit `A`, each build a
child of `A`, and the second ref write replaces the first's commit, whose
addition is then on no branch.

Nothing is lost from the object store — the first blob and its trees are
there — but the branch does not name them. The sequential uses this
backend was built for, a CI job and a person at the CLI, never run two
writers against one repository; two writers in two repositories each have
their own branch, and `git merge` joins them.

### Proposal

The fix is Git's: `update-ref <ref> <new> <old>`, a compare-and-swap that
refuses where the ref no longer holds `<old>`. `tryWrite` would take the
expected id and refuse, under its lock, where the file holds another, and
`write` here would re-read the branch and rebuild its tree on the new
head.

### Tasks

- [ ] `tryWrite` with an expected old id, refused under the lock where the
      ref holds another — measured against `git update-ref` with three
      arguments.
- [ ] `write` retries on that refusal: the branch's head and tree read
      again, the blob placed again, the commit built on the new head.
- [ ] A proof with two writers interleaved over one repository, each of
      whose additions is on the branch at the end.

### Related

- [`fjs/git/refstore/write`](../../../git/refstore/write/module.f.mjs) —
  the writer that would compare.
