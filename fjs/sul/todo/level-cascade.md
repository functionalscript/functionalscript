## level-cascade. The literal pipeline unrolls the level cascade the hash pipeline folds

**Priority:** P4
**Status:** open

### Problem

`sul/level/literal`'s `pipelineStep` feeds three fixed levels into one
another and stops at the first `undefined`, unrolled by hand:

```js
const [l1Out, newL1s] = l1.encode(bit, l1s)
if (l1Out === undefined) return [undefined, [newL1s, l2s, l3s]]
const [l2Out, newL2s] = l2.encode(l1Out, l2s)
if (l2Out === undefined) return [undefined, [newL1s, newL2s, l3s]]
const [l3Out, newL3s] = l3.encode(l2Out, l3s)
```

rebuilding the state tuple at each exit, which is where the mistakes
go. The shape — a chain of `StateScan` steps, each state kept separately,
the chain cut at the first step that answers nothing — is a fold the
module does not name.

`sul/module.f.mjs`'s `cascadeFrom` has the same *motion* and is not the
same fold: it runs one step over a list of stacks whose length is only
known at run time, threads one shared storage through every level, and
appends a stack when the chain runs off its end. It stays as it is; this
issue is the fixed pipeline only.

### Proposal

One `cascade` over a fixed list of `StateScan` steps, here or in
`fjs/types/function/operator` beside `StateScan`:

```ts
export const cascade: <I, S>(steps: readonly StateScan<I, S, I | undefined>[])
    => StateScan<I, readonly S[], I | undefined>
```

`pipelineStep` is `cascade([l1.encode, l2.encode, l3.encode])`, its
state the list of the three level states, and the early exits are the
combinator's.

### Tasks

- [ ] `cascade` with a proof of the early exit at each position.
- [ ] `pipelineStep` through it.
- [ ] `tsc`, `fjs test`.

### Related

- [66m-sul-literal-level-reuse.md](./66m-sul-literal-level-reuse.md)
  — the same module's second `level(e)` construction; independent.
