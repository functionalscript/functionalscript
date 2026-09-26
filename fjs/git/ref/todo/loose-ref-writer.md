## loose-ref-writer. The loose-ref format is read here and written in `refstore/write`

**Priority:** P4
**Status:** open

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
/** A loose ref's bytes; `tryLoose(oidBytes)(writeLoose(id))` is `id`. */
export const writeLoose: (id: Oid) => Bytes
export const writeSymbolic: (name: Bytes) => Bytes
```

in this module, with the round trip as the proof, and `refstore/write`
writing those bytes through `writeExclusive`.

### Tasks

- [ ] `writeLoose` (and `writeSymbolic` when the write lands), with the
      round-trip proof.
- [ ] `refstore/write` through it.
- [ ] `tsc`, `fjs test`.

### Related

- [../../refstore/todo/ref-writing.md](../../refstore/todo/ref-writing.md)
  — the symbolic write this gives a home to.
