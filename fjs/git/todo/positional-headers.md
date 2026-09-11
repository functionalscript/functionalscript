## A commit's headers are read by position, not by name

**Priority:** P4
**Status:** open

### Problem

[`fjs/git/header`](../header/module.f.mjs) reads the block a commit and a
tag share as a list of `key SP value LF` headers, a line beginning with SP
continuing the value before it, and
[`fjs/git/commit`](../commit/module.f.mjs) then looks the keys up in that
list. Git does not read a commit that way. `parse_commit_buffer` walks the
bytes:

    if (memcmp(bufptr, "tree ", 5)) return error("bogus commit object");
    if (get_oid_hex(bufptr + 5, &parent) < 0) return error("bad tree pointer");
    bufptr += tree_entry_len + 1;
    while (!memcmp(bufptr, "parent ", 7)) { ... }

so it takes exactly one `tree` line at the front, then as many `parent`
lines as follow it *immediately*, and stops at the first line that is
neither. A continuation line is one of those. It is not skipped or folded;
the walk simply ends there and the rest of the object is the commit's
message as far as the parse is concerned.

The two readings part on one shape. In

    tree <id>
     junk
    author …

Git reads the tree, finds no `parent ` after it, and peels the commit;
this folds ` junk` into the `tree` header's value, so the value is no
longer an id and the commit is refused. Measured on Git 2.43.0 with
`git hash-object --literally` and `git cat-file -t <tag>^{}`: the
continuation form peels to `commit`, where `tree <id>X` on one line is
`bogus commit object` to Git and is refused here too.

So this is an over-refusal and only that: an object Git reads that this
does not. It refuses nothing Git accepts in the other direction, which is
why it is recorded rather than rushed.

Parents part the same way and further. Git's loop stops at the first line
that is not `parent `, so a commit whose parent lines are interrupted —
by a continuation, or by any other header — has, to Git, only the parents
before the interruption, and whatever stands after them is never read as a
parent at all. `tryTreeAt` validates every `parent` header in the list,
so it refuses ids Git never looks at.

### Proposal

Read a commit positionally, as Git does, rather than by name out of the
shared list. Two ways, and the first is probably right:

- Give [`fjs/git/commit`](../commit/module.f.mjs) its own reader over the
  bytes — `tree ` then an id then LF, then `parent ` lines while they
  follow — and leave `fjs/git/header` to the tag, whose parse Git really
  does do by position over the first three headers and which the current
  reader already matches. The commit reader would still hand back the
  header list for everything after the parents, since `author`,
  `committer` and the rest are read by name.
- Or keep one reader and teach the commit side to look only at the first
  line of a `tree` or `parent` value and to stop at the first header that
  is neither. That is cheaper but models Git's walk indirectly, and the
  "stop at the first interruption" rule is easy to get wrong twice.

Either way the proof wants the shapes this cannot express today: a
continuation after `tree`, a continuation between two `parent` lines, and
a header between two `parent` lines, each checked against
`git cat-file -t <id>^{}` on a repository the proof builds.

### Related

- [`fjs/git/header`](../header/module.f.mjs) — the shared reader, and why
  it is generic.
- [object-store.md](./object-store.md) — the walk that peels a commit, and
  the reason it parses one at all.
