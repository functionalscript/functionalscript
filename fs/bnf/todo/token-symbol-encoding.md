## Encode multi-character tokens as single BNF input symbols

**Priority:** P3
**Status:** open

### Problem

The parser-level BNF consumes tokens produced by the BNF-based tokenizer, one
input symbol per token (see [tokens-with-extra-information](./tokens-with-extra-information.md)
and [layered-parser](./layered-parser.md)). Token categories map naturally to
single ASCII symbols (`i` for identifier, `0` for number), single-character
operators map to themselves, and values travel as metadata. Multi-character
operators (`>>`, `&&=`, `>>>=`, …) have no obvious single-symbol encoding.

Constraints on any encoding:

- An input symbol is 24 bits (`TerminalRange` packs two 24-bit symbols,
  `fs/bnf/module.f.ts:23`). Unicode occupies `0x000000`–`0x10FFFF` and `eof`
  is `0x110000`, so `0x110001`–`0xFFFFFF` (~15.6M values) is free for
  synthetic token symbols.
- Token symbols must not collide with each other (injective) nor with the
  code-point/`eof` region.
- Construction must fail fast (throw at grammar-construction time) on input
  that cannot be encoded.
- A reverse mapping (symbol → token string) is wanted for parser error
  messages and debugging.
- The longest JS operator is `>>>=` (4 characters), so packing raw code
  points (7–8 bits each) does not fit into 24 bits; a naive packing function
  would reject legitimate operators.

### Options

No decision has been made yet.

1. **Deterministic packing over a restricted alphabet.** A function
   `tokenSymbol(s: string): TerminalRange` encodes `s` positionally over an
   explicit, append-only alphabet of the ~14 characters used by multi-char
   operators (`= ! < > + - * / % & | ^ ? .`), base 32, digit values starting
   at 1 (prefix-free across lengths), offset above `eof`. 4 characters × 5
   bits = 20 bits — fits. No registry; the same string always yields the same
   symbol; decodable. Cannot encode keywords (10 characters do not fit in 24
   bits under any base).
2. **Enumerated table.** One append-only list of all multi-symbol tokens;
   symbols assigned sequentially from `0x110001`. A lookup function throws on
   unknown strings. Uniform for operators *and* keywords, no length limit;
   symbol values depend on list order, so the list must be append-only.
3. Rejected: hashing (collisions, not decodable); hand-picked mnemonic
   characters per operator (mnemonics run out, typos become silent grammar
   bugs).

Open question that drives the choice: are keywords (`if`, `const`,
`instanceof`, …) distinct terminals in the parser grammar? If yes, option 1
alone is insufficient and a second mechanism (or option 2 for everything)
is needed.

### Tasks

- [ ] Decide whether keywords are distinct terminal symbols
- [ ] Choose between packing (option 1) and enumeration (option 2)
- [ ] Implement the encoding function with validation and the reverse mapping
- [ ] Use it in the tokenizer output and the parser grammar

### Related

- [tokens-with-extra-information](./tokens-with-extra-information.md) — the
  token-stream pipeline this encoding plugs into
- [layered-parser](./layered-parser.md) — tokens as the alphabet of the next
  parser layer
- `fs/bnf/module.f.ts:23` — 24-bit `TerminalRange` encoding; `eof` at
  `fs/bnf/module.f.ts:96`
