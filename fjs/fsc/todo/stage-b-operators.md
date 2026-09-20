## Stage B operators: `&&`, `||`, `??`, `?:`

**Priority:** P1
**Status:** open — Stage A is on `main` (see "Landed"), so nothing blocks this

### Problem

**This doc was written against [`#2089`](https://github.com/functionalscript/functionalscript/pull/2089)'s tree; Stage A landed on `main` in [`#2106`](https://github.com/functionalscript/functionalscript/pull/2106) in a different shape.** The ladder is
there — `tail`, threaded inline onto every branch of `value`/`body`, its
layers `multiplicativeOp` through `bitwiseOrOp` in
[`grammar/module.f.mjs`](../parser/grammar/module.f.mjs) — but under other
names than the ones this doc's proposal below still uses, which are
`#2089`'s. Read them through this table rather than searching for them:

| Named below, from `#2089` | On `main`, from `#2106` |
|---|---|
| `Op2Tag` in `parser/types.ts` | `BinaryTag` in [`ast/types.ts`](../ast/types.ts), which `parser/types.ts`'s `Node` imports |
| `AstOperation` | `AstBinary`, `readonly [BinaryTag, AstConst, AstConst]` |
| `leftAssocNode` | `toNode` and its `binaryOpTag` map in [`parser/module.f.mjs`](../parser/module.f.mjs), reading a `tail` round from any layer |
| `unaryNode`'s pending-list loop | `evaluate`'s explicit `_Stack` in the parser, and `lower`'s explicit stack in [`edag/module.f.mjs`](../edag/module.f.mjs) |
| `lowerBase` | `lower` in `edag/module.f.mjs` |
| `bitwiseOr` | `bitwiseOrOp`, the ladder's own top |
| the README's "operator ladder" section | the `tail` passage of [`parser/README.md`](../parser/README.md)'s "The grammar is written down" |
| `2340-operators.md`'s `Landed` column | its "Stage A is in the language" paragraph |

[`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md)
stages the operator rollout in three parts, and Stage A — arithmetic, strict
comparison, bitwise, all eager — is the only one landed. Stage B — `&&`,
`||`, `??`, `?:` — is the next stage `2340-operators.md` itself names; Stage
C (comma) is explicitly deferred until Stage B "has proven the general
approach" for lazy positions, so it is not this task's.

Unlike Stage A, Stage B is not a matter of widening the grammar and reusing
the existing eager lowering. Its operators are **lazy**: `a && b`'s `b` is
established only when `a` is truthy, `a ?? b`'s `b` only when `a` is
`null`/`undefined`, and `c ? t : e` establishes exactly one of `t`/`e`. That
changes what a reference through one of these operands means to the parts of
this front end that currently assume every reference is eager, most sharply
the module-level reachability sweep — see "The eager/lazy split" below,
which is the part of this task that is not just grammar plumbing.

The EDAG layer this compiles down to already admits all four operators and
already specifies their laziness precisely —
[`fjs/edag/module.f.mjs`](../../edag/module.f.mjs)'s `op2Id` includes `&&`,
`||`, `??` ("short-circuiting exactly as in JS: their right operand is
conditional, never established eagerly... laziness is positional, not
nodal") and `op3Id` is `?:` (`['?:', c, t, e]`, "the unselected arm is not
established *here*"). That schema and its semantics are **not** this task's
to design — they were settled by
[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
subject 3, "Lazy operators and the branch extension path," and are already
implemented and proved in `fjs/edag`. This task is the front end alone:
tokenizer, grammar, parser AST, and `fjs/fsc/edag`/`fjs/fsc/ast` lowering
that reach that existing schema — the same shape of work Stage A already did
for the eager half.

### Landed

What this once waited on is on `main`:

1. [`#2090`](https://github.com/functionalscript/functionalscript/pull/2090)
   (grouping) and
   [`#2092`](https://github.com/functionalscript/functionalscript/pull/2092)
   (unary minus as a grammar-level prefix), as `f005d51` and `8446f9a`.
2. Stage A's precedence ladder, restored over that grammar by
   [`#2106`](https://github.com/functionalscript/functionalscript/pull/2106)
   as `tail` — the shape the table above maps `#2089`'s names onto.
   Stage B's new layers sit directly above its top, `bitwiseOrOp`.

### Proposal

#### Tokenizer

Add `&&`, `||`, `??`, `?` as DJS operator tokens
([`fjs/fsc/tokenizer/types.ts`](../tokenizer/types.ts),
[`module.f.mjs`](../tokenizer/module.f.mjs)); `:` already exists (object
literals already use it). `fjs/fsc/README.md`'s tokenizer list already
carries `??` and `?.` as recognized JS lexical tokens — recognized is not
accepted, same distinction Stage A's own tokenizer work drew for `-`; `?.`
stays unparsed, out of scope here (optional chaining is
[`compile-modules-to-edag.md`](./compile-modules-to-edag.md) Stage 2's
"whenever optional chaining enters the source subset").

#### Grammar

JS keeps `??` mutually exclusive with `&&`/`||` at the same nesting — `a ??
b || c` is a `SyntaxError`, not a precedence question — by giving the two
their own productions rather than one shared ladder rung
(`ShortCircuitExpression: LogicalORExpression | CoalesceExpression` in the
spec). Naively splitting that into `shortCircuit ::= logicalOr | nullish`
is **not** LL(1): both alternatives start by parsing a `bitwiseOr` (`nullish`
directly, `logicalOr` through `logicalAnd`), so a parser reading the first
token cannot tell which alternative it is in — exactly the first/first
conflict `fjs/ebnf/ll1` would refuse before parsing any input, the same
class Stage A's own tokenizer/parser table in
[`fjs/fsc/README.md`](../README.md#both-grammars-are-ll1) already lists
several instances of. It needs the same fix that table's `delimited` row
used for the trailing comma: spelled right-recursively, so the shared
prefix is parsed exactly once and every later choice reads one token of
lookahead, never two competing productions that both start the same way.

```text
shortCircuit ::= bitwiseOr circuitTail
circuitTail  ::= '&&' bitwiseOr andTail      -- committed to && (|| may still follow)
               | '||' logicalAnd orTail      -- committed to || directly
               | '??' bitwiseOr nullishTail  -- committed to ?? (no && or || can follow)
               | ε
andTail      ::= '&&' bitwiseOr andTail
               | '||' logicalAnd orTail      -- `a && b || c` is `(a && b) || c`, still legal
               | ε                           -- no '??' arm: already committed away from nullish
orTail       ::= '||' logicalAnd orTail
               | ε
nullishTail  ::= '??' bitwiseOr nullishTail
               | ε
logicalAnd   ::= bitwiseOr ('&&' bitwiseOr)*
conditional  ::= shortCircuit ('?' value ':' value)?
```

Each nonterminal's alternatives are distinguished by exactly one lookahead
token (`&&`, `||`, `??`, or none of those), and once a chain has committed to
`&&`/`||` (`andTail`/`orTail`) or to `??` (`nullishTail`) neither tail rule
has an arm for the other's token, so `a && b ?? c` and `a ?? b || c` both
fail to parse at the unconsumed operator — refused by the grammar shape
itself, not a check layered on after. `logicalAnd` — the one piece that
never has to choose between operators, since `&&` is its only one — stays
the plain left-associative chain every Stage A layer above `unary` already
is, and reuses `leftAssocNode`
([`fjs/fsc/parser/module.f.mjs`](../parser/module.f.mjs)) directly wherever
it's read (inside `circuitTail`/`andTail`'s `||`-branches, and as
`nullishTail`'s `??`-chain reduces to the same shape). The
commit-to-one-branch tails above it (`circuitTail`/`andTail`/`orTail`/
`nullishTail`) are the new fold machinery this task actually adds — a
choice among named continuations, not a single operator repeated.
`conditional` is the one genuinely new shape beyond that: an optional,
right-nested `? value : value` after the short-circuit level, taking full
`value`s (not stopping at `shortCircuit`) for its two arms, matching JS's
`ConditionalExpression` branches being `AssignmentExpression`-level (this
language has no assignment expression, so `value` — the ladder's own top —
is the nearest equivalent) rather than another `conditional`; right
associativity of nested `?:`s falls out of the arms recursing into `value`
without needing a repeat construct. `conditional` becomes the new top of
`value`/`body`'s ladder, replacing today's direct route into `bitwiseOr`.

#### Parser / AST

`Op2Tag`
([`fjs/fsc/parser/types.ts`](../parser/types.ts)) gains `'&&' | '||' |
'??'`, mechanically identical to Stage A's other binary operators at the AST
level (`readonly [Op2Tag, readonly [Node, Node]]` already covers them — no
new `Node` shape, since laziness is not a shape difference at this layer any
more than it is one in the EDAG). A new `Op3Tag = '?:'` and a matching
`readonly ['?:', readonly [Node, Node, Node]]` case cover the conditional,
the AST's own arity-3 shape (`op3`'s three real operands, condition/then/else
— note this is three EDAG operands after the tag, distinct from `op12`'s
node-length-decides-arity trick, which does not apply here: `?:` is always
ternary, nothing else uses tag `'?:'` at another arity).

#### `fjs/fsc/ast` and `fjs/fsc/edag` lowering

`AstOperation` and the EDAG `lower`/`lowerBase` dispatch
([`fjs/fsc/ast/types.ts`](../ast/types.ts),
[`fjs/fsc/edag/module.f.mjs`](../edag/module.f.mjs)) extend the same way
Stage A's did: `&&`/`||`/`??` fall into the existing length-3 (two-operand)
dispatch case, since nothing about that dispatch reads the tag itself, only
the node's arity — confirm this rather than assume it, since it was written
against Stage A's tag set. `?:` needs a genuinely new length-4 case (three
operands plus the tag), the first arity `fjs/fsc/edag`'s lowering has not
had to handle since Stage A never went past two. The plain-data evaluator
(`fjs/fsc/ast/module.f.mjs`'s `run`) keeps refusing every operator, Stage B's
new ones included — same policy Stage A already established, since
evaluating one is the EDAG interpreter's job
([`interpret-edag.md`](./interpret-edag.md)), not this one's.

#### The eager/lazy split — the part that is not just plumbing

`fjs/fsc/ast/module.f.mjs`'s `refsOf` walks every operator operand
uniformly today, because every Stage A operator is eager: a reference
reached through any operand is reached, full stop, and that single notion
of "reached" already serves two different consumers correctly —

- **`sharing`** (elsewhere in this module): whether a node is referenced
  more than once, so it gets a `const` of its own on output. This is an
  identity question, indifferent to whether the reference is through an
  eager or a lazy position — `refsOf` as it stands today is correct for
  this and needs no change.
- **`reach`/`anchors`** (this file, `anchors` at the bottom): which body
  entries the export's chain of references reaches, so the rest — what
  `run` still evaluates unconditionally but the export's own EDAG would
  otherwise never touch — gets anchored onto a synthetic `,` instead of
  silently dropped. This one currently reuses `refsOf` unmodified, which is
  only safe because "referenced" and "unconditionally evaluated" have
  coincided up to now.

Stage B breaks that coincidence. `2340-operators.md` already works the
example: `const c = null.x; export default [a && c, b && c];` must still
anchor `c` — `c` is referenced from the export only through two `&&`
right-operands, neither an eager edge, so nothing about the export's own
EDAG shape *forces* `c`'s throwing initializer to run before those `&&`s
decide whether to touch it, yet the source's plain top-level `const c =
null.x;` throws unconditionally at module load, same as any other
statement, whether or not later code ever reaches for `c` lazily. Compare
`export default [c, a && c];`: `c` is *also* the array's first item, an
eager edge on its own, so no anchor is needed there — one eager path in is
enough.

So `anchors`'s reachability computation needs an eager-restricted traversal
distinct from `sharing`'s unrestricted one: a variant of `refsOf` that
stops rather than descends at exactly the positions
`2340-operators.md` already names as lazy — `&&`/`||`/`??`'s right operand,
either arm of `?:` — while continuing through everything already eager today
(container items, an access base, an operator's other operand(s), a `**`'s
growing side, everything `leftAssocNode` folds).

That variant is not only `reach`'s. `anchors`
([`fjs/fsc/ast/module.f.mjs`](../ast/module.f.mjs)) calls `refsOf` a second
time, in `within`, to check whether one *unreached* entry is itself reached
by another unreached entry — so an alias doesn't get anchored twice, once
directly and once through whatever anchors the entry that names it. Leaving
that second call on the unrestricted `refsOf` reintroduces the exact bug
this task exists to fix, one level removed: take `const d = null.x; const c
= a && d; export default b && c;`. Eager reach leaves both `c` and `d`
unreached (each is only referred to through a `&&` right operand). `within`
then walks the unreached entries' own definitions to see if any reaches
another — and `c`'s definition, `a && d`, *is* itself a `&&` node whose
right operand is `d`. An unrestricted walk there finds `d` inside `c` and
marks `d` as "reached within," so `anchors` drops `d`'s own anchor,
reasoning that anchoring `c` already covers it. It doesn't: `c` being
anchored only guarantees `a && d` itself gets *evaluated* as a root, and
evaluating `a && d` establishes `d` conditionally, on `a`, same as
establishing `b && c` conditionally left `c` needing its own anchor in the
first place. `d`'s unconditional top-level throw would silently depend on
`a`'s truthiness, which is wrong the same way the original example was.
`within`'s traversal needs the eager-only variant too, not just `reach`'s —
an unreached entry only excuses another unreached entry's anchor when it
reaches it eagerly, exactly the rule `reach` itself follows one level up.

`sharing`'s call sites keep the existing unrestricted `refsOf` unchanged —
identity doesn't care about laziness, only anchoring does. Concretely: a
node is anchored when nothing reaches it through eager edges alone — not
from the export, and not laterally through another unreached-but-not-itself-
eagerly-covered entry — even if something reaches it laterally through a
lazy one; a strict superset of today's anchor set, since eager reachability
implies today's reachability but not the reverse.

This is also where Stage C's own anchoring text
(`2340-operators.md`'s "subtraction" paragraph) gets its real test: that
paragraph describes the general rule this task's `reach`/`within` split is
the first instance of, so the proofs this task adds should include the
exact `a && c` / `b && c`, `[c, a && c]`, and the transitive `d`/`c` cases
above, not just new-syntax acceptance.

#### Out of scope

- `!` (logical not) and `typeof`: the operators doc leaves both explicitly
  open, not Stage B's regardless of `!`'s row sitting next to Stage B's in
  the table — see `2340-operators.md`'s own paragraph on this.
- Optional chaining (`?.`, `?.()`): a different `?`-prefixed token, owned by
  `compile-modules-to-edag.md` Stage 2, not this task.
- Stage C (comma): explicitly sequenced after Stage B; the anchoring
  subtraction rule this task implements one instance of is Stage C's to
  generalize, not to pull forward.
- `nanvm-lib`'s own "Complete all basic FunctionalScript operators... including
  the short-circuit operators" P1 task — *implementing* `&&`/`||`/`??`/`?:`
  lazily in Rust — stays out of scope: a separate, already-tracked line of
  work against `fjs/nanvm/module.f.mjs`'s shared operator-test data. But the
  **existing** `fjs/edag/rust` printer is not out of scope the way the doc's
  first draft claimed — see the Rust-codegen task below, which this task does
  own: not implementing laziness in Rust, but making sure this task doesn't
  let the existing eager printer silently miscompile it.
- The FunctionalScript writer (`fjs/fsc/serializer`): stays silent on Stage B
  the same way it already is on Stage A. `entry`'s ``default: { return
  error(`a ${node[0]} node`) }`` already refuses every Stage A operator node,
  undocumented as a Stage A task and left for later; Stage B's new node kinds
  fall into that same `default` case with no changes needed to keep refusing
  them. That refusal is the safe outcome DESIGN.md §10 asks for ("an
  unsupported input is refused, never answered with a plausible wrong
  value"), not a gap this task must close — the writer producing FJS text
  that doesn't preserve `&&`/`??`/`?:`'s precedence (there is no grouping to
  disambiguate with) is real future work, but it is exactly as deferrable
  here as it was for Stage A's operators, which still have no writer support
  either.

### Tasks

- [ ] Tokenizer: `&&`, `||`, `??`, `?` as DJS operator tokens.
- [ ] Grammar: `shortCircuit`/`circuitTail`/`andTail`/`orTail`/`nullishTail`/
      `logicalAnd`/`conditional` layered above `bitwiseOr`, right-factored so
      `fjs/ebnf/ll1` accepts it (the naive `logicalOr | nullish` split does
      not — see above), proven to refuse `a ?? b || c` and `a && b ?? c`
      without parentheses, and grammar-level accept/reject proofs matching
      Stage A's `operators` block in
      [`fjs/fsc/parser/grammar/proof.f.mjs`](../parser/grammar/proof.f.mjs).
- [ ] Parser: `Op2Tag` gains `&&`/`||`/`??`; new `Op3Tag`/`?:` `Node` shape;
      `leftAssocNode` reused for `logicalAnd`'s inner loop; new fold for
      `conditional`.
- [ ] `fjs/fsc/ast`/`fjs/fsc/edag`: extend `AstOperation`/`lower`/`lowerBase`
      for the new tags and the new arity-3 (`?:`) case; keep the plain-data
      evaluator's refusal.
- [ ] `fjs/edag/rust`: `op2Rust`'s `&&`/`||`/`??` entries and `op3Rust`'s `?:`
      entry print `Any::logical_and(${a}, ${b})` /
      `Any::conditional(${a}, ${b}, ${c})` today, where `a`/`b`/`c` are
      already-printed Rust value expressions — and `nanvm-lib`'s
      `Any::logical_and`/`logical_or`/`nullish_coalescing`/`conditional`
      (`nanvm-lib/src/vm/any/{and,or,nullish_coalescing,conditional}.rs`) take
      `Self` by value, not a closure, so Rust evaluates every operand before
      the call — confirmed by reading those signatures, not assumed. Today
      that's inert: nothing in the source language reaches these node kinds,
      so the printer never emits them for a real program. Stage B makes them
      reachable from `fjs compile <input> <output>.rs`, and at that point the
      existing entries stop being inert and start silently miscompiling any
      program whose correctness depends on the laziness this whole task is
      about — `false && (1n + 1)` must not evaluate `1n + 1`, but the
      generated Rust would. This task must not leave that: either gate
      `op2Rust`/`op3Rust`'s four entries to refuse (the same `Result`-based
      "not yet implemented in `nanvm-lib`" refusal this file already uses for
      operators the corpus marks with a `rust` reason, so the `.rs` route
      declines the same way the plain-data evaluator already does) until
      `nanvm-lib`'s own lazy-operator task lands, or land in lockstep with
      whatever Rust shape that task produces. Silently emitting the current
      eager calls once these nodes are reachable is exactly the outcome
      DESIGN.md §10 rules out — a plausible wrong value where a refusal
      belongs.
- [ ] `refsOf`: add the eager-restricted variant and switch **both** `reach`
      and `anchors`' own `within` computation to it, leaving `sharing`'s use
      of the unrestricted one unchanged; proofs for the sharing behavior,
      the direct anchoring behavior of a node reached only laterally, and
      the transitive case — an unreached entry's own lazy operand naming a
      second unreached entry, which must still get its own anchor — matching
      `2340-operators.md`'s worked examples and the `d`/`c` case above.
- [ ] Stack-safety: `logicalAnd`/`andTail`/`orTail`/`nullishTail`/`circuitTail`'s
      chains reuse or match `leftAssocNode`'s iterative shape, already proven safe
      from Stage A's own stack-overflow fix, but a chain-length stress proof
      at the same 20,000-deep bar Stage A used is still worth adding rather
      than assumed. `conditional`'s arms recurse into `value`, so a source
      program can nest `?:` right-associatively (`a ? b : c ? d : e ? ...`)
      the same way `**`'s chain nested before Stage A's fix — one JS call
      per `?:` unless the parser, the AST reference sweep, and EDAG lowering
      each walk it with the same pending-list-loop technique `unaryNode` and
      `lower` already use for `**`. Treating it as bounded by "what a human
      writes" was Stage A's own mistake before the 20,000-deep test found
      it; do not repeat it here — add the same stress proof across all three
      layers rather than exempt `conditional` on the same reasoning.
- [ ] `spec/README.md`'s Operators section, `2340-operators.md`'s "Stage A
      is in the language" paragraph, and `fjs/fsc/parser/README.md`'s `tail`
      passage — which documents `value`/`body` ending at Stage A's ladder
      top and would otherwise go stale the moment `conditional` replaces it
      — all updated for Stage B once done.

### Related

- [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md) —
  the staging plan and the anchoring-subtraction rule this task implements
  one instance of.
- [`nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md) —
  Parser task (this) and the separate Rust short-circuit-operators task that
  the `fjs/edag/rust` refusal/gate above waits on.
- [`fjs/edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs) — `op2Rust`/
  `op3Rust`, whose `&&`/`||`/`??`/`?:` entries this task must gate; see the
  Tasks entry above.
- `nanvm-lib/src/vm/any/{and,or,nullish_coalescing,conditional}.rs` — the
  `Any` methods those entries call, confirming they take already-evaluated
  operands, not closures.
- [`fjs/edag/module.f.mjs`](../../edag/module.f.mjs) — the already-landed,
  already-proved EDAG schema and laziness semantics this task compiles down
  to (`op2Id`, `op3Id`).
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  subject 3 — where that EDAG-level laziness design was settled.
- [`fjs/fsc/parser/README.md`](../parser/README.md) — the `tail` passage,
  Stage A's ladder this stacks on top of.
- [`fjs/fsc/ast/module.f.mjs`](../ast/module.f.mjs) — `refsOf`, `reach`,
  `anchors`: the eager/lazy split.
- `fjs/fsc/ast/todo/refs-stack-safety.md`
  ([as of `#2089`'s head](https://github.com/functionalscript/functionalscript/blob/853faaf88a7adad39460926da58369d87b18691e/fjs/fsc/ast/todo/refs-stack-safety.md);
  no such file is on `main`, where `#2106`'s
  [`fjs/edag/todo/stack-safety.md`](../../edag/todo/stack-safety.md) is
  the nearest) — the pre-existing, unrelated `.`-chain recursion limit in
  the same file; not this task's to fix, noted so it is not conflated with
  the new eager-only variant's own stack safety.
- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — owns
  optional chaining (`?.`), a different feature sharing the `?` token.
- PRs [`#2089`](https://github.com/functionalscript/functionalscript/pull/2089)
  (the tree this doc was written against),
  [`#2090`](https://github.com/functionalscript/functionalscript/pull/2090),
  [`#2092`](https://github.com/functionalscript/functionalscript/pull/2092) and
  [`#2106`](https://github.com/functionalscript/functionalscript/pull/2106)
  (Stage A as it landed) — the grammar work this task sequences after, all
  on `main`.
