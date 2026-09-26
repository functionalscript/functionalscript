## Create the directories an output path climbs through

**Priority:** P3
**Status:** open

### Problem

`fjs compile` creates its output's directory before writing, so it can write
into a `gen.*` directory that does not exist yet. `outputDirectory` in
[`../module.f.mjs`](../module.f.mjs) finds that directory by normalizing the
output path's parent, and normalizing folds `..` away. The file itself is then
opened at the path as given.

For an output such as `a/../b/out.json` with no `a/` on disk, `compile`
creates `b/`, then fails to open `a/../b/out.json` with `ENOENT` and exits
`1`, leaving an empty `b/` behind. The operating system walks `a` before it
applies `..`, so `a` has to exist as well. Found in review of
[#2308](https://github.com/functionalscript/functionalscript/pull/2308#discussion_r4103821598).

It fails loudly, not with a wrong result, and it failed before #2308 too, so
it is not a regression. No generator in this repository writes such a path.

### Proposal

Either create every directory the unnormalized path passes through, `a` and
then `b`, or refuse an output path with a `..` segment before creating
anything. Refusing is simpler and leaves nothing behind. It is the likely
choice unless a caller turns up that needs such a path.

### Tasks

- [ ] Decide between creating the traversed directories and refusing the path.
- [ ] Implement it in `compile`, with a proof for `a/../b/out.json`.
