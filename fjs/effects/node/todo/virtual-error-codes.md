## virtual-error-codes. The virtual host answers eight failures with another code than Node

**Priority:** P3
**Status:** open

### Problem

[`virtual`](../virtual/module.f.mjs) stands in for the Node runner, and a
program proven against it should meet there the failures it meets on the host.
Most of its operations are measured against Node and say so. Eight failure
cases, found by running the same scenario against the Node runner and against
`virtual` (fresh tree each time: `d/f`, `d/sub/g`), answer differently, at
`a84ff2980` on Node 22.22:

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

The same run agreed on the other fourteen: `mkdir` over a directory, over a
file, with a missing parent and recursively; `rm` of a missing path and of a
file; `rmdir` of a non-empty directory, of a file and of a missing path;
`stat`, `access` and `rename` of a missing path, and `readFile` of a missing
one. A program that tells these failures apart by `code` (a walk
that forgives `ENOENT`, `fjs/git/refstore` on an `EISDIR` directory called
`packed-refs`) takes the "no code" branch on the virtual host and another on
the host.

`readFile` of a directory is the one with a stated reason, in `readWhole`: a
directory would have to answer a refusal and `ENOENT` reads as absence there.
It is that case's code that differs, not the case.

The native runner (`nanvm-effects-node`, `Native`) takes its codes from `std`'s
error kinds, `ENOENT`, `EACCES`, `EEXIST`, `ENOTDIR`, `EISDIR` and `ENOTEMPTY`,
which are the Unix errors behind the codes in the first seven rows; it has no
kind for `ERR_FS_EISDIR`.

### Proposal

Answer each with the code Node does. The helpers are there (`enoent`,
`enotdir`; an `eisdir` is one line) and `rmOp` already explains the
presence-before-length order every one of them needs: an absent first name is
`ENOENT`, a name that holds something that is not a directory `ENOTDIR`.

### Tasks

- [ ] The eight answers above, each pinned in `virtual/proof.f.mjs` with the
      code Node gives.
- [ ] Keep the differential as a proof: one table of scenarios, run against the
      virtual host in the suite, with the host's code recorded beside each as
      the reason a row says what it says.

### Related

- [`virtual`](../virtual/module.f.mjs) — the operations and their measured
  tables.
- [nanvm-effects-node](../../../../todo/nanvm-effects-node.md) — the native
  runner whose cross-check against the virtual host found these.
