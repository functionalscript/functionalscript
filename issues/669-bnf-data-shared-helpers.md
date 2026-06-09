# 669-bnf-data-shared-helpers. Hoist and share repeated helpers in `bnf/data`

**Priority:** P4
**Status:** open

## Problem

`fs/bnf/data/module.f.ts` carries two distinct DRY / hoisting smells in its
parser machinery. Neither is covered by the existing fold-children work in
[i665-bnf-data-fold-children](./665-bnf-data-fold-children.md) (that issue is
about the `sequence` / `variant` AST-fold helpers, a different pair of
functions).

### 1. `mrSuccess` / `mrFail` match-result constructors

Both `descentParser` (lines 384-385) and `parserRuleSet` (lines 452-453) define
a local pair of match-result constructors *inside* their recursive `f`
callback:

```ts
// descentParser, inside f (383-385)
const mrSuccess = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, true, idx]
const mrFail    = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, false, idx]

// parserRuleSet, inside f (452-453)
const mrSuccess = (tag: AstTag, sequence: AstSequence, r: Remainder): MatchResult => [{tag, sequence}, true, r]
const mrFail    = (tag: AstTag, sequence: AstSequence, r: Remainder): MatchResult => [{tag, sequence}, false, r]
```

Two problems:

- **Hoisting.** These helpers capture no local state — they are pure functions
  of their arguments — yet they are redeclared on *every* recursive call of `f`.
  `AGENTS.md` says: "Hoist helpers to module scope when they don't capture local
  state — don't redeclare them inside another function on every call."
- **DRY.** All four constructors are the same shape: `[{ tag, sequence },
  success, third]`. They differ only in the type of the third tuple element
  (`number` index vs `Remainder`) and the sequence type — both of which a
  generic parameter captures.

### 2. `emptyTagMapAdd` branch duplication + mutable accumulators

`emptyTagMapAdd` (lines 336-359) has an Array branch and a Variant/Object branch
that share almost their entire body — seed `map[name] = true`, fold over the
children threading `map` and an `emptyTag`, then return
`[ruleSet, { ...map, [name]: emptyTag }, emptyTag]`:

```ts
} else if (rule instanceof Array) {
    map = { ...map, [name]: true}
    let emptyTag: EmptyTagEntry = rule.length == 0
    for (const item of rule) {
        const [,newMap,itemEmptyTag] = emptyTagMapAdd(ruleSet)(map)(item)
        map = newMap
        if (emptyTag === false) { emptyTag = itemEmptyTag !== false }
    }
    return [ruleSet, { ...map, [name]: emptyTag }, emptyTag]
} else {
    map = { ...map, [name]: true}
    const entries = Object.entries(rule)
    let emptyTag: EmptyTagEntry = false
    for (const [tag, item] of entries) {
        const [,newMap,itemEmptyTag] = emptyTagMapAdd(ruleSet)(map)(item)
        map = newMap
        if (itemEmptyTag !== false) { emptyTag = tag }
    }
    return [ruleSet, { ...map, [name]: emptyTag }, emptyTag]
}
```

Both branches additionally reassign the `map` parameter and a `let emptyTag`
accumulator in place inside a `for` loop, which contradicts the codebase's
"don't reassign accumulators / build new values" convention.

The only real differences are: (a) the seed `emptyTag` (`rule.length == 0` vs
`false`), (b) what is iterated (the array's items vs `Object.entries`), and
(c) the per-item combine (`emptyTag ||= itemEmptyTag !== false` vs
`itemEmptyTag !== false ? tag : emptyTag`).

## Proposal

1. **Hoist a single match-result constructor** to module scope, generic over the
   sequence and third-element types, and derive `mrSuccess` / `mrFail` (or call
   it directly with the success flag) in both parsers:

   ```ts
   const mr = <S, R>(success: boolean) =>
       (tag: AstTag, sequence: S, r: R): readonly [{ readonly tag: AstTag, readonly sequence: S }, boolean, R] =>
           [{ tag, sequence }, success, r]
   ```

   `descentParser` uses `mr<AstSequenceMeta<T>, number>`; `parserRuleSet` uses
   `mr<AstSequence, Remainder>`. Both `f` bodies drop their four local
   declarations.

2. **Unify the `emptyTagMapAdd` branches** into one fold over a list of child
   items, parameterized by the seed `emptyTag` and the combine function, and
   replace the `let`/reassignment loop with a `reduce` that threads
   `{ map, emptyTag }` immutably. This collapses the two near-identical bodies to
   one and removes the in-place mutation.

Both are local, single-module refactors with no cross-module coordination.

## Tasks

- [ ] Hoist the shared `mr` constructor to module scope; update both `f` bodies.
- [ ] Extract a shared child-fold for `emptyTagMapAdd`; thread the accumulator
      immutably instead of reassigning `map` / `emptyTag`.
- [ ] Run `npx tsc`, `fjs t`, and confirm `fs/bnf/data/proof.f.ts` still passes
      with full coverage.

## Related

- [i665-bnf-data-fold-children](./665-bnf-data-fold-children.md) — the adjacent
  `sequence` / `variant` AST-fold extraction (different functions, same module).
- [i667-bnf-repeat-flatten](./667-bnf-repeat-flatten.md) — other `bnf/data`
  cleanups.
