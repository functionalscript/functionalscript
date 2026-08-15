## trivia-merge-rule. The ws/nl coalescing contract is implemented independently by both tokenizers

**Priority:** P4
**Status:** open

### Problem

"A maximal run of whitespace/newline trivia collapses to a single token, and
a run containing any newline is an `nl`" is a contract of `JsToken`'s
`ws`/`nl` — but it is decided independently in two modules.

`fjs/js/tokenizer/module.f.mjs:598-614` encodes it as two range-map states
(`ws + ws → ws`, `ws + nl → nl` with the pending `ws` dropped, `nl + ws → nl`,
`nl + nl → nl`).

`fjs/djs/tokenizer/module.f.mjs:285-288` restates the same four-way table over
grammar tags:

```js
if (isNlTag(input) && isNlTag(stateTag)) return [null, state]
if (isWsTag(input) && isWsTag(stateTag)) return [null, state]
if (isNlTag(input) && isWsTag(stateTag)) return [null, [input, null, []]]
if (isWsTag(input) && isNlTag(stateTag)) return [null, state]
```

The DJS copy exists only to reproduce the JS tokenizer's output (the proofs
compare the two token-for-token), so it is a re-derivation of a contract the
other module owns, with no shared statement of it. Change the absorption rule
in one place and the proofs are the only thing standing between the two.

### Proposal

State the rule once in `fjs/js/tokenizer` — it defines `JsToken` and is the
reference implementation — as a data-level merge on trivia kinds:

```js
/** nl absorbs ws; equal kinds coalesce. */
export const mergeTrivia = (a, b) => a === 'nl' || b === 'nl' ? 'nl' : 'ws'
```

and have both consumers express their four branches through it: the JS
tokenizer's two trivia states pass the pending and incoming kind; the DJS
`scanFunc` maps its tags to kinds (`isNlTag` → `'nl'`, `isWsTag` → `'ws'`)
and keeps only the state bookkeeping.

This does not merge the two tokenizers (that is
`fjs/djs/todo/157.md`-adjacent territory); it only gives the one shared rule
one owner.

### Tasks

- [ ] Export `mergeTrivia` from `fjs/js/tokenizer` with proof coverage of the
      four combinations.
- [ ] Rewrite the JS tokenizer's `parseWhitespaceStateOp`/`parseNewLineStateOp`
      transitions and the DJS `scanFunc` trivia branches through it.
- [ ] `npx tsc`, `fjs t` — both tokenizers' proofs pass unchanged.

### Related

- `fjs/djs/tokenizer/todo/vocabulary-single-source.md` — derives the ws/nl
  *character lists* from the grammar inside `djs/tokenizer`; this issue is
  the cross-module *coalescing rule*, distinct.
