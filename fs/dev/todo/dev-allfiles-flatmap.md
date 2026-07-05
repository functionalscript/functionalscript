## dev-allfiles-flatmap. Rewrite `allFiles` entry loop declaratively

**Priority:** P4
**Status:** open

### Problem

`allFiles` (`fs/dev/module.f.ts:53-71`) builds its effect array with an
imperative `for` loop, a reassigned accumulator, and three `continue`s:

```ts
let result: readonly Effect<Readdir | All, readonly string[]>[] = []
for (const i of unwrap(d)) {
    const { name } = i
    if (name.startsWith('.')) { continue }
    const file = join(p, name)
    if (!i.isFile) {
        if (name === 'node_modules') { continue }
        result = [...result, load(file)]
        continue
    }
    if (predicate(file)) {
        result = [...result, pure([file])]
    }
}
return all(...result)
```

`AGENTS.md` prefers declarative construction (`.map`, `.filter`, `.flatMap`,
spread) over loop-and-reassign accumulators. Each directory entry yields
zero or one effect, which is exactly the `flatMap` shape. The repeated
`result = [...result, x]` is also O(n²) in entry count.

Secondary: line 82 destructures `const { fromEntries } = Object` while
`AGENTS.md` mandates the typed helpers from `fs/types/object/module.f.ts`
for string-keyed maps (`fs/cli` already imports from there).

### Proposal

```ts
readdir(p, {}).step(d => all(...unwrap(d).flatMap(i => {
    const { name } = i
    if (name.startsWith('.')) { return [] }
    const file = join(p, name)
    return i.isFile
        ? (predicate(file) ? [pure([file])] : [])
        : (name === 'node_modules' ? [] : [load(file)])
})))
```

No `let`, no `continue`, no accumulator reassignment; the 0-or-1 mapping per
entry is explicit. Also replace the `Object.fromEntries` destructuring with
the appropriate helper from `fs/types/object/module.f.ts` (or file a
follow-up if no typed `fromEntries` exists there yet).

### Tasks

- [ ] Rewrite the `load` body with `flatMap` as above.
- [ ] Replace `const { fromEntries } = Object` with the typed equivalent
      from `fs/types/object/module.f.ts`, adding one there if missing (it
      has consumers waiting: this module and future map-builders).
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [computational-collections-in-effects](../../effects/todo/computational-collections-in-effects.md) —
  batching of the *outer* module-map `flatMap`; different loop, same module
  family.
