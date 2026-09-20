## lexical-path-resolution. `..` collapses without checking what it left

**Priority:** P3
**Status:** open

### Problem

Every operation in this runner resolves its path with `parse`
([`fjs/path`](../../../../path/module.f.mjs)), which collapses `a/../b` to `b`
*lexically*. A host resolves the same path physically: it walks `a`, fails if
`a` is missing or is not a directory, and only then applies the `..`.

So `stat('missing/..')` answers here and is `ENOENT` on a host, and the same goes
for `readFile('missing/../real.txt')`, `access`, `rm` — anything that takes a
path. A proof can rely on a path whose intermediate component does not exist.
Reported on [#1693](https://github.com/functionalscript/functionalscript/pull/1693)
against `stat`, where the empty-path half was fixed; this is the half that is not
about `stat`.

**The exclusive creates make the same row visibly wrong**, which is worth writing
down because their answer for it changed in
[#2115](https://github.com/functionalscript/functionalscript/pull/2115) and could
look settled:

| `createExclusive(p)` / `writeExclusive(p, …)` | this runner | node 22.22.2 |
| --- | --- | --- |
| `p = ''` | `ENOENT` | `ENOENT` |
| `p = '.'` | `EEXIST` | `EEXIST` |
| `p = 'missing/..'` | **`EEXIST`** | **`ENOENT`** |

The first two are carved out explicitly, as `statOp` carves out its own — an
empty path names nothing and `.` is the root, and `parse` collapses both to no
segments. The third is indistinguishable from `.` until the walk is physical, so
it answers as the root does and is this issue's to fix, not theirs. It used to be
`invalid path` for all three.

It is the same shape as
[symlink-containment](../../../../web/todo/symlink-containment.md): both are the
gap between a path as *text* and a path as a walk through a file system, and both
would be closed by resolving the walk rather than the string.

### Proposal

Resolve segment by segment, in the descent `operation` already performs: fail
with `ENOENT` when a component is missing, and with `ENOTDIR` when one is a file,
before a following `..` can erase it. `operation`'s wrapper is the single place
that walks the tree, so the change is one function rather than one per operation
— but it changes the answer for every path a proof passes with a `..` in it,
which is why it wants its own pull request rather than a corner of another.

Check what depends on the current behaviour first: `fjs/cas`'s staging paths and
`fjs/dev`'s file discovery both build paths by concatenation, and a collapsed
`..` in one of them would start failing.

### Tasks

- [ ] Resolve `..` during the descent in `operation`, not in `parse`.
- [ ] `ENOTDIR` for a component that is a file, distinct from `ENOENT`.
- [ ] Re-run the suite for proofs that pass a `..` path and relied on the
      lexical answer.
- [ ] Once the walk is physical, drop `statOp`'s and `exclusive`'s `path === ''`
      carve-outs only if the descent answers `ENOENT` for it — `''` and `.` still
      differ, so the carve-out may have to stay whatever `..` does.

### Related

- `fjs/path/module.f.mjs` — `parse`, which is lexical by design and should stay
  that way; this is about where a file system uses it.
- [symlink-containment](../../../../web/todo/symlink-containment.md) — the same
  text-versus-walk gap, from the other end.
