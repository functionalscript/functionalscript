## Git stops a positional parse at the first line it will not use; this refuses the object

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
reads a whole payload before anything positional happens, so every line
before the message has to be a header or a continuation of one. Git's
`parse_commit_buffer` reads no such thing: it walks the bytes,

    if (memcmp(bufptr, "tree ", 5)) return error("bogus commit object");
    if (get_oid_hex(bufptr + 5, &parent) < 0) return error("bad tree pointer");
    bufptr += tree_entry_len + 1;
    while (!memcmp(bufptr, "parent ", 7)) { ... }

and the first line that is not `parent ` simply ends the walk — whatever
that line is. Git never looks at it, where this has to read it before the
positional pass can begin. Two shapes of line show it, and they fail here
for two different reasons.

A line that is no header at all, `BROKEN`, has no `SP` to cut a name from,
so the payload does not read and `tryTreeAt` refuses the commit. A
continuation line, ` junk`, does read — as a continuation, which is what
the format says a leading `SP` is — and folds into the value of the header
before it, so the `tree` value is no longer an id and `tryTreeAt` refuses
the commit for that reason instead. In

    tree <id>
    BROKEN
    author …

and in

    tree <id>
     junk
    author …

Git reads the tree, finds no `parent ` after it and peels the commit. Both
are refused here. Measured on Git 2.43.0 with `git hash-object --literally`
and `git cat-file -t <id>^{tree}`.

`fjs/git/tag` parts from Git the same way, on the first of those two
shapes. `parse_tag_buffer` reads `object`, `type` and `tag` by position and
stops, so bytes after the third header are never looked at:

    object <id>
    type blob
    tag t
    BROKEN

peels to the blob, as it does with `BROKEN` after a `tagger` line and with
`BROKEN` before the blank line that starts a message. `tryTargetAt` refuses
all three, because the payload does not read. Only `BROKEN` *before* the
`tag` line is a refusal both agree on — there Git wants `tag ` at that
position and does not find it. The continuation shape is the one a tag
does agree about: a continuation after `object` or `type` makes the value
no id and no type, which both refuse.

This is an over-refusal and only that: objects Git reads that this does
not. It accepts nothing Git refuses, which is why it is recorded rather
than rushed.

The parents part the same way, and only the same way. An ordinary header
between two `parent` lines is no mismatch: `parentValues` finds the first
header that is not `parent` and slices the run before it, which is where
Git's loop stops too.

### Proposal

Stop reading where Git stops reading, rather than reading the whole payload
first and then indexing what came out of it. Two ways:

- Read the front of an object from the bytes — for a commit, `tree `, an
  id, LF, then `parent ` lines while they follow; for a tag, the three
  headers Git takes by position — and take the header list only from where
  that walk stopped. Positional access above it is unchanged; what changes
  is that a line Git would not use ends the walk instead of having to parse.
- Or keep one reader and give it a mode that stops at the first line it
  cannot read as a header, handing back the prefix it managed. Cheaper, and
  it serves both objects, but a continuation still folds before the caller
  sees it, so the commit side would still need the stopping rule for that
  shape.

Either way the proof wants the three shapes this cannot express today: a
non-header line after `tree`, a continuation after `tree`, and a non-header
line after a tag's `tag` header — each checked against `git cat-file -t` on
a repository the proof builds. A header between two `parent` lines is not
one of them — that already agrees, and a proof asking for it would invite
someone to change behaviour that is right.

### Related

- [`fjs/git/header`](../header/module.f.mjs) — the shared reader, and why
  it is generic.
- [`fjs/git/commit`](../commit/module.f.mjs) — the positional reads this
  would put a stopping rule under.
- [`fjs/git/tag`](../tag/module.f.mjs) — the other positional reader, and
  the one whose three headers Git stops after.
- [object-store.md](./object-store.md) — the walk that peels a commit, and
  the reason it parses one at all.
