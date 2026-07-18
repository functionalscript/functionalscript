# Derive `operatorTags` and trivia tag checks from the grammar

**Priority:** P3
**Status:** open

## Problem

The operator vocabulary is declared twice in
`fs/djs/tokenizer/module.f.ts`, and the two copies have already drifted.

The grammar's `operator` variant lists every operator as an object key
(`fs/djs/tokenizer/module.f.ts:135-193`); the descent parser emits the
matched branch's **key** as the `AstTag`. Then `operatorTags`
(`fs/djs/tokenizer/module.f.ts:266-275`) re-lists the same strings by hand
as a `Set`, whose only consumer is `filterFunc`
(`fs/djs/tokenizer/module.f.ts:277-295`): a grammar tag survives as a token
only if `operatorTags.has(tk)`.

The drift is live, and both copies are wrong in different ways. JavaScript
has no `<<<` / `<<<=` operators — the old tokenizer's `OperatorToken` union
(`fs/js/tokenizer/module.f.ts:126-127`) includes `<<`, `<<=`, `>>`, `>>=`,
`>>>`, `>>>=` but nothing with three `<`. Yet the grammar declares both
entries. **Update:** at the time this was written the key was typo'd
(`'<<<<=': '<<<='`), so `operatorTags`' hand-copy of `'<<<='` never actually
matched the tag the grammar emitted (`'<<<<='`) and `filterFunc` silently
dropped it. A separate fix (PR review comment) "corrected" the typo to
`'<<<=': '<<<='` without checking whether the operator should exist at all
— it shouldn't, per the analysis above — so `<<<=` is now *actively*
recognized as one bogus token instead of being silently dropped. Either way
the fix below (remove both entries entirely) is what's needed; the typo fix
made the bug more active, not the wrong diagnosis.

Two hand-maintained copies let a phantom operator and a mistaken "fix" for
its typo'd key coexist unnoticed — exactly the silent-failure mode a single
source of truth prevents.

The same pattern repeats for trivia: the grammar defines `ws = set(' \t')`
(line 91) and `newLine = set('\n\r')` (line 93), but the characters are
re-spelled in `isNlTag`/`isWsTag` (lines 244-245) and a third time in
`filterFunc`'s `case '\n': case '\r': case ' ': case '\t':` list
(lines 287-290).

## Proposal

Make the grammar the single source of the vocabulary, after pruning it to
the real JS operator set:

- Remove the invalid `'<<<<='` and `'<<<'` entries from the grammar (and
  `'<<<='`/`'<<<'` from `operatorTags`) — do **not** "fix" the typo'd key:
  `<<<`/`<<<=` are not JavaScript operators and must not become single
  tokens. Input like `a <<< b` should tokenize the way the old tokenizer
  does (`<<` then `<`), keeping every emitted tag inside `JsToken`.
- Hoist the `operator` object out of the `jsGrammar()` closure to module
  scope (it captures nothing) and derive the set:

  ```ts
  const operatorTags = new Set<string>(Object.keys(operator))
  ```

- Hoist the whitespace and newline character lists to one module-scope
  declaration each (e.g. `const wsChars = [' ', '\t'] as const`,
  `const nlChars = ['\n', '\r'] as const`), build the grammar's `ws`/`newLine`
  rules from them (`set(wsChars.join(''))`), and implement `isWsTag`/`isNlTag`
  and `filterFunc`'s trivia cases via membership in the same lists.

Only `jsGrammar`, `operatorTags`, `isNlTag`/`isWsTag`, and `filterFunc` change;
the public API is untouched. This mirrors the single-source remedy of
`fs/js/todo/tokenizer-token-tables.md` for the old tokenizer's parallel
union/table, but applies to a different module and structure (grammar variant
keys vs. downstream filter set), so it is tracked separately.

## Tasks

- [ ] Remove the `'<<<<='` and `'<<<'` grammar entries and the
      `'<<<='`/`'<<<'` set entries; add a proof case showing `<<<`-containing
      input tokenizes old-tokenizer-compatibly (as `<<` + `<`, never as one
      token).
- [ ] Hoist `operator` to module scope; derive `operatorTags` from
      `Object.keys(operator)`.
- [ ] Single-source the ws/newline character lists shared by the grammar rules,
      `isNlTag`/`isWsTag`, and `filterFunc`.
- [ ] Run `npx tsc` and `fjs t`; keep 100% proof coverage of the module.

## Related

- `fs/js/todo/tokenizer-token-tables.md` — sibling single-source issue in the
  old JS tokenizer (union type vs. runtime table).
- `fs/djs/tokenizer/todo/replace-old-tokenizer.md` — the vocabulary must
  stay correct through the planned swap.
