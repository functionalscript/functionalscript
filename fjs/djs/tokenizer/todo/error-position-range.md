## Report token errors as a position range

**Priority:** P3
**Status:** open

### Problem

An error token carries one `TokenMetadata` (`{ path, line, column }`,
`fjs/js/tokenizer/types.ts:99-103`) — a single point. For errors whose whole
meaning is a span, one point cannot say what the reader needs.

Unterminated tokens are the clear case. The grammar *matches* an unterminated
string and tags it `unterminated`, so `tokenizeJs` takes the structural-error
path and `metadataAfterTag` (`fjs/djs/tokenizer/module.f.ts:512`) reports the
position of the token's **start**:

| Input | Reported | Where the input ran out |
|---|---|---|
| `"value` | 1:1 | 1:7 |
| `"unterminated` | 1:1 | 1:14 |
| `"a\nb"` | 1:1 | 2:3 |

The start is a defensible anchor — TypeScript reports "Unterminated string
literal" at the opening quote too — so this is not a wrong-position bug. The gap
is that only one of the two useful positions survives. "Unterminated string
starting at 1:1" and "expected `\"` before end of input at 1:14" are both worth
saying, and a caret-and-underline renderer needs both to draw anything.

The inconsistency this creates is visible in the current expectations
(`fjs/djs/tokenizer/proof.f.ts`, `errorPosition` group): `'"value'` reports the
token start at 1:1, while `'/* c'` — also unterminated — reports 1:5, the end of
input, because the comment's content is consumed before the tag is emitted. Two
unterminated constructs, two different conventions, and neither can express what
the other does.

### Proposal

Give an error token a start and an end.

```ts
export type TokenRange = {
    readonly start: TokenMetadata
    readonly end: TokenMetadata
}
```

Options, to be settled when implementing:

1. Add a range to the error token only (`ErrorToken` gains a `range` field),
   leaving every other token's `metadata` a point. Smallest change; keeps the
   common path untouched.
2. Widen `JsTokenWithMetadata.metadata` to a range for every token. More
   uniform, and a token *is* a span — but it touches every construction and
   every metadata expectation in the proofs.

Prefer 1 unless a second consumer wants spans for non-error tokens, in which
case 2 stops being speculative.

Whichever is chosen, `path` should not be duplicated across both ends — a token
does not straddle files.

### Tasks

- [ ] Choose the shape; define `TokenRange`
- [ ] Carry the start position through the structural-error path so both ends
      are available where `metadataAfterTag` builds the error today
- [ ] Make the unterminated-comment and unterminated-string cases agree
- [ ] Update the `errorPosition` and `metadata` proof groups
- [ ] `npx tsc`, `fjs t`

### Related

- [../../../bnf/todo/new-parser.md](../../../bnf/todo/new-parser.md) — proposes
  the same widening one layer up, for `ParseError.metadata`. The two should pick
  the same range type rather than inventing one each; whichever lands first owns
  it.
- [../../../bnf/descent/README.md](../../../bnf/descent/README.md#failure-reporting)
  — `DescentFailure` reports the furthest rejected position. It does **not**
  cover this case: an unterminated token is a successful match with a tag, not a
  failed one, so no descent failure is involved.
- [error-message-specificity](./error-message-specificity.md) — every error is
  the same `'invalid token'` string; complementary, and both are needed before
  the tokenizer can produce a useful diagnostic.
