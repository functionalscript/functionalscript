# TODO

## 32. Implement a stupid, non-deterministic parser.

**Priority:** P3
**Status:** open

Implement a stupid, non-deterministic parser using 031-formal-grammar.

---

## 42. Try mixing serializable BNFs.

**Priority:** P3
**Status:** open

---

## 43. Stateful parser.

**Priority:** P3
**Status:** open

```ts
const { init, append, end } = parser(ruleMap)
let state = init
state = append(state, 'hello world!')
const ast = end(state)
```

---

## 46. Implement an LR(1) parser.

**Priority:** P3
**Status:** open

Implement an LR(1) parser because LL(1) can't handle break lines in comments.

---

## Parser Structure

**Priority:** P3
**Status:** open

1. AST, the structure can contain function structures.
   - 1. w/o imports.
     ```ts
     type Ast = ...
     const parseSync: (ioContext: IoContext) => (fileName: string) => Ast = ...
     const astToSourceCode: (ast: Ast) => string = ...
     const astToByteCode: (ast: Ast) => bigint = ...
     ```
   - 2. with imports. A temporary structure. Module resolver with I/O can convert AST with imports into AST without imports.
     ```ts
     type ModuleAst = ...
     const parseModule: (s: string) => ModuleAst = ...
     ```
2. JS value.
   - any JS value w/o functions can be converted to AST w/o imports.
     ```ts
     type JsonPrimitive = number | boolean | string | null
     type Json = { readonly[k in string]: Json } | readonly Json[] | JsonPrimitive
     type DjsPrimitive = JsonPrimitive | undefined | bigint
     type Djs = { readonly[k in string]: Djs } | readonly Djs[] | DjsPrimitive
     const toAst: (djs: Djs) => Ast = ...
     const astToDjs: (ast: Ast) => Result<Djs> = ...
     const djsToJson: (djs: Djs) => Result<Json> = ...
     ```
   - any AST w/o imports can be converted to JS value
     ```ts
     const Fjs = { readonly[k in string]: Fjs } | readonly Fjs[] | DjsPrimitive | (...a: readonly Fjs) => Fjs
     const astToFjs: (toFunc: (s: string) => Function) => (ast: Ast) => Fjs = ...
     const fjsToAst: (magicFunction: (f: Function) => string) => (fjs: Fjs) => Ast = ...
     ```

---

## Layered Parser

**Priority:** P3
**Status:** open

A tokenizer accepts a sequence of code-points as input tokens together with meta information (file name, position). It uses our BNF parser to output new tokens.

Each token type is represented by a single symbol, e.g. `s` for string, `n` for number, `i` for identifier. All other information (actual value, position, etc.) is carried as meta information. This sequence of tokens is then the input into a new parser layer.

```
code-points + meta ==BNF==> tokens(symbol + meta) ==BNF==> AST
```

Both layers reuse the same BNF engine.

### Open Questions

- **Keyword disambiguation**: identifiers and keywords may share the same symbol. Options: separate token type per keyword, or grammar rules that inspect meta info.
- **Meta info propagation**: when the upper parser reduces a sequence of tokens, how does meta info (e.g. source span) combine into the parent node?
- **Error reporting**: lower-layer errors (bad token) and upper-layer errors (bad structure) need a unified error representation that carries the right meta info.

---

## 207. BNF semantic actions: attaching transform functions to grammar rules

**Priority:** P3
**Status:** open

> **Status — to be split.** This issue has grown to cover several independently
> implementable pieces (transparent `mapRule` + the grammar-directed fold §3.1–§3.2;
> the parser-neutral reduction algebra §3.3; the metadata monoid §3.4; list
> flattening via right-recursion detection §2.1; the RTTI value/output contract
> §5.2; and the instantiation-time `subset` check §5.3, gated on i143). Before
> implementation it should be split into multiple smaller tasks (one tracking
> issue plus per-piece sub-issues) with an explicit dependency order. **Do not
> split it yet** — this remains a single design document until the split is
> agreed.

### Goal

Let a grammar author attach a **transform function** (a *semantic action*) to a
BNF rule so that parsing a `Rule` yields a domain value instead of a generic
AST. The classic example is a JSON `string` rule that returns the decoded
JavaScript string (escapes resolved, surrounding `"` dropped), and an `object`
rule that receives its members' keys **already decoded as strings** by the
`string` rule's action.

Two properties are required:

1. **Compositional input.** A rule's action receives the *outputs of the
   actions of its child rules*, not raw code points. `object`'s action sees
   parsed key strings and parsed values, never the `"`…`"` framing or the
   escape machinery.
2. **Type safety.** The action's input must match what the children actually
   produce, and its output must match what the parent expects. Doing this in
   plain TypeScript turns out to be impractical for real (cyclic) grammars
   (§4); the fallback is to declare each action's input/output with an RTTI
   schema (`fs/types/rtti`) and check the boundary at runtime (§5).

This document is a design only. No implementation is proposed here beyond the
hypotheses actually tested in §4.

### 1. Background: rule kinds and the AST

A functional grammar rule (`fs/bnf/module.f.ts`) is one of four shapes, behind
an optional lazy thunk:

```ts
type DataRule = Variant | Sequence | TerminalRange | string
type Rule     = DataRule | (() => DataRule)
```

- `TerminalRange` — a packed `[lo, hi]` code-point range; matches one symbol.
- `string` — sugar that expands into a `Sequence` of single-symbol terminals.
- `Sequence` (`readonly Rule[]`) — match children in order.
- `Variant` (`{ [tag]: Rule }`) — ordered alternation; the matched branch's key
  is the `tag`.

The combinators (`option`, `repeat0Plus`, `repeat1Plus`, `join0Plus`, …) are
just helpers that build `Variant`/`Sequence` trees, e.g. `option(x) = { some:
x, none: [] }` and `repeat0Plus(x) = () => option([x, self])`.

`parser`/`descentParser` (`fs/bnf/data/module.f.ts`) produce a generic AST:

```ts
type AstRule = { readonly tag: AstTag, readonly sequence: AstSequence }
type AstSequence = readonly (AstRule | CodePoint)[]
type AstTag = string | true | undefined   // variant key | sequence | empty
```

So the AST is a tree of `{ tag, sequence }` nodes whose leaves are code points.

**Key observation.** An `AstRule` node records the *variant tag* that matched,
but **not the name of the rule that produced it**. A `Sequence` rule yields
`{ tag: undefined, sequence: [...] }` with no back-link to, say, `member`.
Therefore actions cannot be applied by a post-hoc walk that only sees the AST —
the evaluator must walk **in lockstep with the grammar**, carrying the rule
definition alongside the AST node. This shapes the whole design (§3).

### 2. The raw output of a rule

Define the *raw output* of a rule as the structural value it would produce with
**no** action attached. This is the natural shape an action transforms *from*:

| Rule kind        | Raw output                                              |
|------------------|---------------------------------------------------------|
| `TerminalRange`  | the matched code point (`number`) — or its 1-char string |
| `string` literal | the literal string                                      |
| `Sequence`       | a tuple of the children's *effective* outputs           |
| `Variant`        | a tagged value `{ tag, value }` (a discriminated union) |

The *effective output* of a child is its action's output if it has one, else
its raw output. Effective outputs compose bottom-up: the parent's raw tuple
slot for a child is exactly that child's effective-output type. This recursion
is what makes "the object rule receives decoded key strings" fall out
automatically — `member`'s `string` slot is `string`'s *effective* output
(decoded), not its raw `["\"", chars, "\""]`.

#### Eliding noise (literals and whitespace)

Most sequence elements an action does not care about are fixed literals (`"`,
`{`, `:`) and whitespace rules. Two complementary mechanisms:

- **Positional, author elides.** The action receives the full raw tuple and
  destructures what it wants: `([, chars]) => decode(chars)`. Simple, explicit,
  no new concept. This is the default.
- **`unit` output.** A rule whose action returns a designated `unit` value (or
  a rule marked *silent*) contributes nothing to the parent tuple, so
  `[ws, string, ws, ':', ws, json]` collapses to `[key, value]`. This is sugar
  over the positional model and can be deferred to a v2.

The JSON worked example (§6) uses the positional model.

#### 2.1 List rules: flattening right-recursion

> The unambiguous, schema-free part of this section — detecting 0-or-more
> right-recursion during `toData` and emitting a `repeat` primitive so the
> parsers produce a flat AST — is split into
> [i667-bnf-repeat-flatten](todo.md). The opt-in for the
> *ambiguous* cases (list vs. right-associative tree) via the `array(itemSchema)`
> action schema remains here (§5).

"Repeat" is **not** a BNF primitive — the four shapes are only
`Variant | Sequence | TerminalRange | string`. Only the fixed-count `repeat(n)`
is flat (it expands to a `Sequence` of `n` copies). Every *unbounded*
repetition is encoded as **right-recursion**, whether built by a combinator or
written by hand:

```ts
repeat0Plus(x)  // r = () => option([x, r])  ⇒  Variant { some: [x, r], none: [] }
// hand-written, no helper:
characters = () => ({ none, characters: [character, characters] })   // 0-or-more
members    = () => ({ member, members: [member, ',', members] })     // 1-or-more
digits     = () => [digit, digits0]                                  // 1-or-more
```

By §2 these produce a right-nested cons list — `{tag:'some', value:[x0,
{tag:'some', value:[x1, {tag:'none', value:[]}]}]}` — i.e. nested `{tag, value}`
objects wrapping 2-tuples, not the flat `[x0, x1, …]` an action wants.

**Chosen approach: recognize the right-recursion structurally**, rather than
relying on a marker emitted by a helper combinator. This way a list written
directly as a recursive `Variant`/`Sequence` (the classic-JSON style above) is
flattened identically to one built with `repeat0Plus` — the combinators get no
special treatment, because there is nothing to special-case.

**Detection.** Analyze tail-position recursion over the rule-reference graph: a
rule `L` is *list-like* when every recursive reference within its
strongly-connected component occurs in **tail position** (the last element of a
`Sequence`, possibly through a thunk). For each branch:

- split the branch's sequence into a **prefix** and an optional **tail** that
  references back into `L`'s recursion group;
- the prefix, after noise elision (§2 — fixed literals / silent rules drop out),
  is *one item*; the tail recurses.

Base branches (no tail) contribute their prefix item and stop; recursive
branches contribute one item and continue. This covers all three shapes above:
`characters` (empty base + `[character, ·]` tail), `members` (single-item base +
`[member, ',', ·]` tail — the `,` elides), and the two-rule `digits`/`digits0`
split (the tail reference points into the *other* rule of the same list group).
A self-reference in **non-tail** position (e.g. `value` inside `object`/`array`)
means the rule is a *tree*, not a list, and is left un-flattened.

**Flattening** is then an unfold performed during the §3.2 fold: walk the
matched branch, emit its prefix item, follow the tail, stop at a base branch —
producing a flat `array` whose element is the (homogeneous) item's effective
output. The parser and generic AST are untouched; this is purely how the *raw
output* of a list-like rule is assembled (a fifth raw-output kind, "list",
layered onto §2's table).

**The fundamental limitation — and the opt-in that resolves it.** A flat list
and a *right-associative tree* share the **same grammar**: `a = [x, '+', a] | x`
is structurally indistinguishable from a separated list `x ('+' x)*`, yet an
operator grammar wants the nested tree, not `[x, x, x]`. Structural detection
alone therefore cannot decide whether to flatten. The resolution is to make
flattening **opt-in via the action's RTTI schema (§5)**: detection establishes
that a rule *can* be presented as a list, and declaring its `in`/`out` as
`array(itemSchema)` requests it; absent that, the nested raw output is preserved
(right-associative trees keep working). The §5.3 instantiation-time check
verifies the unfolded item schema actually matches the declared `array`
element — so a mis-detected or mis-shaped list fails at construction. This also
subsumes the rejected "combinator marker" option: a combinator can simply
declare the `array` schema on the author's behalf, which is the same opt-in done
for you.

### 3. Where actions attach and how they run

#### 3.1 Attachment

Two options were considered.

- **(A) Name-keyed action map.** A side table `{ [ruleName]: Action }` keyed by
  the same names `toData` derives from `fr.name`. Pro: leaves the grammar
  untouched, mirrors the serializable data form (rules referenced by name).
  Con: relies on every actioned rule being a *named* thunk; anonymous inline
  rules can't be targeted; name collisions are resolved by `newName` (the data
  builder appends `0`, `1`, …), so the key the author writes may not survive.
- **(B) `mapRule(rule, action)` combinator.** Wrap a rule in a node that
  carries its action, colocating grammar and semantics and giving TS a place to
  attach (or try to attach, §4) types. Con: introduces a new `Rule` variant
  that every existing consumer (`toData`, `dispatchMap`, both parsers) must
  learn to skip; the action must be *transparent* to parsing.

**Recommendation: (B), made transparent.** A `mapRule` wrapper keeps the action
next to the rule it transforms (matching the codebase's separation-of-concerns
ethos) and avoids the fragile name-key contract. The wrapper is erased before
parsing: `toData` (and `descentParser`) unwrap `mapRule(r, _) → r` exactly as
they already unwrap a lazy thunk, recording the action in a parallel
`name → Action` map for the evaluator. So parsing is unchanged; only a new
**evaluator** consumes the actions.

#### 3.2 Evaluation: a grammar-directed fold

Because AST nodes don't carry rule identity (§1), the transform is **not** a
plain AST catamorphism. It is a fold that threads *both* the rule definition and
the AST node:

```
eval(rule, astNode) -> value
  TerminalRange : value = codePoint(astNode)          ; apply action if any
  string        : value = literal                     ; apply action if any
  Sequence      : value = rule.map((r,i) => eval(r, astNode.sequence[i]))
                                                        ; apply action to tuple
  Variant       : branch = rule[astNode.tag]
                  value  = { tag, value: eval(branch, matchedChild) }
                                                        ; apply action
```

This is essentially the existing `descentParser`/`parserRuleSet` walk with a
result accumulator — the grammar shape and the AST shape are isomorphic by
construction, so the walk can't desync.

Two integration strategies:

- **Fold over the AST (recommended).** Keep `parser` pure (code points → AST),
  add a separate `evaluate(grammar, actions)(ast)` pass. Separation of concerns;
  the same AST stays reusable (e.g. for the layered tokenizer in
  [i165](todo.md)); the fold is testable in isolation.
- **Semantic actions inlined into the parser.** The parser applies actions as
  it reduces, never materializing the generic AST. Faster, but couples parsing
  and evaluation and duplicates the walk. Defer unless profiling demands it.

#### 3.3 Parser-agnostic evaluation: a reduction algebra

A core design principle of this repository is a clean three-way split:

- **one grammar definition** — the functional `Rule` form (`fs/bnf/module.f.ts`);
- **one serializable form** — the function-free data form (`fs/bnf/data`);
- **many parsers** — LL(1) (`parserRuleSet`), recursive descent
  (`descentParser`), and potentially LR(1), LR(k), GLR, … each a separate
  consumer of the same grammar/data.

Semantic actions and metadata must respect that split: they belong to **neither**
the grammar definition nor any single parser. So the design does **not** bake
evaluation into the LL(1) walk. Instead, evaluation is an **algebra** over
parser-neutral reduction events:

```
type Semantics<R> = {
    leaf:   (token) => R                       // a shifted terminal / token
    reduce: (rule, tag, children: R[]) => R    // a completed rule
}
```

Every parser kind, however it works internally, ultimately *shifts* terminals
and *reduces* rules — top-down (LL/recursive descent) or bottom-up
(LR/shift-reduce). Driving a `Semantics<R>` from those events decouples actions
and metadata from the parser entirely:

- The materialized `AstRuleMeta<T>` tree is just the **free / identity** algebra
  (`reduce` builds a node, `leaf` keeps the token). §3.2's fold-over-AST is
  "build the free algebra, then interpret it".
- The value+metadata evaluation (§3.4) is another `Semantics<R>` with
  `R = (value, meta)`. An **LR** parser drives the same algebra directly on each
  reduce — no intermediate AST — which is exactly the "inlined" strategy above,
  obtained for free rather than by duplicating a walk.

So `Semantics<R>` is the parser↔semantics contract; swapping LL(1) for LR(k)
changes which engine emits the shift/reduce events, not the actions, the
metadata merge, or the RTTI schemas. (The grammar-directed nature noted in §3.2
still holds: `reduce` receives the `rule` and `tag`, supplying the rule identity
the bare AST lacks.)

#### 3.4 Metadata: always carried, user-merged

Parsing must **always** carry a metadata channel alongside the value channel —
this is not optional and not the same as a semantic action. `descentParser`
already threads it at the leaves (`CodePointMeta<T> = readonly[CodePoint, T]`);
the missing piece is **merging** it as reductions combine children. The author
supplies that merge as part of the semantics:

```
type Meta<M> = {
    leaf:  (token) => M          // e.g. a source position → a one-point Range
    merge: (a: M, b: M) => M     // associative; e.g. Range union
    empty: M                     // identity for empty / `none` branches
}
```

`(leaf, merge, empty)` form a **monoid**: `merge` is associative with `empty` as
identity, so empty matches (`none`, optional, the base of a list) contribute
`empty` and vanish under `merge`. The canonical instance maps each input
position to a `Range` (`[start, end]`) and `merge` takes the union (`min start`,
`max end`), so every node automatically acquires the source span covering all
its leaves. Metadata flows up **whether or not a rule has a value action** — it
is the `reduce` step folding children's `M` via `merge`, independent of the
value channel.

**Metadata carries information forward across parser layers.** This is the
mechanism behind the layered parser ([i165](todo.md)): a
tokenizer reduces code points into tokens whose *value channel* is a single
grammar-relevant **symbol** (`i` for identifier, `s` for string, `n` for number)
while the *actual lexeme* (the identifier text, the decoded string) and its span
ride in `M`. The next layer's grammar (e.g. parsing a function) matches only on
the symbols — it neither sees nor cares about the lexeme — yet an action at that
layer can still read the carried value out of `M` when it needs it (e.g. to put
the identifier's name into the AST node). Each layer supplies its own
`Meta<M>`; the mechanism is uniform across layers.

So a full evaluation is a `Semantics<R>` with `R = readonly[value, M]`:
`reduce` computes `value` via the rule's action (§3.1, over children's values)
and `meta` via `merge` over children's metas; `leaf` seeds both from the token.
The value channel is what RTTI schemas (§5) describe and check; the metadata
channel is orthogonal — user-defined type, user-defined monoid — and is never
dropped.

Because metadata is **automatically** attached to every input symbol and to
every produced (transformed) symbol — and merged without any per-action work —
the rest of this document (diagrams, schemas, `fn` signatures) shows only the
value channel for simplicity. Assume `M` rides alongside every value implicitly;
an action only mentions it when it actually reads it (§7).

### 4. Type checking in TypeScript — what actually works

The hope is that `mapRule(rule, action)` could *infer* `action`'s parameter
type from `rule`'s structure, so the action is statically checked. I tested how
far the existing combinators carry precise types.

**Hypothesis 1 — acyclic, unannotated fragments keep precise types. ✅**
`repeat0Plus`, `option`, `range`, etc. are generic (`<T extends Rule>`), so for
an acyclic fragment the inferred types are exact:

```ts
const digit  = range('09')          // number
const digits = repeat0Plus(digit)   // Repeat0Plus<number>
const optD   = option(digit)        // Option<number>
// Repeat0Plus<number>, Option<number> assignability all type-check.
// A `@ts-expect-error` on an extra struct key in a small recursive
// `const value = () => ({...})` / `const arr = [...] as const` pair fires,
// proving structure is retained.
```

**Hypothesis 2 — real cyclic grammars cannot stay unannotated. ❌**
Reproducing the JSON shape from `fs/fsc/json.f.ts` *without* the `: Rule`
annotations fails to compile:

```ts
const string    = ['"', repeat0Plus(character), '"'] as const
const character = () => ({ c: range('  '), esc: ['\\', escape] })
//                                  ^ string (line above) eagerly calls
//                                    repeat0Plus(character) before character
//                                    is declared:
// TS2448 Block-scoped variable 'character' used before its declaration.
// TS2454 Variable 'character' is used before being assigned.
```

A `() =>` thunk defers *runtime* evaluation, but an **eager** combinator call on
a forward reference (`repeat0Plus(character)`) is a value-position use that TS
flags in the temporal dead zone. Real grammars are mutually recursive
(`json → object → member → json`), so such forward references are unavoidable.

**Consequence.** The codebase's actual workaround — annotate every rule
`const string: Rule = …` — breaks the inference cycle but **erases all
structure to `Rule`**. Once a rule is `Rule`, `mapRule` has nothing precise to
infer an action signature from. The two escape hatches both fail in practice:

- Wrap *every* cross-reference in a thunk and never call a combinator eagerly on
  a forward ref — viral, unergonomic, and the inferred types balloon to
  unreadable recursive tuples that blow up `tsc`.
- Keep `: Rule` annotations — structure is gone.

**Verdict: do not rely on TypeScript to type the grammar↔action boundary.**
Precise static typing is feasible only for small acyclic helper rules; it
collapses for any realistic cyclic grammar. We need a runtime contract instead.

### 5. RTTI as the type-checking contract

RTTI (`fs/types/rtti`) already gives us exactly the missing piece: a runtime
schema (`Type`) that **also** projects to a static TypeScript type via
`Ts<schema>`. The design uses it on both sides of every action:

```ts
mapRule(rule, {
    in:  InSchema,                 // RTTI Type describing the raw input
    out: OutSchema,                // RTTI Type describing the action's output
    fn:  (x: Ts<typeof InSchema>): Ts<typeof OutSchema> => …,
})
```

This splits the problem cleanly:

- **Inside an action**, the body is *fully statically typed*: `fn` is checked as
  `Ts<InSchema> → Ts<OutSchema>`. The author writes ordinary typed code. No
  `Rule`-erasure problem, because the type comes from the schema, not the
  grammar.
- **At the grammar↔action boundary**, where TS can't help (§4), the contract is
  checked dynamically. The naive form (§5.2) `validate`s/`parse`s the assembled
  raw input against `InSchema` before each `fn` call; on success the value is
  safely `Ts<InSchema>`. But most of this check can be lifted to a **one-time
  check at grammar instantiation** (§5.3) instead of running per parsed node.

`fs/types/rtti/validate` (`validate(schema)(value) → Result`) and
`fs/types/rtti/parse` (`parse(schema)(value)` — builds a fresh, closed value)
are both directly usable; `parse` is the better fit because it already
normalizes containers and drops undeclared slots.

#### 5.1 Schemas compose the same way outputs compose

The raw-input schema of a rule is *derivable from its kind* (§2), with child
slots filled by each child's **effective output schema**:

```
effectiveSchema(rule) = action.out          if rule has an action
                      = rawSchema(rule)      otherwise

rawSchema(TerminalRange) = string            // or number, see §2
rawSchema(string)        = that string literal (a Const schema)
rawSchema(Sequence rs)   = readonly[ effectiveSchema(r) for r in rs ]   // Tuple
rawSchema(Variant v)     = or( ...{ tag, value: effectiveSchema(branch) } )
```

So an action's `in` schema should equal `rawSchema(rule)` computed with
children's *effective* schemas — which is precisely "the object rule's key slot
is `string`'s decoded output". This gives two payoffs:

1. `action.in` can be verified compatible with the derived raw schema, catching
   a mis-wired action *structurally* — either per node at parse time (§5.2) or,
   better, once at grammar instantiation (§5.3).
2. The raw schema can be **auto-derived** and offered as the default `in`, so an
   author only writes `in` when narrowing (e.g. asserting a `repeat0Plus`
   produced a non-empty list). This keeps boilerplate down.

#### 5.2 Naive form: validate per parsed node

The straightforward implementation runs the boundary check during evaluation:
before invoking each `fn`, `validate`/`parse` the assembled raw input against
`InSchema` (and optionally the result against `OutSchema`). This is correct and
needs no new RTTI primitive, but it pays the cost on *every* parsed node and
only surfaces a mis-wired action when an input happens to reach that branch.

#### 5.3 Lifting the check to grammar instantiation

RTTI is doing **two distinct checks** here, and only one is inherently
per-parse:

1. **Schema-vs-schema compatibility** — does `action.in` match the *raw schema
   derived from the rule's structure* (§5.1, each child slot filled by that
   child's effective `out`)? This depends only on **grammar + actions**, never
   on input, so it can run **once, when the grammar is instantiated**.
2. **Value-vs-schema validation** — does an actual parsed value conform to
   `in`? This is the §5.2 per-node check.

The key fact: **if (1) holds, (2) is redundant.** If `rawSchema(rule)` is
provably a subtype of `action.in` for every actioned rule, then every value the
grammar can produce at that node is already a valid `Ts<in>` by construction, so
the per-node validation can be dropped (kept only as optional debug
assertions). This is the compile-once-vs-cast-everywhere distinction: prove the
pipeline sound once instead of re-checking each value.

**What it requires that RTTI doesn't have yet.** A schema-vs-schema
`subset`/`assignable(rawSchema, in): boolean` predicate. Today RTTI exposes only
`validate`/`parse` (value-vs-schema); there is no subtyping relation. This is
exactly the `equal`/`subset` algebra planned on the function-free data form in
[i143](../types/todo.md), so instantiation-time grammar checking is a natural
*consumer* of i143 and should be gated on it.

Two wrinkles for the predicate:

- **Recursion.** Grammars are cyclic, so `rawSchema` is a recursive schema and a
  structural `subset` must be coinductive (assume-equal on cycle) or it loops.
  *But* a declared `out` cuts the recursion: when deriving a parent's raw
  schema, an actioned child contributes its author-declared `out`
  (self-contained), not its expansion. As long as every grammar cycle passes
  through at least one actioned rule, the derivation terminates by plain
  induction — `out` schemas play the cycle-cutting role that `: Rule`
  annotations play for TS inference (§4), but *without losing information*,
  since the author supplied the type. (A cycle with no actioned rule transforms
  nothing, so its raw schema is just the generic AST shape — fine.)
- **Shared traversal.** Deriving `rawSchema` walks the grammar the same way
  `toData` does; share that walk rather than duplicating it.

**What stays at parse time regardless.** Anything the raw schema can't express:

- **Author-declared narrowing** — if `in` is *stricter* than the derivable raw
  schema (e.g. "a number that fits in u32" where the grammar only guarantees
  "non-empty digit list"), that delta is unprovable at instantiation and remains
  a runtime assertion (or is rejected as unprovable).
- **Precision gaps** — RTTI can't say "non-empty array", so a `repeat1Plus`
  action assuming non-emptiness keeps a runtime check.
- **Data-dependent action logic** (overflow, semantic checks) — always runtime,
  but that is the action body's own concern, not the RTTI boundary.

**Net effect.** Cost moves from O(parsed nodes) to O(actioned rules), once, and
a mis-wired action surfaces at grammar construction instead of on the first
input that reaches its branch. Recommended target once i143 lands; until then,
ship the §5.2 per-node form.

#### 5.4 Cost

Validating every node at parse time (§5.2) is not free. Mitigations: validate
only at rules that *have* an action (untransformed subtrees pass through
structurally); allow `in`/`out` to be omitted to skip the check for hot, trusted
rules; or run full validation in a debug build and trust the schemas in release.
§5.3 removes the per-node cost outright once the `subset` predicate exists. The
allocation/short-circuit trade-offs of `validate` vs `parse` are already
discussed in [i172](../types/todo.md).

#### 5.5 Principle: all transformer schemas are validated at parser instantiation

§5.3 lifts *one* check (the list-item/`array` case) to instantiation time. State
it as a general principle: **every transformer's schema is validated once, when
the parser is instantiated — not during parsing.** Concretely, instantiation
verifies, for each actioned rule:

1. **name resolution** — every actioned rule name (and every rule it references)
   exists in the grammar; and
2. **shape compatibility** — the transformer's `in` schema matches the rule's
   *raw-output* shape (the §2 table, including the §2.1 "list" kind), and its
   `out` matches what the parent consumes (§5.1).

**Why instantiation is the right phase.** The structural analysis this design
already performs at runtime — cycle detection and the §2.1 tail-position/list
recognition — runs exactly once, when the parser is built, and is precisely when
each rule's raw-output shape becomes known. Folding transformer-compatibility
into that same pass adds no new traversal: it confronts each declared `in`
against the shape it will actually receive at the one moment both are available.

**Runtime failure here is acceptable — indeed preferable.** A mis-wired
transformer is a programming error. Failing at construction means it surfaces
immediately, deterministically, and on *every* run, before any input is parsed —
not mid-parse on whatever input first reaches the bad branch. The cost is paid
once per parser (O(actioned rules)), never in the parse hot path, so the check
can afford to be thorough.

**Relation to the compile-time check.** This *complements*, not replaces, the
`Ts<>` static check. For statically-written grammars TypeScript already verifies
most wiring at compile time; the instantiation-time check is the backstop for
what the type system cannot see — chiefly the structurally-detected "list"
raw-output kind (TS has no idea a rule is list-like) and any dynamically
assembled grammar or name-keyed action map.

The *mechanism* for the shape-compatibility half is the schema-vs-schema
`subset` predicate of §5.3, gated on [i143](../types/todo.md); until it lands,
the per-node §5.2 form is the fallback and name resolution can still be checked
at instantiation independently.

### 6. Worked example: JSON

Using the grammar from `fs/fsc/json.f.ts` (`character`, `escape`, `string`,
`member`, `object`, …) and the positional elision model:

```ts
// escape: { '"' | '\\' | '/' | 'b'|'f'|'n'|'r'|'t' | u: ['u',h,h,h,h] }
//   raw input  = or('"','\\','/','b','f','n','r','t',
//                    { tag:'u', value: readonly[hex,hex,hex,hex] })
//   out        = string   (the single decoded character)
escape.fn = e =>
    e.tag === 'u' ? String.fromCodePoint(hex4(e.value)) : escMap[e]

// character: { ...nonEscape ranges, '\\': ['\\', escape] }
//   out = string (one decoded char). The '\\' branch's value is escape.out.
character.fn = c => c.tag === '\\' ? c.value[1] : codePointToString(c.value)

// string: ['"', repeat0Plus(character), '"']
//   raw input = readonly['"', readonly string[], '"']   (chars already decoded)
//   out       = string
string.fn = ([, chars]) => chars.join('')

// member: [string, ws0, ':', ws0, json, ws0]
//   raw input = readonly[string, Ws, ':', Ws, JsonValue, Ws]
//   out       = readonly[string, JsonValue]
member.fn = ([key, , , , value]) => [key, value] as const

// object: ['{', ws0, join0Plus(member, separator), '}']
//   out = { readonly [k: string]: JsonValue }
object.fn = m => Object.fromEntries(collectMembers(m))
```

`object` never sees a quote, an escape, or whitespace — only decoded
`[key, value]` pairs, because each child rule's *effective* output is what flows
up. Each `fn` is statically typed via `Ts<…>`; the evaluator guards the
boundaries with the RTTI schemas.

> **Note — metadata is implicit here.** The schemas and `fn` signatures above
> show only the **value channel**. Metadata (§3.4) is *automatically* attached
> to every input symbol and to every produced (transformed) symbol, and merged
> by the user's monoid as reductions combine — it rides alongside each value
> without appearing in the action's type or body. We omit it from these
> examples (and from the diagrams/symbols elsewhere) purely for readability; an
> action that needs it (e.g. to attach a source span, or to read a lexeme
> carried from a lower parser layer) receives it via the optional second
> argument from §7.

### 7. Open questions

- **Terminal output: `number` or 1-char `string`?** Code points are numbers
  internally; most actions want strings. Pick one default (lean: string) and a
  helper for the other.
- **Variant encoding.** `{ tag, value }` discriminated union vs. a bare value
  plus a separately-passed tag. The discriminated union types best under
  `Ts<or(...)>` and matches RTTI's `or`.
- **Metadata API surface (designed in §3.4, details open).** How does a value
  action *read* the merged `M` of its node (for the layered-parser lexeme
  carry)? Likely a second, optional argument so the common value-only action
  stays clean. Also: does `Meta<M>` need a per-rule hook, or is the single
  `(leaf, merge, empty)` monoid plus the carried token value enough?
- **Auto-derived vs. explicit `in` schema.** How much to auto-derive (§5.1)
  before an author must write `in`. Deriving the raw schema needs the same
  grammar walk as `toData`; worth sharing that traversal.
- **Failure semantics.** An action can reject input the grammar accepted (e.g.
  a number that overflows). Does a rejected `out`-validation surface as a parse
  error with a path, reusing `ValidationError` from
  [i172](../types/todo.md)?
- **Where the evaluator lives.** A new `fs/bnf/eval` (or `fs/bnf/action`)
  module, registered in `deno.json` per AGENTS.md.

### 8. Decision

Pursue **(B) transparent `mapRule` + grammar-directed fold (§3)** with the
**RTTI contract (§5)** as the type-safety mechanism; do **not** attempt to type
the grammar↔action boundary in TypeScript (§4 shows it cannot survive cyclic
grammars). Start with the positional elision model and explicit `out` schemas,
and the per-node boundary check (§5.2). Treat **instantiation-time validation of every transformer schema as a
principle** (§5.5): the parser already analyzes cycles and list structure once at
construction, so transformer compatibility is checked in that same pass and fails
at construction rather than mid-parse (runtime failure is acceptable because it
is pre-parse). Once the RTTI `subset` predicate from
[i143](../types/todo.md) exists, lift the shape-compatibility half to grammar
instantiation (§5.3) so it costs O(actioned rules) once; until then keep the
per-node §5.2 fallback while still resolving names at construction. Recognize repetition by **structural right-recursion analysis**
(§2.1) rather than a helper combinator, so hand-written and combinator-built
list rules flatten identically; gate the flattening on an `array(item)` schema
opt-in so right-associative trees are preserved. Define evaluation as a
parser-neutral **reduction algebra** `Semantics<R>` (§3.3) so the same actions,
metadata, and schemas run under any parser kind (LL(1), LR(1)/LR(k), GLR) —
never baked into one parser. Always carry a **metadata channel** merged by a
user-supplied monoid `(leaf, merge, empty)` (§3.4) — independent of the value
channel and never dropped — which doubles as the cross-layer value carrier for
the layered parser ([i165](todo.md)). Defer `unit`/silent rules,
schema auto-derivation, and parser-inlined actions to follow-ups once the fold +
a JSON action set exist as the first real consumer.

### Related

- [i165](todo.md) — layered parser. The metadata monoid (§3.4)
  is the mechanism for both its "how does meta propagate up a reduction" and
  "lower-layer values (lexemes) carried past the upper grammar" questions; the
  reduction algebra (§3.3) is the shared evaluation contract across layers.
- [i172](../types/todo.md) — `validate`/`parse` skeleton
  and `ValidationError`; the runtime checker this design leans on.
- [i143](../types/todo.md) — serializable RTTI data form and its planned
  `equal`/`subset` algebra; the predicate the instantiation-time boundary check
  (§5.3) depends on, and relevant if schemas are auto-derived from the BNF data
  form.
- `fs/fsc/json.f.ts`, `fs/bnf/testlib.f.ts` — the grammars used in §6.

---

## 665-bnf-data-fold-children. `bnf/data`: collapse `sequence`/`variant` onto one immutable child-fold

**Priority:** P4
**Status:** open

### Problem

`fs/bnf/data/module.f.ts` defines two `NewRule` builders, `sequence` and
`variant`, that walk a rule's children, register each child via `toDataAdd`, and
thread the resulting `FRuleMap`/`RuleSet` while building a result. They share the
same accumulation skeleton and differ only in (a) what they iterate and (b) how
the result is shaped:

```ts
// fs/bnf/data/module.f.ts:172
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

// fs/bnf/data/module.f.ts:184
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

- [ ] Add `foldChildren` (private) to `fs/bnf/data/module.f.ts`.
- [ ] Rewrite `sequence` and `variant` as instantiations of it.
- [ ] Confirm `fs/bnf/data/proof.f.ts` coverage still exercises both result
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

---

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

---

## 669-bnf-data-shared-helpers. Hoist and share repeated helpers in `bnf/data`

**Priority:** P4
**Status:** open

### Problem

`fs/bnf/data/module.f.ts` carries two distinct DRY / hoisting smells in its
parser machinery. Neither is covered by the existing fold-children work in
[i665-bnf-data-fold-children](todo.md) (that issue is
about the `sequence` / `variant` AST-fold helpers, a different pair of
functions).

#### 1. `mrSuccess` / `mrFail` match-result constructors

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

#### 2. `emptyTagMapAdd` branch duplication + mutable accumulators

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

### Proposal

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

### Tasks

- [ ] Hoist the shared `mr` constructor to module scope; update both `f` bodies.
- [ ] Extract a shared child-fold for `emptyTagMapAdd`; thread the accumulator
      immutably instead of reassigning `map` / `emptyTag`.
- [ ] Run `npx tsc`, `fjs t`, and confirm `fs/bnf/data/proof.f.ts` still passes
      with full coverage.

### Related

- [i665-bnf-data-fold-children](todo.md) — the adjacent
  `sequence` / `variant` AST-fold extraction (different functions, same module).
- [i667-bnf-repeat-flatten](todo.md) — other `bnf/data`
  cleanups.

---

