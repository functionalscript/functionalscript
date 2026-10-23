## `fjs cas git` does not search the parents of the current directory

**Priority:** P4
**Status:** open

### Problem

`fjs cas git add`, `get` and `list` in [`fjs/cas/git/cli`](../module.f.mjs)
take the repository at the current directory: its `.git`, or the directory
itself where its `config` is one Git opens. `git` searches upward from the
current directory to the first `.git`, stopping at the filesystem root or
`GIT_CEILING_DIRECTORIES`, so `git log` works from any subdirectory of a
worktree where these commands refuse with `ERR_NO_REPOSITORY`.

### Proposal

Walk `..` upward with `tryCommonDir` until a repository is found or the
directory does not change — which needs the current directory as an
absolute path, since `..` of a relative path never ends, and the effect
system has no operation that answers it. Adding one is a `fjs/effects/node`
change with a virtual-filesystem counterpart; the walk itself is a
`foldStep` over the path's prefixes once the path is absolute.

### Tasks

- [ ] An operation answering the current directory as an absolute path, in
      the virtual filesystem too.
- [ ] `branchOf` walks the path's prefixes from the longest with
      `tryCommonDir`, taking the first repository.
