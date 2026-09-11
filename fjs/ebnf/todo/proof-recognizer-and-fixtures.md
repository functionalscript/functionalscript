## proof-recognizer-and-fixtures. One recognizer helper and shared fixtures for the grammar proofs

**Priority:** P4
**Status:** open

### Problem

Every recognizer test asks the same question — *did the parser accept and
consume all of the input?* — and spells the answer inline. When the
classical `fjs/bnf` backends lived, the spelling was copied seven times in
their proofs, in two backend-specific shapes; those went with the backends.
What remains is over the one backend, and is still spelled per proof:

- `fjs/fsc/tokenizer/proof.f.mjs`'s `covers` resumes
  [`../ll1`](../ll1/README.md)'s `parser` of the one-token grammar
  `fjs/ebnf/lib/js` from where the last token ended, and answers `false` at
  the first token the grammar refuses and `true` once the loop reaches the
  end;
- the grammar proofs under [`../lib`](../lib/) and `fjs/media/*/parser` each
  read a `MatchResult` in their own words to say "accepted, and the end is
  the length".

The JSON acceptance corpus — twenty inputs with JSON verdicts — is listed in
the tokenizer's proof beside its DJS-token cases, where six JSON-rejecting
rows are intentionally accepted by the token stream because tokenization
leaves document structure to the parser; that divergence should be an
explicit override table rather than a copied corpus, once a second consumer
of the corpus exists.

Measure before building: the count above is what the deletion of `fjs/bnf`
left, not what was measured when this issue was filed, and a helper with one
consumer is not a helper.

### Proposal

One recognizer adapter over the surviving backend, one assertion helper any
recognizer can use, and the fixtures beside them in
[`../testlib.f.mjs`](../testlib.f.mjs), which already holds what the front
end's proofs share:

```ts
export type Recognition = {
    readonly accepted: boolean
    readonly diagnostic: unknown
}

export type Recognizer = (input: string) => Recognition

export const ll1Recognizer = (ruleSet: RuleSet, entry: string): Recognizer => …

export const assertRecognizes = (r: Recognizer) =>
    (cases: readonly Case[]): void => …
export type Case = readonly [string, boolean]
```

The recognizer must not collapse to a bare `boolean`: the `MatchResult` is
the diagnostic, and `assertRecognizes` reports `[input, diagnostic]` so a
failure identifies both the corpus row and the parser state. The adapter
takes a `RuleSet` and its entry name and builds via `parserRuleSet`, which
the backend already exposes, so no production API is added; a token layer's
recognizer — the tokenizer's `covers` — is the same adapter resumed per
token, and is the reason the entry is a parameter rather than a default.

`stringToCodePointList` / `toArray` stay inside the recognizer adapter, which
takes them from `fjs/text/utf16` — input decoding, not what
[unicode-rules](../unicode/todo/unicode-rules.md) owns.

### Tasks

- [ ] Measure: which proofs under `fjs/ebnf`, `fjs/media` and `fjs/djs` spell
      the whole-input question, and whether the JSON corpus has a second
      consumer. If the answer is one and none, close this.
- [ ] Add `Case`, `Recognition`, `assertRecognizes` and `ll1Recognizer` to
      [`../testlib.f.mjs`](../testlib.f.mjs), with the proof coverage a
      `testlib` owes; carry the `MatchResult` through as `diagnostic`.
- [ ] Convert the sites found, the tokenizer's `isValid` among them; add
      `jsonCases` with a named override list only where a second consumer
      appears.
- [ ] Confirm coverage is unchanged — this must move test text, not test cases.
- [ ] `tsc`, `fjs t`.

### Related

- [`fjs/types/btree/todo/proof-tree-corpus.md`](../../types/btree/todo/proof-tree-corpus.md)
  — the same "shared harness and fixtures belong in a `testlib.f.mjs`" move
  for another module's proofs.
- [65Y-proof-assertEq-adoption](../../emergent_testing/todo/65y-proof-asserteq-adoption.md)
  — orthogonal assertion cleanup.
- [the DJS parser](../../fsc/parser/README.md) — its token-symbol alphabet
  needs its own recognizer adapter, but can share `Case` / `assertRecognizes`.
