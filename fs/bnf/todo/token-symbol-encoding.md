## Encode multi-character tokens as single BNF input symbols

**Priority:** P3
**Status:** open

### Problem

The parser-level BNF consumes tokens produced by the BNF-based tokenizer, one
input symbol per token (see [tokens-with-extra-information](./tokens-with-extra-information.md)
and [layered-parser](./layered-parser.md)). Token categories map naturally to
single ASCII symbols (`i` for identifier, `0` for number), single-character
operators map to themselves, and values travel as metadata. Multi-character
operators (`>>`, `&&=`, `>>>=`, …) and keywords have no obvious single-symbol
encoding.

Constraints on any encoding:

- An input symbol is 24 bits (`TerminalRange` packs two 24-bit symbols,
  `fs/bnf/module.f.ts:40`). Unicode occupies `0x000000`–`0x10FFFF`; `eof` is
  `0xFFFFFF`, the top of the 24-bit range, not `0x110000`, as of
  [#1308](https://github.com/functionalscript/functionalscript/pull/1308)
  (flagged by Codex on that PR: the old `0x110001`–`0xFFFFFF` free range
  included `eof`'s new value, so a real token encoded as `0xFFFFFF` would
  have collided with end-of-file). The free range for synthetic token
  symbols is now `0x110000`–`0xFFFFFE` (~15.6M values, `eof` excluded).
- Token symbols must not collide with each other (injective). Whether they
  must also avoid the code-point/`eof` region depends on which encoding family
  is chosen.
- Construction must fail fast at grammar-construction time on input that
  cannot be encoded.
- A reverse mapping (symbol → token string) is wanted for parser error
  messages and debugging.
- The longest JS operator is `>>>=` (4 characters), so packing raw code
  points (7–8 bits each) does not fit into 24 bits; a naive packing function
  would reject legitimate operators.

### Encoding families

No decision has been made yet. There are two main families.

#### 1. Intrinsic string encoding

The symbol is derived from the string alone. The same string always has the
same symbol without registering the complete grammar alphabet, and decoding
does not require a table. Because arbitrary strings cannot map injectively into
24 bits, this family necessarily supports only a restricted string language.

Possible intrinsic encodings:

1. **Deterministic packing over a restricted alphabet.** A function
   `tokenSymbol(s: string): TerminalRange` encodes `s` positionally over an
   explicit, append-only alphabet of the ~14 characters used by multi-char
   operators (`= ! < > + - * / % & | ^ ? .`), base 32, digit values starting
   at 1 (prefix-free across lengths), offset above `0x110000` (Unicode's end,
   *not* `eof` — `eof` itself is `0xFFFFFF` as of
   [PR #1308](https://github.com/functionalscript/functionalscript/pull/1308)
   and offsetting above it would either overflow the 24-bit symbol or land on
   `eof` itself). 4 characters × 5 bits = 20 bits — fits, with 4 bits of
   headroom left to add the `0x110000` offset and still land under
   `0xFFFFFE`. Cannot encode keywords (10 characters do not fit in 24 bits
   under any base).

2. **Base64-style packing over the full 24-bit range.** Same positional
   mechanism as above, but with a 64-symbol (6-bit) alphabet — lowercase
   `a`–`z` (26) + digits `0`–`9` (10) + the 14 operator characters (50 total),
   leaving spare codes for `_`, `$`, and a few more. 4 characters × 6 bits =
   24 bits exactly, so this **cannot** also carry an offset above Unicode or
   `eof`.

   This is acceptable if token symbols form a distinct alphabet from code
   points rather than merely values outside the code-point range: per
   [layered-parser](./layered-parser.md), the tokenizer layer (code-points →
   tokens) and parser layer (tokens → AST) consume different alphabets end to
   end. Nothing downstream of the tokenizer interprets a token symbol as a
   code point.

   The one same-grammar collision risk comes from the convention that
   single-character operators map to themselves (`{`, `}`, `[`, `]`, `,`,
   `-`, …). Those literal values occur in the same grammar as packed token
   symbols. The packing must avoid the single-character values used by that
   grammar, or all tokens must go through the same packing function.

   Reserve code `0b11_1111` (63) as an explicit stop marker, with all following
   digits also set to 63. The empty string then packs to `63,63,63,63`, exactly
   `0xFFFFFF`, so `eof` is the intrinsic encoding of `""` rather than a separate
   special case.

Intrinsic packing preserves symbols when unrelated names are added or reordered,
but it cannot encode names longer than the fixed information capacity. Keywords
such as `function` and `instanceof` therefore require another mechanism.

#### 2. Registered-alphabet encoding

The constructor receives the complete finite list of symbol names and returns
an encoding limited to that alphabet:

```ts
const encoding = createEncoding(names)
```

The names may have arbitrary length; only the number of registered names must
fit into the symbol range. The registry also supplies the reverse mapping.
There are two main assignment strategies.

1. **Hash assignment with collision validation.** Compute a candidate symbol
   from a seed and name, register every name, and reject the complete encoding
   if two names produce the same symbol:

   ```ts
   const encoding = hashEncoding(seed, names)
   // Encoding<typeof names[number]> | undefined
   ```

   For static grammars, a helper can assert successful construction:

   ```ts
   const encoding = hashEncodingUnwrap(seed, names)
   ```

   Names are independent of list position, so reordering the list does not
   change symbols and appending a name normally preserves existing symbols.
   Construction can fail because of a collision; changing the seed selects a
   different mapping. Decoding still uses the registered reverse table because
   a truncated hash is not intrinsically reversible.

2. **Positional/index assignment.** Use each name's position in the passed
   array as its symbol, optionally offset into the synthetic range:

   ```ts
   symbol = start + index
   ```

   This is dense, simple, and collision-free after validating duplicate names
   and capacity. Symbol values depend on array order. Keeping the list
   append-only preserves existing values; insertion or reordering changes them.

Both registered strategies can expose the same interface:

```ts
type Encoding<T extends string> = {
    readonly encode: (name: T) => number
    readonly decode: (symbol: number) => T | undefined
}
```

The hash strategy is preferable when symbol values should depend on names rather
than list order. The positional strategy is preferable when the simplest,
densest, guaranteed construction matters more than order independence.

Rejected: hand-picked mnemonic characters per operator (mnemonics run out and
typos become silent grammar bugs).

### Open questions

- Are keywords (`if`, `const`, `instanceof`, …) distinct terminals in the
  parser grammar?
- Should one encoding cover every parser terminal, or should intrinsic packing
  cover short operators while a registered encoding covers longer names?
- For a registered encoding, is order-independent hash assignment worth
  collision checking and seed management, or is positional assignment simpler?
- Must token symbols be numerically disjoint from code points, or is separation
  between parser layers sufficient?

### Tasks

- [ ] Decide whether keywords are distinct terminal symbols
- [ ] Choose intrinsic packing, registered encoding, or a combination
- [ ] If intrinsic: settle the exact alphabet, range, and stop-marker rules
- [ ] If registered: choose hash or positional assignment and define the symbol
      range
- [ ] Implement validation, encoding, and reverse mapping
- [ ] Use the encoding in the tokenizer output and parser grammar

### Related

- [tokens-with-extra-information](./tokens-with-extra-information.md) — the
  token-stream pipeline this encoding plugs into
- [layered-parser](./layered-parser.md) — tokens as the alphabet of the next
  parser layer
- `fs/bnf/module.f.ts:40` — 24-bit `TerminalRange` encoding; `eof` at
  `fs/bnf/module.f.ts:106`
- [PR #1308](https://github.com/functionalscript/functionalscript/pull/1308)
  — moved `eof` to `0xFFFFFF`; the Codex review comment on that PR is what
  prompted narrowing the free range above
