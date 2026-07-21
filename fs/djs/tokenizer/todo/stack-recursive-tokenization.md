## stack-recursive-tokenization. Avoid stack-recursive tokenization for normal-size files

**Priority:** P2
**Status:** open

> **Progress.** Interim fix (2) below has landed: `tokenizeString`/`tokenizeJs` now match
> `token` in a plain JS loop (`tokenizeToAsts` in `fs/djs/tokenizer/module.f.ts`) instead of
> matching the whole file as one `repeat0Plus(token)` grammar rule, so the outer/many-tokens
> crash is fixed (`' '.repeat(5000)`, thousands of short tokens — see the `largeInputs` proof
> group). `jsGrammar()` still returns the old whole-file `repeat0Plus(token)` rule for the
> small-input grammar-level tests in `proof.f.ts` (`isValid`/`tokenizer` groups); production
> tokenization no longer uses it. **A single long token (long string/comment/identifier)
> still overflows** — that half needs fix (1), which is still blocked on
> [../../../bnf/todo/667-bnf-repeat-flatten.md](../../../bnf/todo/667-bnf-repeat-flatten.md)
> (itself blocked on the not-yet-split i207 design doc). Lowered from P1 to P2 since the more
> common "many short tokens" trigger is now fixed; the remaining single-long-token gap is the
> same narrower case i207/667 already tracked before this issue existed.

### Problem

Raised as a PR review comment (codex) on the tokenizer-new → tokenizer swap:
valid inputs only a few KB long can throw `RangeError: Maximum call stack
size exceeded` instead of producing tokens. Confirmed repro:
`tokenizeString(' '.repeat(5000))` and a 5 KB string/block comment both
overflow in Node 22, while the previous state-machine tokenizer
(`fs/djs/tokenizer`, since deleted and replaced by this grammar-based one)
handled a 20 KB block comment without issue.

Root cause: `fs/djs/tokenizer/module.f.ts`'s `jsGrammar()` returns
`tokens = repeat0Plus(token)` — the *entire token stream for the whole
file* is one right-recursive grammar match. `descentParser`'s `f` matcher
(`fs/bnf/descent/module.f.ts`) recurses once per repetition: sequence branch
→ variant branch → sequence branch → …, one JS call-stack frame per matched
`token`. This means the crash isn't limited to one pathologically long
token (an earlier, narrower finding — see the "Concrete impact" note in
[../../../bnf/todo/667-bnf-repeat-flatten.md](../../../bnf/todo/667-bnf-repeat-flatten.md)
— tracked a single long identifier crashing around ~2,000-3,000 characters
via `id`'s inner `repeat0Plus(idChar)`). It's the *outer* loop too: a file
with 5,000 short whitespace/operator/number tokens recurses just as deep as
one 5,000-character token, because both are `repeat0Plus` chains matched by
the same recursive `f`. Any real DJS file past a few KB is at risk,
regardless of whether it has one huge token or many small ones.

### Proposal

Two fixes, different scopes:

1. **Real fix, shared:** land
   [../../../bnf/todo/667-bnf-repeat-flatten.md](../../../bnf/todo/667-bnf-repeat-flatten.md)
   — a `repeat` primitive that `descentParser` matches in a loop instead of
   via recursion, producing a flat `AstSequence`. This fixes *all*
   `repeat0Plus`-based recursion (the outer `tokens` loop, and every inner
   one — `id`, `digits0`, `string`'s body, `comment`'s `multilineContent`)
   in one architectural change, for every `descentParser` consumer, not
   just this tokenizer.
2. **Possible interim, local to this file:** drive tokenization of the
   *outer* token stream iteratively from JS instead of matching
   `repeat0Plus(token)` in one grammar call — repeatedly invoke the descent
   matcher for a single `token` rule, advancing the code-point index in a
   plain loop (O(1) stack depth regardless of file length), accumulating
   results in an array. This would close the "many short tokens" half of
   the problem (e.g. the `' '.repeat(5000)` repro) without touching shared
   `fs/bnf` code, but does **not** fix a single long token (long identifier,
   long string, long comment) — those still recurse internally within one
   `token` match via `id`/`string`/`comment`'s own `repeat0Plus` bodies, so
   (1) is still required for full correctness. Only worth doing if (1) is
   far off and the "many tokens" case is the more common real-world trigger.

Not scoped/estimated further here — needs its own design pass, most likely
starting with (1) since it's the complete fix and already has a proposal
written up.

### Tasks

- [x] Decide whether to pursue (1), (2), or both, and in what order — did (2)
      first since it needed no shared `fs/bnf` changes and (1) is blocked;
      (1) is still needed for the single-long-token case.
- [x] (2): iterative outer-loop driver landed as `tokenizeToAsts` in
      `fs/djs/tokenizer/module.f.ts` — matches `buildToken()` (the grammar
      factored out of `jsGrammar`) one token at a time via `descentParser`,
      advancing a plain code-point offset; ws/nl merging, metadata threading,
      and error detection (`unterminated`/`numError` tags) are unchanged,
      just fed from a flat array of per-token ASTs (`flatMap(getTokensFromAstRule)`)
      instead of one whole-file AST.
- [x] Add proof coverage at realistic sizes — `largeInputs` group in
      `fs/djs/tokenizer/proof.f.ts` covers `' '.repeat(5000)` (the reported
      repro), 3000 distinct id tokens, and the `tokenizeJs` entry point, all
      comfortably past the ~1000-1500 token point where the old whole-file
      match crashed.
- [x] Re-run the codex-reported repro — `' '.repeat(5000)` no longer throws.
      A single long token (5 KB+ string/block comment) still throws; that's
      the still-open (1) half, tracked by 667/i207.
- [ ] Land (1) (via 667/i207) to fix the remaining single-long-token case.

### Related

- [../../../bnf/todo/667-bnf-repeat-flatten.md](../../../bnf/todo/667-bnf-repeat-flatten.md)
  — the real fix; already has the concrete-impact note for the narrower
  single-long-token case, cross-linked both ways.
- [error-message-specificity](error-message-specificity.md) — a different,
  already-tracked gap in the same tokenizer (message quality on failure);
  unrelated to this one (stack depth on success-shaped input).
