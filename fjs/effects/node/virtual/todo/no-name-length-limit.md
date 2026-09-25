## No name or path length limit, so a name no host accepts is created happily

**Priority:** P3
**Status:** open

### Problem

A host bounds both a single component and the whole path: on Linux a component
over 255 bytes is `ENAMETOOLONG` and so is a path over `PATH_MAX`. This runner
holds its filesystem in a JavaScript object keyed by strings, so it has neither
bound, and a name no host would accept is created at `ok`.

Measured, node 22.22.2 against this runner, with `writeExclusive` — the same is
true of every operation that names an entry:

| component length | node `open(p, 'wx')` | here |
| --- | --- | --- |
| 255 bytes | `ok` | `ok` |
| 256 bytes | `ENAMETOOLONG` | **`ok`, the entry is created** |
| 131,061 bytes | `ENAMETOOLONG` | **`ok`, the entry is created** |

For a *ref* the number that matters is five lower, because the writer opens
`<name>.lock` first: measured, a 250-byte component and its lock both succeed
while 251 plus `.lock` is `ENAMETOOLONG`, which is where `git update-ref` refuses
too. So a `refstore` proof on this runner can write a ref that Git refuses at 251
bytes, not only one at 256.

Found while checking a review finding on
[#2115](https://github.com/functionalscript/functionalscript/pull/2115) about
ref names too long to convert to a `Vec`. That one is fixed in
[`fjs/git/refstore`](../../../../git/refstore/module.f.mjs), whose `nameText`
now answers `null` past `maxLengthBytes` — but the bound it enforces is the *bit
vector's*, 131,072 bytes, not the host's 255, so a `refstore` proof can still
write a ref whose name no host could hold. `writeNameTooLong`'s control, in
[`fjs/git/refstore/write`](../../../../git/refstore/write/proof.f.mjs), is
exactly that write, and it says so.

This is the same shape as the three `parse` issues — a state provable here that
production cannot reach — and the mildest of them: nothing is destroyed and no
existing entry is touched, a name is simply accepted that a host refuses.

### Proposal

Refuse a component over 255 bytes with `ENAMETOOLONG`, in `operation`'s descent
where the segments are already in hand, and decide whether the whole path gets a
`PATH_MAX` bound too.

Both numbers are platform-dependent — 255 is Linux's `NAME_MAX` and macOS's, and
Windows' limit is per-path rather than per-component — so this wants a decision
about *which* host the runner models before it wants an implementation. The
runner already answers node's codes rather than a platform-neutral vocabulary,
so following Linux is consistent with what it does elsewhere; that is a choice to
make explicitly rather than by default.

Worth weighing against the cost: no caller in the repository comes near either
bound except a proof written to test the bound, so this buys fidelity rather than
fixing a live defect. It is recorded so that a proof relying on a long name is
known to be relying on something production would refuse.

### Tasks

- [ ] Decide which host's limits the runner models, and say so in its README.
- [ ] Refuse a component over `NAME_MAX` with `ENAMETOOLONG` in the descent.
- [ ] Decide whether a whole-path bound follows, and pin both ways either way.
- [ ] Revisit `refstore`'s `writeNameTooLong` control, which currently documents
      this gap rather than a property anyone wants.

### Related

- [trailing-separator-discarded](./trailing-separator-discarded.md),
  [lexical-path-resolution](./lexical-path-resolution.md) and
  [reads-enotdir-through-a-file](./reads-enotdir-through-a-file.md) — the three
  path issues this joins. Those are about what a path *means*; this is about how
  long it may be.
- `nameText` in [`fjs/git/refstore`](../../../../git/refstore/module.f.mjs) — the
  caller that bounds ref names at the bit vector's limit, and why that is not the
  host's.
