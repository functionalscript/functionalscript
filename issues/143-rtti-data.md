# 143. RTTI: Serializable Data Representation

Introduce a function-free, serializable representation of `Type` in [../fs/types/rtti/module.f.ts](../fs/types/rtti/module.f.ts), modeled after [../fs/bnf/data/](../fs/bnf/data/). All structural analysis on schemas — flattening, deduplication, subset removal, value-set coverage collapse, and canonical ordering — should run on this data form instead of on the lazy thunk graph.

## Motivation

The current `Type` is `Const | (() => Info)`. Function thunks are convenient for recursion but hard to compare: two thunks that describe the same schema are unequal under `Object.is`, have no natural ordering, and need bespoke walking with a visited set to terminate on cycles. The current ad‑hoc analysis in `reduceOr`/`flattenOr` handles a few special cases (`unknown` collapse, primitive-thunk subset, same-reference dedup) but does not scale to the remaining goals of [130](./130-or-optimization.md):

- Canonical ordering of variants (`or(a, b) ≡ or(b, a)`).
- Structural subset for tuples/structs.
- Full coverage collapse (`{ true, false }` → `boolean`, all primitive+container thunks → `unknown`).
- Stable identity for equivalent schemas built two different ways.

A serializable form gives us all of these for free: every node is comparable, sortable, and serializable; recursion becomes a named reference into a `Rule` map.

## Shape (sketch)

Following the conventions of `fs/bnf/data/module.f.ts`:

```ts
// Each named rule is a `Const`, a tagged nullary marker, or a tagged node
// whose children are name references into the rule set.
type Rule =
    | readonly['const', Const]
    | readonly['unknown']
    | readonly['bigint']
    | readonly['boolean']
    | readonly['number']
    | readonly['string']
    | readonly['array', string]
    | readonly['record', string]
    | readonly['or', readonly string[]]

type RuleSet = Readonly<Record<string, Rule>>

// Entry-point: returns the rule set plus the name of the root rule.
const toData = (t: Type): readonly[RuleSet, string] => ...
```

`toData` walks the thunk graph, deduplicating reachable thunks by identity (à la `find`/`toDataAdd` in `bnf/data`) and giving each one a stable name. Cycles terminate naturally — a thunk reached a second time resolves to its existing name. `Const` values are interned in the same rule map.

## Normalization on the data form

Once a schema is in `RuleSet` form, `or` normalization is straightforward:

1. **Flatten.** Inline any variant whose target rule is itself `['or', ...]`.
2. **Deduplicate.** Variant lists are sets of rule names — duplicates collapse trivially.
3. **Subset drop.** With every node sortable and comparable, generic `equal`/`subset` predicates can be written by recursing over `RuleSet`.
4. **Coverage collapse.** `{ true, false }` → `boolean`; the full primitive+container cover → `unknown`.
5. **Canonical ordering.** Sort variant names by a total order on `Rule` (tag, then payload). This yields a stable, structurally comparable result for any two equivalent constructions.

## Downstream consumers

`validate` and `parse` can be refactored to consume `RuleSet` directly. The thunk form remains the user-facing API; `toData` is the single bridge. As a stepping stone, `validate`/`parse` may keep their thunk-based dispatch and call `toData` only inside `or` to normalize its variants.

## Related

- [130](./130-or-optimization.md) — depends on this issue; the remaining goals (canonical ordering, structural subset, coverage collapse) are naturally expressed on the data form.
- [141](./README.md) — universal, extensible type system based on custom RTTI. The `equal`/`subset` predicates introduced here are the first concrete instance of the proposed `TypeSystem<T>` interface.
- [125](./README.md) — `bun test` returned-function handling. Unrelated to dispatch, but shares the goal of making schema-driven test data uniform.

## Location

`fs/types/rtti/data/module.f.ts` (new), with `test.f.ts` alongside.
