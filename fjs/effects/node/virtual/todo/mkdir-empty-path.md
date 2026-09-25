## `mkdir('')` makes the root where a host answers `ENOENT`

**Priority:** P4
**Status:** open

### Problem

`parse` collapses `''` and `.` to the same empty segment list, so `mkdirOp`
reads `mkdir('')` as a `mkdir` of the root: `ok` when recursive, `EEXIST` when
not. Measured on node 22.22.2:

| path | `recursive: true` | non-recursive |
| --- | --- | --- |
| `''` | `ENOENT` | `ENOENT` |
| `.` | `ok` | `EEXIST` |

The `.` row is what this runner answers for both.

### Proposal

The same carve-out `statOp` and `exclusive` in [`../module.f.mjs`](../module.f.mjs)
already make: ask `path === ''` before `parse` throws the question away. That
would be the third copy of
`path => path === '' ? state => [state, enoent] : op(path)`, so it should come
with one helper the three share rather than a third spelling.

### Tasks

- [ ] One helper for the empty-path carve-out; `statOp`, `exclusive` and
      `mkdir` use it.
- [ ] Pin both rows of the table above for `mkdir`.
