## level-cascade. The literal pipeline unrolls the level cascade the hash pipeline folds

**Priority:** P4
**Status:** open

### Problem

Feeding each level's output into the next and stopping at the first
`undefined` is the shape of both pipelines. `sul/module.f.mjs`'s
`encode` writes it once, generically, as `cascadeFrom` over a growing
list of level states. `sul/level/literal`'s `pipelineStep` unrolls it
three times by hand:

```js
const [l1Out, newL1s] = l1.encode(bit, l1s)
if (l1Out === undefined) return [undefined, [newL1s, l2s, l3s]]
const [l2Out, newL2s] = l2.encode(l1Out, l2s)
if (l2Out === undefined) return [undefined, [newL1s, newL2s, l3s]]
const [l3Out, newL3s] = l3.encode(l2Out, l3s)
```

rebuilding the state tuple at each exit, which is where the mistakes
go.

### Proposal

One `cascade` over a list of `StateScan` steps, here or in
`fjs/types/function/operator` beside `StateScan`:

```ts
export const cascade: <I, S>(steps: readonly StateScan<I, S, I | undefined>[])
    => StateScan<I, readonly S[], I | undefined>
```

`pipelineStep` is `cascade([l1.encode, l2.encode, l3.encode])`, and
`cascadeFrom` is the same step with shared storage threaded through `S`
and a level appended when the chain runs off its end.

### Tasks

- [ ] `cascade` with a proof of the early exit at each position.
- [ ] Both pipelines through it.
- [ ] `tsc`, `fjs test`.

### Related

- [66m-sul-literal-level-reuse.md](./66m-sul-literal-level-reuse.md)
  — the same module's second `level(e)` construction; independent.
