## Stage B operators: `&&`, `||`, `??`, `?:`

**Priority:** P1
**Status:** open — Stage A is on `main` (see "Landed"); this proposal is
written against it and awaits approval
**Blocked by:** another language designer's explicit approval of this
proposal, which a new language feature needs before implementation
([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions),
[AGENTS.md](../../../AGENTS.md)); record it here when given

### Problem

**Stage A is on `main` since [`#2106`](https://github.com/functionalscript/functionalscript/pull/2106), and this proposal is written against it.** An
earlier draft was written against
[`#2089`](https://github.com/functionalscript/functionalscript/pull/2089)'s
tree, whose ladder landed in a different shape; that draft's names
(`Op2Tag`, `leftAssocNode`, `unaryNode`, `AstOperation`, `lowerBase`) are
gone with it. What `main` has, and what the proposal below extends:

- the ladder is `tail` in
  [`grammar/module.f.mjs`](../parser/grammar/module.f.mjs): eight repeat
  lists, `multiplicativeTail` through `bitwiseOrTail`, spread onto every
  branch of `value`/`body` but `func` and `block`; a round of any layer is
  `op t unary <the tails of every layer below it>`, and `unary` — `func`
  excluded — is every binary operator's operand;
- the parser's [`foldLayer`](../parser/module.f.mjs) folds a layer's rounds
  onto a base left-associatively, reading the operator through the flat
  `binaryOpTag` map, and `applyTail` folds the eight lists in order; the
  node is the flat `readonly [BinaryTag, Node, Node]` of
  [`parser/types.ts`](../parser/types.ts), `BinaryTag` being
  [`ast/types.ts`](../ast/types.ts)'s, where `AstBinary` is
  `readonly [BinaryTag, AstConst, AstConst]`;
- [`edag/module.f.mjs`](../edag/module.f.mjs)'s `lower` walks operators
  with an explicit stack and dispatches on the tag, one `case` per
  operator, so a new tag is a new `case`, never a fall-through by arity;
- `2340-operators.md`'s "Stage A is in the language" paragraph is the
  record that Stage A landed, and says the lazy operators, the
  conditional and the comma wait on `bitwiseOr` being the ladder's top.

The three-part staging — Stage A eager, Stage B the lazy operators
`&&`/`||`/`??`/`?:`, Stage C the comma — is this doc's own framing, not
[`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md)'s,
which lists the operators by priority and names no stages. Stage C is
sequenced after Stage B here because the anchoring rule Stage B
implements one instance of is the comma's to generalize, so it is not
this task's.

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
   as `tail`, the shape the proposal below is written against. Stage B's
   new lists sit directly above its last, `bitwiseOrTail`.

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
is **not** LL(1): both alternatives start by parsing a bitwise-or-level
operand, so a parser reading the first token cannot tell which alternative
it is in — exactly the first/first conflict `fjs/ebnf/ll1` would refuse
before parsing any input, the same class Stage A's own tokenizer/parser
table in [`fjs/fsc/README.md`](../README.md#both-grammars-are-ll1) already
lists several instances of. It needs the same fix that table's `delimited`
row used for the trailing comma: spelled right-recursively, so the shared
prefix is parsed exactly once and every later choice reads one token of
lookahead, never two competing productions that both start the same way.

Stage A's shape is the frame: `tail` is a list of tail lists spread onto a
branch, and a layer's round carries its own operand followed by the tails
of every layer below it. A layer's operator is never a bare token but a
tagged choice — `bitwiseOrOp` is `{ or: sym('|') }` — because `foldLayer`
reads a round's operator by unmapping that choice and looking its tag up
in `binaryOpTag`; a bare terminal is a leaf there and never reaches the
map. Stage B's three operators are spelled the same way, `logicalAndOp`,
`logicalOrOp` and `nullishOp`, each a one-branch choice keyed by a name no
other layer uses. It adds two entries to `tail`, after `bitwiseOrTail`, in
the same spelling — `operand` below is Stage A's whole operand, `unary`
followed by the eight existing tails, which is what a `bitwiseOr`-level
expression is on `main`:

```text
logicalAndOp ::= { logicalAnd: '&&' }          -- tagged choices, as multiplicativeOp … bitwiseOrOp are
logicalOrOp  ::= { logicalOr: '||' }
nullishOp    ::= { nullish: '??' }
operand      ::= unary multiplicativeTail … bitwiseOrTail
circuitTail  ::= logicalAndOp t operand andTail          -- committed to && (|| may still follow)
               | logicalOrOp t operand logicalAndTail orTail   -- committed to || directly
               | nullishOp t operand nullishTail          -- committed to ?? (no && or || can follow)
               | ε
andTail      ::= logicalAndOp t operand andTail
               | logicalOrOp t operand logicalAndTail orTail   -- `a && b || c` is `(a && b) || c`, still legal
               | ε                                       -- no nullish arm: already committed away from it
orTail       ::= logicalOrOp t operand logicalAndTail orTail
               | ε
logicalAndTail ::= { logicalAndOp t operand }
nullishTail  ::= { nullishOp t operand }
conditionalTail ::= [ '?' t value ':' t value ]
tail         ::= multiplicativeTail … bitwiseOrTail circuitTail conditionalTail
```

Each nonterminal's alternatives are distinguished by exactly one lookahead
token (`&&`, `||`, `??`, `?`, or none of those), and once a chain has
committed to `&&`/`||` (`andTail`/`orTail`) or to `??` (`nullishTail`)
neither tail rule has an arm for the other's token, so `a && b ?? c` and
`a ?? b || c` both fail to parse at the unconsumed operator — refused by
the grammar shape itself, not a check layered on after. `logicalAndTail`
and `nullishTail` — the two pieces that never have to choose between
operators — are plain repeat lists exactly like the eight below them,
each round `op t unary <lower tails>` with `op` a tagged choice, so
`foldLayer` folds them unchanged once `binaryOpTag` maps `logicalAnd` and
`nullish` to their tags. The commit-to-one-branch tails
(`circuitTail`/`andTail`/`orTail`) are the new shape this task adds: a
choice among named continuations, not a repeat, so they need a reader of
their own beside `foldLayer` — one that takes the branch by the same
operator tag, `logicalOr` included, and folds the operand and its
continuation as `foldLayer` folds a round. `conditionalTail` is the one genuinely new
shape beyond that: an optional `? value : value` after the short-circuit
level, taking full `value`s (not stopping at the short-circuit level) for
its two arms, matching JS's `ConditionalExpression` branches being
`AssignmentExpression`-level (this language has no assignment expression,
so `value` — the ladder's own top — is the nearest equivalent) rather than
another conditional; right associativity of nested `?:`s falls out of the
arms recursing into `value` without needing a repeat construct. Both new
entries ride on the same branches the eight existing tails do, `func` and
`block` still excepted, and `?` is a token of its own beside `??` and
`?.`, so the choice stays one symbol wide. An arm is a `value`, so it may
be a function, and `:` then follows `body` — `fjs/ebnf/ll1` decides
whether that follow set costs a conflict, before any input, the same way
it decided the `func` leak the parser README records.

#### Parser / AST

`BinaryTag` ([`ast/types.ts`](../ast/types.ts)) gains `'&&' | '||' |
'??'`, mechanically identical to Stage A's other binary operators at the
AST level: the flat `readonly [BinaryTag, Node, Node]` of
`parser/types.ts`'s `Node` and `AstBinary`'s `readonly [BinaryTag,
AstConst, AstConst]` already cover them — no new shape, since laziness is
not a shape difference at this layer any more than it is one in the EDAG.
`binaryOpTag` ([`parser/module.f.mjs`](../parser/module.f.mjs)) gains a
key per new operator choice, `logicalAnd`, `logicalOr` and `nullish`, each
unique across the layers as every existing key is, and `foldLayer` then
folds `logicalAndTail` and `nullishTail` rounds as it folds the eight
below, their operator being a tagged choice as every layer's is. The commit tails and `conditionalTail` are read by a reader of
their own, applied after `applyTail`'s eight lists: a commit tail is a
choice, so the reader takes the branch by its tag and folds the operand
and its continuation left-associatively, the same fold `foldLayer` does,
walking the right-recursive continuation as a loop rather than a call.

The conditional is a new node shape, the AST's own arity-3 one: `readonly
['?:', Node, Node, Node]` in `Node`, and `AstConditional = readonly ['?:',
AstConst, AstConst, AstConst]` in `ast/types.ts` — condition, then, else,
three operands after the tag, matching the EDAG's `op3` exactly. This is
distinct from `-`'s length-decides-arity trick, which does not apply here:
`?:` is always ternary, nothing else uses tag `'?:'` at another arity.
`evaluate`'s explicit `_Stack`, which resolves a value's references
without recursion, gets the new frame the three operands need.

#### `fjs/fsc/ast` and `fjs/fsc/edag` lowering

`lower` ([`edag/module.f.mjs`](../edag/module.f.mjs)) dispatches on the
tag, one `case` per Stage A operator, never on a node's arity: `&&`, `||`
and `??` join that `case` list and take the existing two-operand `binary`
work item, since the EDAG's `op2` shape is the same for an eager and a
lazy operator. `?:` needs a genuinely new work item — three operands
expanded, then a `ternary` step building `['?:', c, t, e]` — the first
arity `lower` has not had to handle, since Stage A never went past two.
The plain-data evaluator (`fjs/fsc/ast/module.f.mjs`'s `run`) keeps
refusing every operator, Stage B's new ones included — same policy Stage
A already established, since evaluating one is the EDAG interpreter's job
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
growing side, everything `foldLayer` folds).

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
- A lazy `.rs` spelling for `&&`/`||`/`??`/`?:`. `nanvm-lib` has the four
  operations, taking evaluated operands, and the corpus checks them; a
  compiled module needs operands that are not evaluated before the call,
  which nothing spells yet —
  [`fjs/fsc/rust/todo/lazy-operators.md`](../rust/todo/lazy-operators.md),
  which waits on this task only for a source program that can reach the
  nodes. `fjs/fsc/rust`'s `lazyOperator` already refuses all four, `?:`
  included, proven directly through `toRust`; what the `.rs` route of
  `fjs compile` owes this task is the proof that a whole *module* holding
  `?:` is refused once the grammar can produce one — see the Rust-codegen
  task below.
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
- [ ] Grammar: `logicalAndOp`/`logicalOrOp`/`nullishOp` as tagged choices
      like every layer's operator, and `circuitTail`/`andTail`/`orTail`/
      `logicalAndTail`/`nullishTail`/`conditionalTail` as `tail`'s two new
      entries above `bitwiseOrTail`, right-factored so `fjs/ebnf/ll1` accepts it (the
      naive `logicalOr | nullish` split does not — see above), proven to
      refuse `a ?? b || c` and `a && b ?? c` without parentheses, and
      grammar-level accept/reject proofs matching Stage A's `operators`
      block in
      [`fjs/fsc/parser/grammar/proof.f.mjs`](../parser/grammar/proof.f.mjs).
- [ ] Parser: `BinaryTag` gains `&&`/`||`/`??` and `binaryOpTag` their
      keys, so `foldLayer` folds the two repeat lists unchanged; a reader
      for the commit tails and `conditionalTail` beside `applyTail`; the
      `['?:', Node, Node, Node]` shape in `Node` and its frame in
      `evaluate`'s `_Stack`.
- [ ] `fjs/fsc/ast`/`fjs/fsc/edag`: `AstConditional`; `lower`'s `case` list
      gains the three tags and a `ternary` work item for `?:`; keep the
      plain-data evaluator's refusal.
- [x] `fjs/fsc/rust`: `lazyOperator` refuses the `?:` node beside
      `&&`/`||`/`??`, proven directly through `toRust`, since it takes any
      EDAG whether or not the grammar can produce one. The shared
      `fjs/edag/rust` entries stay as they are: `fjs/nanvm/rust` unwraps the
      shared printer to write the corpus, so gating them there would break
      generating the very tests the lazy Rust operators will be checked by.
      What this task still owes is a proof that a *module* holding `?:` is
      refused on the `.rs` route once the grammar produces one. Lifting the
      refusal is
      [`fjs/fsc/rust/todo/lazy-operators.md`](../rust/todo/lazy-operators.md)'s.
- [ ] `refsOf`: add the eager-restricted variant and switch **both** `reach`
      and `anchors`' own `within` computation to it, leaving `sharing`'s use
      of the unrestricted one unchanged; proofs for the sharing behavior,
      the direct anchoring behavior of a node reached only laterally, and
      the transitive case — an unreached entry's own lazy operand naming a
      second unreached entry, which must still get its own anchor — matching
      `2340-operators.md`'s worked examples and the `d`/`c` case above.
- [ ] Stack-safety: `logicalAndTail`/`nullishTail` are folded by
      `foldLayer`'s `reduce`, iterative as Stage A's own stack-overflow fix
      left it, and the commit tails' reader must walk its right-recursive
      continuation as a loop the same way; a chain-length stress proof at
      the same 20,000-deep bar Stage A used is still worth adding rather
      than assumed. `conditionalTail`'s arms recurse into `value`, so a
      source program can nest `?:` right-associatively (`a ? b : c ? d : e
      ? ...`) the same way `**`'s chain nested before Stage A's fix — one JS
      call per `?:` unless the parser, the AST reference sweep, and EDAG
      lowering each walk it with the same explicit-stack technique
      `evaluate` and `lower` already use for `**`. Treating it as bounded by "what a human
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
  the Parser task, which this is. Its operators item is done and its `?:`
  item is the VM's; neither is what the `.rs` route waits on, which is
  [a lazy spelling](../rust/todo/lazy-operators.md).
- [`fjs/edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs) — `op2Rust`/
  `op3Rust`, whose `&&`/`||`/`??`/`?:` entries the corpus printer needs as
  they are; [`fjs/fsc/rust`](../rust/module.f.mjs)'s `lazyOperator` is
  where the compile route refuses them, see the Tasks entry above.
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
