## loose-ref-writer. The loose-ref format is read here and written in `refstore/write`

**Priority:** P4
**Status:** wip

### Problem

Every format module in `fjs/git` pairs its reader with its writer in one
file — `commit`, `tag`, `tree`, `header`, `ident`, `object` — so the
round trip has one owner and one proof. `ref` is the exception: it owns
`tryLoose`, `tryRef`, `tryPacked` and even the writer-side
`tryPackedWithout`, but the loose file's bytes are spelled in the
effectful store:

```js
// fjs/git/refstore/write/module.f.mjs, tryWrite
writeExclusiveUtf8File(lock, `${hexText(id)}\n`)
```

The symbolic-ref write that
[ref-writing](../../refstore/todo/ref-writing.md) plans, `ref: <name>\n`,
would put a second format string into the store, beside the grammar that
reads it from another module.

### Proposal

```ts
/**
 * A loose ref's bytes; `tryLoose(oidBytes)(writeLoose(oidBytes)(id))` is `id`.
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the widths has a bug.
 */
export const writeLoose: (oidBytes: OidBytes) => (id: Oid) => Bytes
export const writeSymbolic: (name: Bytes) => Bytes
```

in this module, with the round trip as the proof, and `refstore/write`
writing those bytes through `writeExclusive`. The writer is bound to
the width the way every reader in this module is, because an `Oid` is
a `Vec` that carries no width of its own: `tryLoose(oidBytes)` answers
`null` for hex of any other length, so the round trip is a law only
for an id of that width, and the writer refuses any other — the same
precondition the readers assert, spelled once as
[`fjs/git/oid`](../../oid/module.f.mjs)'s `ofWidth`.

### Tasks

- [ ] `writeLoose` (and `writeSymbolic` when the write lands), with the
      round-trip proof.
- [ ] `refstore/write` through it.
- [ ] `tsc`, `fjs test`.

### Related

- [../../refstore/todo/ref-writing.md](../../refstore/todo/ref-writing.md)
  — the symbolic write this gives a home to.
- [`fjs/git/oid`](../../oid/module.f.mjs)'s `ofWidth` — the width
  assertion the writer shares with the readers.
