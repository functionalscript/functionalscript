## A POSIX name holding a backslash is not a path this module can spell

**Priority:** P4
**Status:** open

### Problem

[`toPosix`](../module.f.mjs) turns every `\` into `/`, and every entry point
runs it before reading a root: `root`, `parse`, `normalize`, `escapes`,
`concat` and `under` all do. That is right on Windows, where both bytes are
separators. On POSIX a backslash is an ordinary filename byte, so a directory
really called `a\` exists there and this module cannot name it.

The three spellings a caller might reach for are one path here. Measured:

| input | `parse` | `normalize` |
| --- | --- | --- |
| `a\` | `["a"]` | `a` |
| `a\/.git` | `["a", ".git"]` | `a/.git` |
| `a\.git` | `["a", ".git"]` | `a/.git` |

So `a\` is `a/`, and a name below it is `a/.git` however it was written.
A consumer cannot ask this module for the POSIX reading, and no argument to
any function selects it.

This is not a fault in one function. It follows from `toPosix` being
unconditional, and it is the same shape as the bare-drive ambiguity the
module already records: a single string does not say which host wrote it,
and `C:` names two different directories for the same reason `a\` does.

### Why it is recorded and not fixed

Refusing such a name is the wrong trade. `\\` and `\` as *roots* are
spellings Git and Windows really write, and `root` accepts them today, so
refusing every backslash would reject paths the module reads correctly. The
`under` join was measured against that: for every root spelling, including
both backslash ones, `root(under(dir, name))` equals `root(dir)`.

Making one function POSIX-literal while the rest stay host-agnostic is worse
than either choice made consistently. It would put `under` alone in
disagreement with `root`, `parse`, `normalize` and `concat` about what `a\`
is, and a caller composing two of them would get two answers.

### Proposal

A host is an argument, not a guess. The entry points take which reading to
use — the pair of separators the host has — rather than each one calling
`toPosix` on its own. POSIX passes `/` alone and a backslash stays a
filename byte; Windows passes both and nothing changes from today.
[`decode-once.md`](./decode-once.md) is the step that gathers those calls
into one place, which is where such an argument would go, so that issue
comes first.

Until then the module's reading is Windows-shaped, and a caller that must
hold a POSIX name containing a backslash cannot use these functions on it.

### Related

- [`decode-once.md`](./decode-once.md) — the single decode this would
  parameterise.
- [`fjs/path`](../module.f.mjs) — `toPosix`, and the bare-drive limitation
  recorded on `concat` and `under`.
- [`fjs/git/repo`](../../git/repo/module.f.mjs) — reads a leading `\` in a
  `gitdir:` line as an ordinary POSIX name rather than a root, for the
  neighbouring reason that Git writes `/` separators on every host.
