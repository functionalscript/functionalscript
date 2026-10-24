## The branch ref is written without compare or dereference

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

The same writer dereferences nothing either, as `update-ref --no-deref`
does not. A `refs/heads/<branch>` that is a symbolic ref — one
`git symbolic-ref` made, pointing at another branch — is read through to
its target's commit, which the new commit is built on, and then written
over as a direct ref at that commit: the target branch does not move, and
the symbolic ref has become a direct one. `git update-ref` without
`--no-deref` would move the target instead. A symbolic ref under
`refs/heads` is rare and nothing this backend makes, so it is recorded
here rather than detected: telling one from a direct ref is a read of the
ref file the writer does not make today.

### Proposal

The fix is Git's: `update-ref <ref> <new> <old>`, a compare-and-swap that
refuses where the ref no longer holds `<old>`, and that moves a symbolic
ref's target unless told `--no-deref`. `tryWrite` would take the expected
id and refuse, under its lock, where the file holds another, and follow a
symbolic ref to the file it names, as `tryResolve` already follows it to
the id; `write` here would re-read the branch and rebuild its tree on the
new head.

### Tasks

- [ ] `tryWrite` with an expected old id, refused under the lock where the
      ref holds another — measured against `git update-ref` with three
      arguments.
- [ ] `write` retries on that refusal: the branch's head and tree read
      again, the blob placed again, the commit built on the new head.
- [ ] A proof with two writers interleaved over one repository, each of
      whose additions is on the branch at the end.
- [ ] `tryWrite` moves a symbolic ref's target rather than replacing the
      ref, or `branchCas` refuses a symbolic branch — measured against
      `git update-ref` on a `refs/heads/<branch>` that `git symbolic-ref`
      made.

### Related

- [`fjs/git/refstore/write`](../../../git/refstore/write/module.f.mjs) —
  the writer that would compare.
