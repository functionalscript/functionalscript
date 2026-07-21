## stack-recursive-tokenization. Avoid stack-recursive tokenization for normal-size files

**Priority:** P2
**Status:** done

> **Resolved** — by fixing the matcher itself rather than either proposal below:
> `fs/bnf/descent`'s matcher `f` was rewritten as an explicit-stack machine (two frame
> kinds — suspended sequence, suspended variant — on a cons-cell stack), so descent
> matching uses O(1) JS call stack for *any* grammar shape and *any* input length. That
> fixes both halves at once: the outer whole-file `repeat0Plus(token)` loop (many short
> tokens) and a single long token (long string/identifier, and long block comments via the
> hand-written recursive `multilineContent`, which the `repeat`-detection proposed in
> [../../../bnf/todo/667-bnf-repeat-flatten.md](../../../bnf/todo/667-bnf-repeat-flatten.md)
> would *not* have caught — it has an `end` branch, so it isn't the pure 0-or-more shape).
>
> `tokenizeString`/`tokenizeJs` therefore still match the whole file as one grammar rule —
> the interim per-token driver (2) was landed first (`tokenizeToAsts`) and then removed
> again: with the stack-based matcher it was no longer needed, and its per-token
> `cpm.slice(offset)` made it O(n²) where the whole-file match is linear (measured ~4×
> slower at 30,000 tokens).
>
> Verified sizes (see the `largeInputs` proof group): 5 KB string literal, 20 KB block
> comment, 10 KB identifier, thousands of short tokens; a 100 KB block comment and a
> 30,000-token file were also checked manually. 667 is no longer needed as a stack fix —
> its remaining value is the data-representation / flat-AST improvement it originally
> proposed. The AST for right-recursive rules is still nested; current consumers walk it
> via the stack-safe lazy `List`, so that is a data-shape concern (667's), not a crash
> concern.

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

- [x] Decide whether to pursue (1), (2), or both — ultimately neither as
      written: (2) landed first as an interim (`tokenizeToAsts`), then the
      matcher itself was made iterative (explicit frame stack in
      `fs/bnf/descent/module.f.ts`), which subsumed both halves without
      grammar/data changes, and the interim driver was removed again (it was
      O(n²) via per-token `cpm.slice`; the whole-file match is linear).
- [x] Add proof coverage at realistic sizes — `largeInputs` group in
      `fs/djs/tokenizer/proof.f.ts` covers `' '.repeat(5000)` (the reported
      repro), 3000 distinct id tokens, the `tokenizeJs` entry point, and
      single long tokens (5 KB string, 20 KB block comment, 10 KB
      identifier).
- [x] Re-run the codex-reported repros — `' '.repeat(5000)` and the 5 KB+
      string/comment all tokenize successfully.

### Related

- [../../../bnf/todo/667-bnf-repeat-flatten.md](../../../bnf/todo/667-bnf-repeat-flatten.md)
  — the real fix; already has the concrete-impact note for the narrower
  single-long-token case, cross-linked both ways.
- [error-message-specificity](error-message-specificity.md) — a different,
  already-tracked gap in the same tokenizer (message quality on failure);
  unrelated to this one (stack depth on success-shaped input).
