## dispatch-help-rendering. Separate help rendering from routing in `dispatch`

**Priority:** P4
**Status:** open

### Problem

`dispatch` (`fs/cli/module.f.ts:17-46`) interleaves three distinct concerns —
building the name→command lookup map, rendering the aligned help table, and
routing — and computes the first two eagerly at the top of every call:

```ts
const [cmd, ...rest] = options.args
const rows = [...commands, helpMeta]
const nameCol = rows.map(({names}) => names.join(', '))
const width = Math.max(...nameCol.map(({length}) => length))
const helpText = [
    'Available commands:',
    ...rows.map(({description}, i) => `  ${nameCol[i].padEnd(width)}  ${description}`)
].join('\n')
const map = fromEntries(commands.flatMap(c => c.names.map(n => [n, c] as const)))
```

`helpText` — the column-measuring and padding work — is consumed only by the
three error/help branches (`:28`, `:38`, `:42`); on the common success path
it is dead work. And because `dispatch` recurses for nested command groups
(`:35`, `:45`), the table and the map are rebuilt at every level of the
descent even when neither is used.

Per AGENTS.md, separation of concerns is "always appropriate" even with a
single consumer when the logic is conceptually distinct: how a help table is
formatted is a presentation concern, not a routing concern, and it deserves
its own named, independently testable function.

### Proposal

Extract a module-scope pure helper in `fs/cli/module.f.ts` (the layer that
owns `Command`/`Commands`):

```ts
const renderHelp = <O extends NodeOp>(commands: Commands<O>): string => {
    const rows = [...commands, helpMeta]
    const nameCol = rows.map(({ names }) => names.join(', '))
    const width = Math.max(...nameCol.map(({ length }) => length))
    return [
        'Available commands:',
        ...rows.map(({ description }, i) => `  ${nameCol[i].padEnd(width)}  ${description}`)
    ].join('\n')
}
```

and call it only inside the branches that actually print help
(`renderHelp(commands)` at the three sites). The routing core of `dispatch`
then reads as: destructure args → look up → recurse or run, with no
presentation code in the way. The name→command `map` construction can stay in
`dispatch` (it is used on most paths) or move into a helper alongside; the
help rendering is the clear win.

### Tasks

- [ ] Hoist the help-table rendering into `renderHelp`; call it lazily in the
      three help/error branches.
- [ ] `npx tsc` clean; `fjs t` passes (`fs/cli/proof.f.ts`).

### Related

- `fs/cli/module.f.ts:17-46` — current `dispatch`.
- [positional-arity-check](./positional-arity-check.md) — separate concern
  (argument validation), independent of this change.
