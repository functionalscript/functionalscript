## The `Uses` record is assembled by hand outside its owner

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) prints a scope's uses as a record, `{ vm,
unstable }`, built by `namesIn` from the flat `Use[]` the printers collect,
and `useLinesTagged` prints the record.
[`fjs/compiler/rust/runtime`](../../../compiler/rust/runtime/module.f.mjs)
builds the same record with its own `names`:

```js
// edag/rust
const namesIn = uses => module => [...new Set(uses.flatMap(([m, n]) => m === module ? [n] : []))].toSorted()
// compiler/rust/runtime
const names = uses => module => [...new Set(uses.filter(([m]) => m === module).map(([, name]) => name))].toSorted()
```

each followed by the two-key record and the same `useLinesTagged(record,
bound)` call. The runtime generator also re-declares the `kw` and `lit`
marks `edag/rust` declares.

### Proposal

`useLinesTagged` takes the flat `readonly Use[]` and sorts and dedupes
itself, or `edag/rust` exports `usesOf(uses): Uses` and both callers pass
the list; `edag/rust` exports its marks as `_kw` and `_lit` and the runtime
printer imports them — the underscore because the export is linkage for
one importer and not API, as `fjs/AGENTS.md` has it.

### Tasks

- [ ] `useLinesTagged` over `Use[]`, or `usesOf`; `scopeTagged` and the
      runtime generator use it.
- [ ] The marks exported once, as `_kw` and `_lit`.

### Related

- [let-bindings-owner](./let-bindings-owner.md) — the neighbouring
  duplication between `compiler/rust` and `fjs/nanvm/rust`.
- [static-runtime-calls](../../../../nanvm/lib/todo/static-runtime-calls.md)
  — the runtime printer's current direction.
