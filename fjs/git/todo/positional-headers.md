## A continuation line ends Git's commit parse, and folds into a value here

**Priority:** P4
**Status:** open

### Problem

[`fjs/git/commit`](../commit/module.f.mjs) already reads a commit by
position, as Git does: `tree` at index 0, then as many `parent` headers as
follow it in a row, then `author` and `committer` at the indices those
parents put them at. The three fields Git looks up by name — `encoding`,
`gpgsig`, `mergetag` — are the only ones read by name here. That is not
where the two readings part.

They part in the pass below it. [`fjs/git/header`](../header/module.f.mjs)
reads a line beginning with SP as a continuation and folds it into the
value of the header before it, which is what the format says a
continuation is. Git's `parse_commit_buffer` does not fold: it walks the
bytes,

    if (memcmp(bufptr, "tree ", 5)) return error("bogus commit object");
    if (get_oid_hex(bufptr + 5, &parent) < 0) return error("bad tree pointer");
    bufptr += tree_entry_len + 1;
    while (!memcmp(bufptr, "parent ", 7)) { ... }

and a line that is not `parent ` simply ends the walk. A continuation line
is one of those, so Git stops there and never looks at it, where this folds
it into the header above and changes that header's value.

One shape shows it. In

    tree <id>
     junk
    author …

Git reads the tree, finds no `parent ` after it and peels the commit. Here
the ` junk` line becomes part of the `tree` header's value, so the value is
no longer an id and `tryTreeAt` refuses the commit. Measured on Git 2.43.0
with `git hash-object --literally` and `git cat-file -t <tag>^{}`.

This is an over-refusal and only that: an object Git reads that this does
not. It accepts nothing Git refuses, which is why it is recorded rather
than rushed.

The parents part the same way and further. Git's loop stops at the first
line that is not `parent `, so a commit whose parent lines are interrupted
— by a continuation, or by any other header — has, to Git, only the parents
before the interruption, and whatever stands after them is never read as a
parent at all. `tryTreeAt` checks every `parent` header in the list, so it
refuses ids Git never looks at.

### Proposal

Stop the commit's positional reads at the first line Git would stop at,
rather than at the first header the folding produced. Two ways:

- Read the front of a commit from the bytes — `tree `, an id, LF, then
  `parent ` lines while they follow — and take the header list only from
  where that walk stopped. Positional access above it is unchanged; what
  changes is that a continuation ends the walk instead of joining the value
  before it.
- Or keep one reader and have the commit side look at the first line of a
  `tree` or `parent` value and treat a header whose value has more lines as
  the end of the parent run. Cheaper, but it models Git's stopping rule
  indirectly and the rule is easy to get wrong twice.

`fjs/git/tag` needs none of this. Git's `parse_tag_buffer` reads the first
three headers by position and this matches it already, and a continuation
after `object` or `type` makes the value no id and no type, which is a
refusal both agree on.

Either way the proof wants the shapes this cannot express today: a
continuation after `tree`, a continuation between two `parent` lines, and
a header between two `parent` lines, each checked against
`git cat-file -t <id>^{}` on a repository the proof builds.

### Related

- [`fjs/git/header`](../header/module.f.mjs) — the shared reader, and why
  it is generic.
- [`fjs/git/commit`](../commit/module.f.mjs) — the positional reads this
  would put a stopping rule under.
- [object-store.md](./object-store.md) — the walk that peels a commit, and
  the reason it parses one at all.
