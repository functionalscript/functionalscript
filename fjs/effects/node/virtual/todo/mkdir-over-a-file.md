## A recursive `mkdir` replaces a file with a directory instead of failing

**Priority:** P3
**Status:** open

### Problem

`mkdirOp` in [`../module.f.mjs`](../module.f.mjs) builds the remaining path as
nested empty directories and spreads them into the directory it was handed. When
the first remaining segment is a **file**, the spread overwrites it — the file's
bytes are gone and the operation answers `ok`.

Measured, with the host beside it:

| path, with `recursive: true` | `refs/heads/a` is… | here | node 22.22.2 on Linux |
| --- | --- | --- | --- |
| `refs/heads/a/b` | absent | `ok`, both created | `ok`, both created |
| `refs/heads/a/b` | a directory | `ok`, nothing changed | `ok`, nothing changed |
| `refs/heads/a/b` | **a file** | **`ok`, and `a` is now an empty directory** | **`ENOTDIR`** |
| `refs/heads/a` | **a file** | **`ok`, and `a` is now an empty directory** | **`EEXIST`** |

The first two rows agree, which is what makes the rest easy to miss: every
ordinary use of the operation behaves, and the divergence appears only where a
caller is relying on the failure. The last two rows are two codes and not one —
a file *above* the directory being created is `ENOTDIR`, and a file *at* it is
`EEXIST`, since `recursive` suppresses `EEXIST` for a directory and not for
anything else.

This is not the same shape as
[reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md), and it is
worse. There, a read answers the wrong *code* for a path it cannot serve, and
the file is untouched. Here a write **succeeds where a host refuses** and takes
the file with it, so a proof built on this runner does not merely miss a branch —
it watches a destructive operation and calls it correct.

### Who notices

[`fjs/git/refstore`](../../../../git/refstore/module.f.mjs)'s `tryWrite` is the
caller today, and **it no longer reaches this bug** — which is a correction to
what an earlier revision of this file claimed, found by review of
[#2115](https://github.com/functionalscript/functionalscript/pull/2115). The
`stat` of the ref's own path, added for the symlink-to-a-directory the `rename`
would otherwise have replaced, answers both loose prefix directions before
anything is created:

| the write | what the `stat` of the ref's path sees | refusal |
| --- | --- | --- |
| `refs/heads/a` beside a directory `refs/heads/a` | a directory | `refPrefixCode` |
| `refs/heads/a/b` beside a **file** `refs/heads/a` | `ENOTDIR`, since the path leads through the file | `ENOTDIR` |

Measured on both sides: node 22.22.2 answers `ENOTDIR` for that `stat` and so
does `statPath` here, `leadsNowhere` does not swallow it, and Git 2.43.0 refuses
the same write with `'refs/heads/a' exists; cannot create 'refs/heads/a/b'`. Both
rows have a fixture — `writeRefIsADirectory` and `writeLooseIsAFile` — and
dropping the `stat` reddens both.

So the `mkdir` below it never runs on a path whose parent is a file, and this
issue is no longer load-bearing for that caller. It remains a defect of this
runner: a write that **succeeds where a host refuses** and takes a file with it,
rather than a read answering the wrong code for a path it cannot serve, which is
[reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md). A proof built
on this runner does not merely miss a branch — it watches a destructive
operation and calls it correct.

**It was never a reason for `tryWrite` to refuse the write, either.** Review of
the same PR asked for that — the writer to refuse a loose prefix until this
runner matches the host — and it inverts where the defect is. This runner holds
the filesystem in a JavaScript object and its README calls it "primarily used for
testing"; every importer of it in the repository is a `proof`, the one exception
being `fjs/dev`'s own proof entries. No ref store runs on it. A production
refusal added because a test double models one operation wrongly would let the
double set the contract. The fix is here.

### Proposal

Answer the host's code where a remaining segment names something that is not a
directory, and create nothing — `ENOTDIR` where the segment is above the
directory being created, `EEXIST` where it *is* that directory, per the table
above. The check has to come **before** anything is
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

- [ ] Refuse a remaining segment that exists and is not a directory, creating
      nothing — presence checked before length, and `EEXIST` rather than
      `ENOTDIR` where that segment is the last one.
- [ ] Pin all four rows of the table above as fixtures, the **absent** one
      included, so the ordering cannot be lost.
- [ ] Decide whether the non-recursive failure becomes `ENOENT` with a code, and
      pin it either way.

### Related

- [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) — the same
  path shape on the *read* side, with the guard-ordering argument this issue
  reuses. That one is a wrong code; this one is a destructive success.
- [lexical-path-resolution](./lexical-path-resolution.md) — whether the walk is
  physical, which decides what a `..` in the path means before any of this is
  asked.
- [`fjs/git/refstore`](../../../../git/refstore/module.f.mjs) — `tryWrite` and
  `refPrefixCode`, the caller that used to be blocked by this and is not.
