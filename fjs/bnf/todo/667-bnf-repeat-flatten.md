## 667-bnf-repeat-flatten. BNF: a `repeat` primitive in the data representation

**Priority:** P3
**Status:** blocked
**Blocked by:** [Separate alphabet-specific BNF helpers](./unicode-rules.md), [256-bit bigint BNF symbols](./bigint-symbols.md), [BNF semantic actions](./207.md)

### Problem

Unbounded repetition in the BNF grammar is encoded as right-recursion — there
is no primitive `repeat` rule. Helpers like `repeat0Plus` expand to a recursive
`Variant`, so the data form does not explicitly say that a rule is a list.
Downstream consumers therefore have to infer repetition from the rule graph, and
the resulting AST is naturally a nested cons-like structure instead of a flat
sequence.

The old stack-overflow motivation is no longer relevant: the descent matcher now
uses an explicit stack and can process right-recursive grammars without consuming
the native JavaScript call stack. The remaining motivation is purely the data and
AST shape: represent an unambiguous repetition explicitly and emit a flat sequence
for it.

### Migration prerequisite

The earlier version of this TODO proposed:

```ts
type Repeat = string
type Rule = Variant | Sequence | TerminalRange | Repeat
```

and dispatched terminals with checks such as:

```ts
if (typeof rule === 'string') { /* Repeat */ }
else if (typeof rule === 'number') { /* TerminalRange */ }
```

Do **not** implement that representation. It depends on two pre-migration
assumptions that are being removed by the blocking BNF tasks:

- raw JavaScript `string` is no longer a generic BNF rule kind; Unicode strings
  are lowered by `fjs/bnf/unicode` before reaching the generic data model;
- terminal representation/discrimination is changing with the bigint symbol and
  `TerminalRange` migration, so consumers must not assume a terminal is detected
  by `typeof rule === 'number'`.

This TODO must be rebased on the final post-migration `Rule` union before its
encoding or dispatch logic is implemented. `Repeat` still needs a serializable,
unambiguous data representation, but this task does not choose that representation
until the blockers settle the surrounding rule discriminants.

### Proposal

After the blocking rule-model migrations land, introduce a `repeat` primitive in
the **data** representation only and detect it during `toData` transformation.
The functional/thunk representation remains unchanged: `repeat0Plus(x)` may still
expand to the same right-recursive grammar at authoring/runtime level.

The post-migration `Repeat` representation must:

- be serializable pure data;
- be unambiguous against the final `Variant`, `Sequence`, and terminal-range
  representations;
- not reintroduce raw `string` as a generic rule kind;
- be dispatched by the final rule discriminants rather than old JavaScript
  primitive-type assumptions.

#### Scope: only `min = 0`, only unambiguous cases

- **No `min` parameter for now.** `repeat` means 0-or-more.
- Detect only obviously-list-shaped recursion: an empty base branch plus a
  recursive branch exactly equivalent to `[item, self]`, with no other
  self-reference.
- Leave ambiguous right-recursive shapes such as operator-style trees and
  separated lists in their ordinary recursive representation until an explicit
  schema/action mechanism identifies them as arrays.

#### Parser output: flat array

Once parser backends recognize the final `repeat` node, they should match its
inner rule zero or more times iteratively and emit a flat `AstSequence` of the
matched items rather than the nested right-recursive cons structure.

### Tasks

- [ ] Keep this TODO blocked until the alphabet split, bigint symbol/range
      migration, and semantic-action design establish the final generic `Rule`
      discriminants.
- [ ] Rebase the proposed `Repeat` encoding on that final `Rule` union; do not use
      a bare `string` generic rule or `typeof rule === 'number'` terminal dispatch.
- [ ] Choose a serializable `Repeat` representation that is unambiguous against
      the final generic rule variants.
- [ ] Update every rule-dispatch site using the final discriminants.
- [ ] Detect the unambiguous 0-or-more shape during `toData` and emit `repeat`.
- [ ] Make `descentParser` / `parserRuleSet` match `repeat(item)` iteratively and
      emit a flat `AstSequence` of items.
- [ ] Add proofs that `repeat0Plus`-built and hand-written unambiguous 0-or-more
      lists become a repeat node and parse to a flat AST, while ambiguous
      right-recursive trees/separated lists remain unchanged.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — removes raw
  `string` from the generic rule model and therefore blocks the old encoding.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — changes terminal/range
  representation assumptions used by the old dispatch example.
- [BNF semantic actions](./207.md) — origin of the flat-list/action motivation.
- `fjs/bnf/data/module.f.mjs` — owns the data `Rule` representation and dispatch.
- `fjs/bnf/module.f.mjs` — owns BNF combinators such as `repeat0Plus`.
