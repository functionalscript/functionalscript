## A trailing separator is discarded, so a file is created where a host refuses

**Priority:** P3
**Status:** open

### Problem

Every operation here resolves its path with `parse`
([`fjs/path`](../../../../path/module.f.mjs)), which drops the empty segment a
trailing separator leaves. A host does not: a trailing separator *requires* the
final component to be a directory, and an open for writing of a directory is
`EISDIR`.

Measured, node 22.22.2 against this runner, with `writeExclusive` — the same
`parse` result reaches `createExclusive`, `writeFile`, `readFile`, `stat`, `rm`
and the rest, so the row is the operation's only in that one answers:

| path | `parse` gives | node `open(p, 'wx')` | here |
| --- | --- | --- | --- |
| `'x/'`, `x` absent | `['x']` | `EISDIR`, nothing created | **`ok`, and `x` is now a regular file** |
| `'q//'`, `q` absent | `['q']` | `EISDIR` | **`ok`, a regular file** |
| `'./r/'`, `r` absent | `['r']` | `EISDIR` | **`ok`, a regular file** |
| `'adir/'`, a directory | `['adir']` | `EISDIR` | `EEXIST` |
| `'afile/'`, a file | `['afile']` | `EISDIR` | `EEXIST` |
| `'missing/x/'` | `['missing','x']` | **`ENOENT`** — resolution fails first | `invalid path` |
| `'adir/.'`, a directory | `['adir']` | `EEXIST` — `.` is a component, not a separator | `EEXIST` |

The first three rows are the ones that matter: this runner **creates a file where
a host creates nothing**, so a proof can reach a state production cannot produce.
The middle rows are a wrong code for a state that is refused either way, and the
last two are already right — including `'adir/.'`, which is why the rule is not
"the string ends with a separator or a dot".

Found by review of
[#2115](https://github.com/functionalscript/functionalscript/pull/2115), against
`writeExclusive`. It predates that PR: `parse` has always discarded the segment,
and the exclusive creates only made it visible by being the operations under
review.

### Proposal

Preserve the requirement through resolution rather than refusing per operation,
in `operation`'s wrapper where the walk already happens: remember that the path
ended in a separator, and answer `EISDIR` where the resolved name is reached and
the operation wants a file.

**A per-operation `path.endsWith('/')` guard would be wrong, not merely narrow.**
It answers `EISDIR` for `'missing/x/'`, where a host answers `ENOENT` because
resolution fails before the trailing separator is consulted — so the guard has to
sit *after* the walk, which is `operation`'s job and no single operation's. It
would also have to know the platform's separators rather than just `/`.

This is the third normalization `parse` performs that a host does not, and the
three want settling together rather than one at a time:
[lexical-path-resolution](./lexical-path-resolution.md) is `..` collapsing
lexically, [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) is
which code a path that cannot be served answers, and this is the trailing
separator. All three are decided by *where* the walk happens.

### Tasks

- [ ] Carry "must be a directory" out of the path and into the descent, so a
      trailing separator survives `parse`.
- [ ] Answer `EISDIR` for a write to such a path, and pin every row of the table
      above — the `'missing/x/'` and `'adir/.'` rows included, since they are the
      ones a guess gets wrong.
- [ ] Decide it together with the two sibling issues, or at least in an order
      that does not contradict them.

### Related

- [lexical-path-resolution](./lexical-path-resolution.md) — `..` collapsing
  lexically, the same text-versus-walk gap, and the one whose proposal already
  moves resolution into the descent. This issue rides on that change.
- [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) — which code
  an unservable path answers, the third of the three.
- [`fjs/path`](../../../../path/module.f.mjs) — `parse`, which is lexical by
  design and should stay that way; this is about what a file system may ask of it.
