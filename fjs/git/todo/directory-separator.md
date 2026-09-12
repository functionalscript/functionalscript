## A directory that ends in a separator gets another one below it

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/store`](../store/module.f.mjs) builds the two paths it reads by
writing the separator itself:

    `${dir}/config`
    `${dir}/objects/${h.slice(0, 2)}/${h.slice(2)}`

That is right for every directory whose spelling does not already end in a
separator, and wrong for the few that do. `fjs/path` reads `/` and `//` as
two roots — a POSIX one and a UNC one that stops at the root rather than
swallowing `server/share` — and three or more leading slashes as an
ordinary root again. So a `dir` of `/` gives `//config`, which names a
file in another namespace on a host that has one, and a `dir` of `//`
gives `///config`, which is the ordinary root once more. `C:/` gives
`C://config` on the host that knows drives.

[`fjs/git/repo`](../repo/module.f.mjs) hands such a directory back. Its
`tryCommonDir` answers the path Git builds, and Git keeps a root as it
finds it: a gitfile of `gitdir: /` gives `/` and one of `gitdir: //` gives
`//`, both measured with `git rev-parse --git-dir` on Git 2.43.0. The
module joins below a directory with its own `under`, which adds a separator
only where there is not one already, so the paths it builds are right; the
store's are not, and the composition the README describes — `repo` finds
the directory, `store` reads at it — is where the two meet.

A repository directory that is a root is not a repository anyone makes,
which is why this is P3 rather than a bug to fix in the branch that found
it. It is recorded because the rule is not local: every consumer that
spells a path below a directory it was given has it, and two of them are
in this directory already.

### Proposal

One join, shared. `under` in `fjs/git/repo` is the behaviour wanted — a
name below a directory, with a separator added only where the directory
does not end in one, and the name alone where the directory is empty — and
it belongs beside `join` in [`fjs/path`](../../path/module.f.mjs) rather
than in a module about Git. Then:

- `fjs/path` exports it, with the root cases in its proof: `/`, `//`,
  `C:/`, `''`, and an ordinary directory.
- `fjs/git/store` builds `config` and the object path through it.
- `fjs/git/repo` imports it rather than keeping its own.

The alternative is for `tryCommonDir` to refuse a directory whose spelling
ends in a separator. That is cheaper and worse: it refuses a path Git
reads, it leaves every other consumer of a caller-given directory with the
same fault, and it answers a question about spelling with a refusal about
existence.

### Related

- [`fjs/git/repo`](../repo/module.f.mjs) — `under`, and why a root keeps
  its kind.
- [`fjs/git/store`](../store/module.f.mjs) — the two paths built by
  interpolation.
- [`fjs/path`](../../path/module.f.mjs) — the root model, and where a
  shared join would sit.
