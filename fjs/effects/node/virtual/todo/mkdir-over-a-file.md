## A recursive `mkdir` replaces a file with a directory instead of failing

**Priority:** P3
**Status:** open

### Problem

`mkdirOp` in [`../module.f.mjs`](../module.f.mjs) builds the remaining path as
nested empty directories and spreads them into the directory it was handed. When
the first remaining segment is a **file**, the spread overwrites it — the file's
bytes are gone and the operation answers `ok`.

Measured, with the host beside it:

| `refs/heads/a` is… | `mkdir('refs/heads/a/b', { recursive: true })` here | node 22.22.2 on Linux |
| --- | --- | --- |
| absent | `ok`, both directories created | `ok`, both created |
| a directory | `ok`, nothing changed | `ok`, nothing changed |
| **a file** | **`ok`, and `a` is now an empty directory** | **`ENOTDIR`** |

The first two rows agree, which is what makes the third easy to miss: every
ordinary use of the operation behaves, and the divergence appears only where a
caller is relying on the failure.

This is not the same shape as
[reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md), and it is
worse. There, a read answers the wrong *code* for a path it cannot serve, and
the file is untouched. Here a write **succeeds where a host refuses** and takes
the file with it, so a proof built on this runner does not merely miss a branch —
it watches a destructive operation and calls it correct.

### Who notices

[`fjs/git/refstore`](../../../../git/refstore/module.f.mjs)'s `tryWrite` is the
caller today. It refuses a *packed* ref name that is a directory prefix of the
name being written (`refPrefixCode`), and its doc says the two **loose**
directions need no check of their own because the filesystem is the check: a
loose file where the parent directory must go makes the `mkdir` answer `ENOTDIR`,
and a directory where the ref's file must go makes the `rename` answer `EISDIR`.

Half of that is provable here and half is not. The `rename` direction is
modelled — `insertEntityAt` refuses to overwrite a directory with a file — and
`writeGivesTheLockBack` pins it. The `mkdir` direction is this issue: a proof of
it against this runner would show `tryWrite` **deleting the ref
`refs/heads/a`** and answering success, which is the opposite of what a host
does and of what the doc claims. So the claim rests on the node measurement
alone, with no fixture behind it, and that is recorded here rather than left as
a proof that passes for the wrong reason.

### Proposal

Answer `ENOTDIR` where a remaining segment names something that is not a
directory, and create nothing. The check has to come **before** anything is
spread, and it has the guard-ordering hazard
[reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) sets out at
length: `operation` hands the op the full remaining path both when the first
name is absent and when it exists and is not a directory, so a length test alone
would answer `ENOTDIR` for the absent case, where a host says `ok` for a
recursive `mkdir` and `ENOENT` for a non-recursive one. `entryOf(dir, path[0])`
decides it, exactly as `statPath` does.

The non-recursive branch wants the same look: today it answers a bare
`fail('non-recursive')` with no code for `path.length > 1`, where a host says
`ENOENT`.

### Tasks

- [ ] Refuse a remaining segment that exists and is not a directory, with
      `enotdir`, creating nothing — presence checked before length.
- [ ] Pin the three rows of the table above as fixtures, the **absent** one
      included, so the ordering cannot be lost.
- [ ] Decide whether the non-recursive failure becomes `ENOENT` with a code, and
      pin it either way.
- [ ] Once the failure exists, add the `tryWrite` fixture this issue blocks: a
      loose `refs/heads/a` beside a write of `refs/heads/a/b`, refused with the
      ref intact.

### Related

- [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) — the same
  path shape on the *read* side, with the guard-ordering argument this issue
  reuses. That one is a wrong code; this one is a destructive success.
- [lexical-path-resolution](./lexical-path-resolution.md) — whether the walk is
  physical, which decides what a `..` in the path means before any of this is
  asked.
- [`fjs/git/refstore`](../../../../git/refstore/module.f.mjs) — `tryWrite` and
  `refPrefixCode`, the caller whose claim about `ENOTDIR` has no fixture until
  this is fixed.
