# Hexadecimal Literals

**Priority:** P2
**Status:** open — approved, not implemented

A number or a `bigint` written in base 16, as JavaScript writes it:

```js
export default [0xFF, 0XfF, 0x10n, -0x8000000000000000n];
```

## Proposal

Accept ECMAScript's `HexIntegerLiteral`, as a number and, with the `n`
suffix, as a `bigint`: `0x` or `0X`, then one or more hexadecimal digits
`0`–`9`, `a`–`f`, `A`–`F`, then optionally `n`. A literal denotes the value
JavaScript gives it:

- a number is the IEEE 754 double nearest the integer the digits spell, as a
  decimal literal is ([numbers](../README.md#numbers)), so
  `0x20000000000001` is `9007199254740992`;
- a `bigint` is that integer exactly;
- the sign stays the unary minus operator, so `-0x10n` is the negation of
  `0x10n`, and lowering folds it into the leaf `-16n` as it folds `-16n`.

The rest follows JavaScript, and each point needs a proof:

- After `0x`, `e` and `E` are digits, not an exponent: `0x10e1` is `4321`.
- A hexadecimal literal has no fraction and no exponent. A `.` after one is
  the next token, so `0x10.length` is an access, as in JavaScript. A decimal
  literal needs `16 .length` or `(16).length` for the same access.
- `0x` with no digit is an error, and so is a letter that is not a digit
  directly after the digits (`0xg`, `0x1g`), as in JavaScript. The grammar
  has no poison branch for this, as with `123abc`: it reads the literal and
  then a word, and the layer above refuses the two standing side by side.
- The lexeme keeps its spelling, and each token kind computes its value
  from it as it does today: a `bigint` token is its value already, read by
  `BigInt` in the tokenizer, which reads `0x10` as `16n`; a number token
  keeps its text, and the parser reads it with `Number`, never with
  `parseFloat`, which reads `0xFF` as `0`.

Every output that can write the value writes the value and not the spelling:
`0xFF` writes `255` and `0x10n` writes `16n`. An output that cannot write a
value refuses it as it does today, whichever spelling it came from: `.json`
refuses every `bigint`, and `.rs` one outside `i64`. A single-quoted string
is likewise written between double quotes. The graph does not record the
spelling, so two modules that differ only in it hash the same.

## Benefits

- **Familiar code compiles.** At `3646192`, 116 of the 405 `.f.mjs` modules
  use hexadecimal literals, about 3,600 occurrences, about 2,100 of them
  `bigint`s: byte constants, masks, Unicode ranges and hash words. Every one
  of those modules is refused today, so no module that deals in bits can
  become `.f.js`. `fjs/types/nibble_set` is refused on `0xFFFF` before
  anything else.
- **Readability where the base is the meaning.** `0xFFFF`, `0x7F` or
  `0x6a09e667n` say what `65535`, `127` or `1779033703n` hide.
- **No new value.** Hexadecimal spells integers the language already has.
  The EDAG, the VM, the value outputs and the hash are unchanged.

## Drawbacks

- **Two spellings of one value.** `255` and `0xFF` become one node, and a
  writer cannot give the spelling back. The writer already loses single
  quotes, so this is no new kind of loss.
- **The grammar grows by one branch.** The `0` that begins a number now also
  begins `0x`, which takes the `n` as a decimal integer does; the fraction
  and the exponent stay decimal only. The grammar stays LL(1), since `x` and
  `X` begin nothing else after `0`.
- **The front end diverges from JSON and DataJS.** DataJS's grammar,
  `fjs/ebnf/lib/datajs`, does not change, and neither does JSON's: a
  FunctionalScript module may spell what a DataJS document may not. This
  matches the split single quotes already made.
- **JavaScript compatibility.** None lost. The change only accepts
  JavaScript, with JavaScript's values.

## Out of scope

The other spellings in the same roadmap item stay open, each needing its own
approval:

- binary `0b`, which may follow later with the same value rule;
- octal `0o`, which has no use case yet;
- numeric separators, `0xFF_FF` and `1_000`;
- `.5` and `1.`;
- legacy octal (`010`), which stays refused here.

## Approval

`sergey-shandar` approved hexadecimal number and `bigint` literals, with
octal and binary kept out of scope, in the
[session that proposed them](https://claude.ai/code/session_01NHkT6r3jWYESeWwhL8x6tk),
as [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires. The proposal was written by Claude, so the approver is not the
proposer.

## Tasks

- [x] Language-design approval, recorded above.
- [ ] Grammar: a `0x`/`0X` branch with an optional `n` after the leading `0`
      in `number` in [`fjs/ebnf/lib/js`](../../fjs/ebnf/lib/js/module.f.mjs),
      leaving `fjs/ebnf/lib/json` and `fjs/ebnf/lib/datajs` unchanged.
- [ ] Values: read a number token with `Number` instead of `parseFloat`, in
      [`fjs/compiler/parser/syntax`](../../fjs/compiler/parser/syntax/module.f.mjs)
      (literals) and in `keyNamed` in
      [`fjs/compiler/parser`](../../fjs/compiler/parser/module.f.mjs)
      (numeric keys, `a[0x10]`). `BigInt` in `toJsToken` in
      [`fjs/js/tokenizer`](../../fjs/js/tokenizer/module.f.mjs) already
      reads `0x10`.
- [ ] Proofs: values with both cases of `x` and of the digits, `bigint`
      included; `0x10e1`; rounding above 2^53; `-0x10n` folding;
      `0x10.length`; the refusals `0x`, `0xg`, `0x1.5`; and the value
      outputs writing the decimal value where they can write it at all.
- [ ] Spec: the [numbers](../README.md#numbers) and
      [bigints](../README.md#bigints) sections accept hexadecimal, and item
      2.3.4 of [the roadmap](./README.md) drops it.
- [ ] Rename `fjs/types/nibble_set` to `.f.js` once destructured parameters
      also land, or rewrite its one destructuring.

## Related

- [numbers](../README.md#numbers) and [bigints](../README.md#bigints): the
  current text, which refuses hexadecimal.
- [js-string-literals](./2460-js-string-literals.md): the single-quote
  precedent for a spelling the front end accepts and DataJS does not.
- [`?.` before a digit](../../fjs/js/tokenizer/todo/optional-chain-before-digit.md):
  the other open tokenizer question about numbers.
