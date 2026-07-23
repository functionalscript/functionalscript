## 665-bnf-data-fold-children. `bnf/data`: collapse `sequence`/`variant` onto one immutable child-fold

**Priority:** P4
**Status:** open

### Problem

`fjs/bnf/data/module.f.ts` defines two `NewRule` builders, `sequence` and
`variant`, that walk a rule's children, register each child via `toDataAdd`, and
thread the resulting `FRuleMap`/`RuleSet` while building a result. They share the
same accumulation skeleton and differ only in (a) what they iterate and (b) how
the result is shaped:

```ts
// fjs/bnf/data/module.f.ts:172
const sequence = (list: FSequence): NewRule => map => {
    let result: Sequence = []
    let set = {}
    for (const fr of list) {
        const [map1, set1, id] = toDataAdd(map)(fr)
        map = map1
        set = { ...set, ...set1 }
        result = [...result, id]
    }
    return [map, set, result]
}

// fjs/bnf/data/module.f.ts:184
const variant = (fr: FRule): NewRule => map => {
    let set: RuleSet = {}
    let rule: Variant = {}
    for (const [k, v] of entries(fr)) {
        const [m1, s, id] = toDataAdd(map)(v)
        map = m1
        set = { ...set, ...s }
        rule = { ...rule, [k]: id }
    }
    return [map, set, rule]
}
```

The threaded part — start from the incoming `map`, fold each child through
`toDataAdd`, advance `map`, union `set` — is identical line-for-line. Only the
result builder differs: `sequence` appends `id` to an array; `variant` assigns
`id` under key `k`.

Two secondary issues compound the duplication:

1. **Both bodies mutate `let` accumulators in a `for` loop** (`map = …`,
   `set = …`, `result = …` / `rule = …`). AGENTS.md is explicit: *"Don't mutate
   arrays, sets, maps, or objects in place… Build new values with `.map`,
   `.filter`, `reduce`, spread…"* and *"Use `let` variables only within the
   function body where they are declared."* These two functions are exactly the
   imperative-accumulator pattern the convention asks us to express as a fold.

2. The `map`/`set` threading is the **non-obvious, easy-to-get-wrong** part
   (forget to advance `map` and later children register against a stale name
   table). Writing it twice doubles the surface for that bug.

### Proposal

Extract one child-folding helper that owns the `map`/`set` threading and takes a
result builder. Both `sequence` and `variant` become thin instantiations:

```ts
// reduce over [key, child] entries, threading map+set; build accumulates results
const foldChildren =
    <R>(init: R, build: (acc: R, id: Rule, key: string) => R) =>
    (children: readonly (readonly [string, FRule])[]): NewRule =>
    map =>
        children.reduce(
            ([m, set, acc], [key, child]) => {
                const [m1, s, id] = toDataAdd(m)(child)
                return [m1, { ...set, ...s }, build(acc, id, key)] as const
            },
            [map, {}, init] as readonly [FRuleMap, RuleSet, R],
        )

const sequence = (list: FSequence): NewRule =>
    foldChildren<Sequence>([], (acc, id) => [...acc, id])(
        list.map((fr, i) => [`${i}`, fr] as const))

const variant = (fr: FRule): NewRule =>
    foldChildren<Variant>({}, (acc, id, key) => ({ ...acc, [key]: id }))(
        entries(fr))
```

`sequence` ignores the `key` (it pairs each child with its index purely to reuse
the `[key, child]` entry shape); `variant` uses it. The `map`/`set` threading
now lives in exactly one place and is expressed as an immutable `reduce`,
removing the four mutated `let`s.

### Why this qualifies

- **DRY:** two real consumers (`sequence`, `variant`) of the same map/set-threaded
  child fold, differing only in the result builder — the textbook
  "parameterize the small difference" case in AGENTS.md.
- **Convention compliance:** replaces two `let`-mutating `for` loops with a single
  immutable `reduce`, directly satisfying the no-mutation / `let`-scope rules.
- **Correctness surface:** the fragile `map` threading is written once.

### Tasks

- [ ] Add `foldChildren` (private) to `fjs/bnf/data/module.f.ts`.
- [ ] Rewrite `sequence` and `variant` as instantiations of it.
- [ ] Confirm `fjs/bnf/data/proof.f.ts` coverage still exercises both result
      shapes (array and keyed) and the multi-child map-threading path.
- [ ] `npm test` + `npx tsc` green.

### Caveats

- This is an **internal** refactor of two small functions; the line savings are
  modest (~10 lines). The stronger argument is convention compliance (no
  mutation) and single-sourcing the `map`/`set` threading, not raw size. Hence
  P4.
- Watch the result types: `Sequence` is `readonly Rule[]` and `Variant` is a
  keyed record, so `foldChildren` must stay generic over `R` and not assume a
  container. The sketch keeps `R` fully abstract and lets `build` own the shape.
- `sequence` pairing children with a stringified index is slightly artificial.
  If that reads worse than the duplication, an alternative is two tiny callbacks
  over a shared `(map, child) => [map, set, id]` step without unifying the
  iteration source — pick whichever a reader finds clearer.

### Related

- [i197-djs-unknown-walker](../djs/todo.md) — same spirit
  (collapse several near-identical typeof/child walks onto one parameterized
  traversal), on the DJS value side.
