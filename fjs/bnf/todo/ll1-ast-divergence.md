## `bnf/ll1`: the AST does not match `bnf/descent`

**Priority:** P3
**Status:** blocked
**Blocked by:** [New parser backend](./new-parser.md)

### Problem

Both backends consume the same `RuleSet` and disagree about the AST it implies.
The `descentDivergence` group in `fjs/bnf/ll1/proof.f.mjs` pins every case below,
matching one grammar with both backends so neither can drift unremarked:

| grammar | input | `bnf/descent` | `bnf/ll1` |
| --- | --- | --- | --- |
| `[A, B, C]` | `ABC` | `(("A") ("B") ("C"))` | `("A" ("B") ("C"))` |
| `{a: A, b: B}` | `A` | `"a"("A")` | `"a"("A")` |
| `[option(-), 09]` | `5` | `("none"() ("5"))` | `("5")` |
| `[option(-), 09]` | `-5` | `("some"("-") ("5"))` | `"some"("-" ("5"))` |
| `repeat0Plus(A)` | `AAA` | `(("A") ("A") ("A"))` | `("A" ("A" ("A" *())))` |
| `[[A, B], C]` | `ABC` | `((("A") ("B")) ("C"))` | `("A" ("B") ("C"))` |

Read as five differences and one agreement:

1. **The leading item loses its node.** The symbol a dispatch consumed is spliced
   into the enclosing node rather than becoming a node of its own.
2. **A nullable item that matched empty disappears.** `bnf/descent` records
   `"none"()`; here nothing survives, so the AST cannot say the option was ever
   considered.
3. **Tags move.** Taken, the same option tags the *enclosing* node here and its
   *own* node in `bnf/descent`. Same tag, different owner.
4. **Repetition is right-recursive.** `bnf/descent` emits one flat node of items;
   here every item nests one level deeper than the last, ending in an empty
   `*()` tail node with no counterpart at all.
5. **Grouping is lost.** `[[A, B], C]` and `[A, B, C]` produce **byte-identical**
   ASTs here. This is the one case that destroys information rather than
   reshaping it: no later pass can recover which grammar was matched, so it is
   the case to fix first and the one that bounds what any consumer can do with an
   LL(1) AST.

Only the variant agrees.

### Cause

One mechanism explains all five. `bnf/descent` builds a node per rule
*invocation*; this backend builds one per *dispatch*. A dispatch entry consumes
the symbol it dispatched on and continues with a flat chain of rule names, so a
rule entered *through* a dispatch never gets a node — its leaf, its children and
its tag are absorbed by whatever enclosed it.

That is also why a `Repeat` cannot simply be matched iteratively here.
`dispatchMap` compiles it back into the right-recursive chain it was folded from,
because the first set of a nullable item is inlined into whatever encloses it: a
repetition leading a sequence — `[ws, value, ws]`, the shape of every grammar in
`bnf/testlib.f.mjs` — has its first set merged into that sequence's entries, and
a looping frame is unreachable from there. Making only the *non-inlined*
references iterative would be worse than leaving it alone: one grammar would then
produce a flat node in one position and a chain in another.

### Proposal

First decide whether the two backends *should* agree. An LL(1) parse tree that
inlines its dispatch is a defensible thing to want on its own terms; what is not
defensible is difference 5, and no answer to the first question excuses it.
So the question splits:

- **Difference 5 is a defect either way.** A backend may shape its AST
  differently from another; it may not make two distinct grammars
  indistinguishable.
- **Differences 1–4 are a contract question.** If a consumer is ever meant to
  read either backend's AST — which [207](./207.md)'s semantic actions assume,
  since an action is attached to a *rule* and has to find that rule's node — then
  they have to converge, and the AST becomes part of the `RuleSet` contract
  rather than each backend's private business.

Both point at the same fix, which is why this is not two issues: a dispatch model
where a rule is entered *before* its first symbol is consumed, so every rule
invocation owns a node. That is the classic LL(1) shape — a predictive table over
an explicit stack of rule invocations — and it is what
[new-parser](./new-parser.md) already contemplates, so settle it there rather
than rebuilding the current dispatch builder twice.

Until then the divergence is pinned by proof and documented in
`fjs/bnf/ll1/README.md`; the right-recursive `Repeat` expansion is
behavior-preserving and stays.

### Tasks

- [ ] Decide whether the backends' ASTs are one contract or two, and record the
      answer in `fjs/bnf/README.md` — every task below depends on it.
- [ ] Fix difference 5 regardless of that answer: `[[A, B], C]` and `[A, B, C]`
      must not produce the same AST.
- [ ] Settle the dispatch model with [new-parser](./new-parser.md) — rule
      invocations on an explicit stack, entered before the first symbol is
      consumed.
- [ ] Give every rule invocation its own node, which subsumes differences 1–3.
- [ ] Match `repeat(item)` iteratively and emit one node holding a flat
      `AstSequence`, matching `bnf/descent` (difference 4).
- [ ] Remove the right-recursive `Repeat` expansion from `dispatchMap` once the
      matcher no longer needs it.
- [ ] Turn the `descentDivergence` proof group into an equivalence proof — same
      grammar, same AST — case by case as each difference closes, including a
      repetition in a sequence's nullable prefix.
- [ ] `npx tsc`, `fjs test`.

### Related

- `fjs/bnf/ll1/proof.f.mjs`, `descentDivergence` — the pinned cases above.
- [`fjs/bnf/ll1/README.md`](../ll1/README.md#the-ast-diverges-from-the-descent-backends) —
  the same table, as shipped behavior rather than as a defect report.
- [`fjs/bnf/descent/README.md`](../descent/README.md#repetition-is-flat) — the
  flat repetition shape this backend should reach.
- [`fjs/bnf/data/README.md`](../data/README.md#the-repeat-rule) — what the
  `Repeat` fold recognizes, and why it is limited to the unambiguous 0-or-more
  case.
- [New parser backend](./new-parser.md) — where the dispatch model is decided.
- [BNF semantic actions](./207.md) — attaching an action to a rule needs that
  rule to have a node, so differences 1–3 bound what it can do here.
- [BNF rule visitor](./rule-visitor.md) — `isRepeat` in `bnf/data` is the single
  discriminator the visitor should absorb.
