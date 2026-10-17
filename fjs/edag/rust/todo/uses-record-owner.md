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
bound)` call. The runtime generator also re-declares `kw` and `lit` and
re-implements `reasonText` from
[`fjs/compiler/rust`](../../../compiler/rust/module.f.mjs).

### Proposal

`useLinesTagged` takes the flat `readonly Use[]` and sorts and dedupes
itself, or `edag/rust` exports `usesOf(uses): Uses` and both callers pass
the list; `reasonText` is exported by `compiler/rust` and imported. The
runtime printer is being reshaped by the static-runtime work; this lands
after it.

### Tasks

- [ ] `useLinesTagged` over `Use[]`, or `usesOf`; `scopeTagged` and the
      runtime generator use it.
- [ ] `reasonText` exported once.

### Related

- [let-bindings-owner](./let-bindings-owner.md) — the neighbouring
  duplication between `compiler/rust` and `fjs/nanvm/rust`.
- [static-runtime-calls](../../../../nanvm/lib/todo/static-runtime-calls.md)
  — the runtime printer's current direction.
