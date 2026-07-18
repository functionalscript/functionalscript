## 667-bnf-repeat-flatten. BNF: a `repeat` primitive in the data representation

**Priority:** P3
**Status:** open
**Blocked by:** [i207-bnf-semantic-actions](todo.md)

### Problem

Unbounded repetition in the BNF grammar is encoded as right-recursion — there
is no primitive `repeat` rule. The data `Rule` (in `fs/bnf/data/module.f.ts`)
has only three shapes: `Variant | Sequence | TerminalRange`. Helpers like
`repeat0Plus` expand to right-recursive `Variant` rules:

```ts
repeat0Plus(x)  // r = () => option([x, r])  →  Variant { some: [x, r], none: [] }
```

Hand-written repetition looks the same:

```ts
characters = () => ({ none, characters: [character, characters] })  // 0-or-more
```

So in the data form a list arrives as a right-nested cons structure of nested
`Variant`/`Sequence` rules rather than a single node that says "this is a
repetition." Every consumer (the fold evaluator from i207, a future code
generator, a TypeScript emitter) would otherwise have to re-derive that fact by
re-analyzing the rule graph.

**Concrete impact — stack overflow, not just a data-shape concern.**
`fs/bnf/descent/module.f.ts`'s `f` matcher mirrors this right-recursion at
*runtime*: for a `repeat0Plus`-built rule, matching each additional item is
one more nested call to `f` (sequence branch → variant branch → sequence
branch → …). Any right-recursive rule blows the JS call stack once the
repeated content is long enough — reproduced via `fs/djs/tokenizer`, whose
`id`/`digits0`/string-body rules are all `repeat0Plus`-based: tokenizing an
identifier around ~2,000–3,000 characters throws `RangeError: Maximum call
stack size exceeded` from inside `f`'s recursion
(`fs/bnf/descent/module.f.ts:137`/`151`), well before any other size limit
(e.g. `String.fromCodePoint`'s own argument-spread limit, which is
comfortably higher) would matter. This affects every `descentParser`
consumer with unbounded-length tokens, not just DJS. The "parser output:
flat array" part of this proposal — matching `repeat(item)` in a loop
instead of via recursion — is what actually fixes this; it's not solely a
serialization nicety.

A follow-up PR review (codex) found this is worse than "one long token":
`fs/djs/tokenizer/module.f.ts`'s *outer* token stream (`repeat0Plus(token)`
over the whole file) recurses the same way, so a file with many short
tokens crashes just as easily as one long token — `' '.repeat(5000)`
overflows, and the old tokenizer handled 20 KB comments the new one can't.
See [fs/djs/tokenizer/todo/stack-recursive-tokenization.md](../../djs/tokenizer/todo/stack-recursive-tokenization.md)
for the concrete repro and impact scope.

### Proposal

Introduce a `repeat` primitive into the **data** representation only, and detect
it during the `toData` transformation. The thunk (functional) representation is
**unchanged** — `repeat0Plus(x)` still expands to the same right-recursive
`Variant` at runtime. Only the serialized data form gains the new node.

#### Encoding: `repeat` is a bare `string`

A `Rule` is currently a `Variant` (object), a `Sequence` (array), or a
`TerminalRange` (number). A bare `string` is **not** yet a `Rule` shape — rule
names appear only *inside* `Sequence` / `Variant` values, never as a `Rule`
itself. So a bare string is a free, unambiguous discriminant:

```ts
/** The name of the rule to repeat (0 or more times). */
export type Repeat = string

export type Rule = Variant | Sequence | TerminalRange | Repeat
```

Dispatch checks `string` first, before the existing `number` / `Array` / `else`
chain, so no existing narrowing is touched:

```ts
if (typeof rule === 'string') { /* Repeat */ }
else if (typeof rule === 'number') { /* TerminalRange */ }
else if (rule instanceof Array) { /* Sequence */ }
else { /* Variant */ }
```

`Repeat` carries the inner rule's name — `repeat(itemName)` means "`itemName`,
zero or more times." It is serializable, so the data form stays pure data (the
whole point of this layer).

#### Scope: only `min = 0`, only unambiguous cases

- **No `min` parameter for now.** `repeat` always means 0-or-more. When we later
  detect `min > 0` (one-or-more), that is an acceptable breaking change to the
  encoding.
- **Only obviously-a-list cases.** A flat list and a *right-associative tree*
  share the same grammar (`a = [x, '+', a] | x` is structurally a separated
  list). Detection emits `repeat` only where the right-recursion can **only**
  mean repetition — e.g. an empty base branch (`none`) plus a recursive branch
  that is exactly `[item, self]` with no other self-reference. Ambiguous shapes
  (operator-style trees, separated lists) are left as the raw right-recursive
  `Variant` for now and revisited when an opt-in mechanism (i207 §5,
  `array(itemSchema)`) is in place.
- Consumers that do not yet understand `repeat` can treat it as the equivalent
  right-recursive `Variant` fallback.

#### Parser output: flat array

Once the parsers recognize `repeat`, they should also produce a **flat** AST for
it instead of the nested right-recursive structure. When `descentParser` /
`parserRuleSet` match a `repeat(item)` node, they match `item` zero or more times
in a loop and emit a flat `AstSequence` of the matched items — no nested
`{ tag, sequence }` cons wrapping. This is the payoff: the data node and the AST
both say "list," so downstream actions get `[x0, x1, …]` directly. The generic
AST shape is unchanged (still `{ tag, sequence }`); only how a `repeat` rule
fills its `sequence` differs (a flat run of items rather than a 2-element
`[item, rest]` nesting).

### Tasks

- [ ] Add `Repeat = string` and extend `Rule` in `fs/bnf/data/module.f.ts`
- [ ] Add the `typeof rule === 'string'` branch to every dispatch site
      (`dispatchMap`, `emptyTagMapAdd`, `descentParser`, `parserRuleSet`)
- [ ] Detect the unambiguous 0-or-more shape during `toData` and emit `repeat`
- [ ] `descentParser` / `parserRuleSet`: match `repeat(item)` in a loop and emit
      a flat `AstSequence` of items (no nested cons)
- [ ] Tests: `repeat0Plus`-built and hand-written 0-or-more lists become a
      `repeat` node and parse to a flat AST; right-associative trees and
      separated lists do not

### Related

- [i207-bnf-semantic-actions](todo.md) §2.1 — origin of this design; §5 for the future `array(itemSchema)` opt-in that will cover the ambiguous cases
- `fs/bnf/data/module.f.ts` — the data `Rule` type and all dispatch sites
- `fs/bnf/module.f.ts` — BNF combinators including `repeat0Plus`
