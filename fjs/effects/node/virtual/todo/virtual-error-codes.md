## virtual-error-codes. The virtual host answers eight failures with another code than Node

**Priority:** P3
**Status:** open

### Problem

[`virtual`](../module.f.mjs) stands in for the Node runner, and a
program proven against it should meet there the failures it meets on the host.
Most of its operations are measured against Node and say so. Eight failure
cases were recorded by running the same scenario against the Node runner and
against `virtual` (fresh tree each time: `d/f`, `d/sub/g`), at `a84ff2980` on
Node 22.22. This is the retained record, not a newly rerun differential:

| Scenario | Node | `virtual` |
| --- | --- | --- |
| `readFile('d')`, a directory | `EISDIR` | `ENOENT` |
| `readFile('d/f/x')`, through a file | `ENOTDIR` | `ENOENT` |
| `readdir('nope')`, missing | `ENOENT` | no code, "invalid path" |
| `readdir('d/f')`, a file | `ENOTDIR` | no code, "invalid path" |
| `writeFile('n/x')`, the parent missing | `ENOENT` | no code, "invalid file" |
| `writeFile('d')`, a directory | `EISDIR` | no code, "invalid file" |
| `writeFile('d/f/x')`, through a file | `ENOTDIR` | no code, "invalid file" |
| `rm('d')`, a non-empty directory | `ERR_FS_EISDIR` | no code, "invalid path" |

The retained account lists thirteen matching scenarios: `mkdir` over a
directory, over a file, with a missing parent and recursively; `rm` of a
missing path and of a file; `rmdir` of a non-empty directory, of a file and of
a missing path; `stat`, `access` and `rename` of a missing path, and `readFile`
of a missing one. Together with the eight rows above, that is **21 enumerated
scenarios**. The earlier totals of 22 scenarios and 16 applicable native-runner
cases are not backed by a retained scenario table, so no unlisted case is
assumed here.

A program that tells these failures apart by `code`, such as a walk that
forgives `ENOENT`, takes the "no code" branch on the virtual host and another
on the host.

`readFile` of a directory currently reaches `resolveFile` and answers `ENOENT`.
That is distinct from `readWhole`, which already rejects a directory with
`notAFileCode` through `jsModuleNotRegular`. Preserve that `readWhole` refusal;
it is not a reason to keep `readFile`'s differing code.

### Proposal

Answer each with the code Node does. The helpers are there (`enoent`,
`enotdir`; an `eisdir` is one line) and `rmOp` already explains the
presence-before-length order every one of them needs: an absent first name is
`ENOENT`, a name that holds something that is not a directory `ENOTDIR`.

### Tasks

- [ ] Pin the eight answers above in [`../proof.f.mjs`](../proof.f.mjs) with
      the code Node gives. Coordinate the read-through-file case with
      [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md).
- [ ] Keep the differential as a proof: one table of scenarios, run against the
      virtual host in the suite, with the host's code recorded beside each as
      the reason a row says what it says. Record the Node version and platform
      when rerunning it; derive any totals from that table.

### Related

- [`virtual`](../module.f.mjs) — the operations and their measured tables.
- [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) — the
  existing read-path investigation.
