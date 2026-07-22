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
  `fs/bnf/module.f.ts:40`). Unicode occupies `0x000000`–`0x10FFFF`; `eof` is
  `0xFFFFFF`, the top of the 24-bit range, not `0x110000`, as of
  [#1308](https://github.com/functionalscript/functionalscript/pull/1308)
  (flagged by Codex on that PR: the old `0x110001`–`0xFFFFFF` free range
  included `eof`'s new value, so a real token encoded as `0xFFFFFF` would
  have collided with end-of-file). The free range for synthetic token
  symbols is now `0x110000`–`0xFFFFFE` (~15.6M values, `eof` excluded).
- Token symbols must not collide with each other (injective). Whether they
  must also avoid the code-point/`eof` region depends on which option below
  is chosen — see the "packing range" note under option 2.
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
   bits = 20 bits — fits, with 4 bits of headroom left to add the offset
   above `0x110000` and still land under `0xFFFFFE`. Cannot encode keywords
   (10 characters do not fit in 24 bits under any base).
2. **Base64-style packing over the full 24-bit range.** Same positional
   mechanism as option 1, but with a 64-symbol (6-bit) alphabet — lowercase
   `a`–`z` (26) + digits `0`–`9` (10) + the 14 operator characters from
   option 1 (50 total), leaving spare codes for `_`, `$`, and a few more.
   4 characters × 6 bits = 24 bits exactly, so this **cannot** also carry
   option 1's "offset above `eof`" — there is no spare bit left for it. This
   is fine as long as token symbols are a distinct alphabet from code points
   rather than merely values *outside* the code-point range: per
   [layered-parser](./layered-parser.md), the tokenizer layer (code-points →
   tokens) and the parser layer (tokens → AST) already consume different
   alphabets end to end, so nothing downstream of the tokenizer ever
   interprets a token symbol as a code point — the two 24-bit spaces don't
   need to be numerically disjoint, only never compared to each other.
   **The one real wrinkle**: this problem statement's own "single-character
   operators map to themselves" convention (`{`, `}`, `[`, `]`, `,`, `-`, …
   reuse their own code point as their token symbol, per
   [tokens-with-extra-information](./tokens-with-extra-information.md)) *is*
   a same-grammar collision risk — those literal single-char symbols sit in
   the same `Variant`/rule set as the packed multi-char symbols, so the
   packing alphabet must still avoid whichever single-char code points are
   actually used as token literals in that grammar (a small, enumerable set,
   not all of Unicode) — or every token, single- and multi-character alike,
   goes through the same packing function for full consistency, giving up
   the "maps to itself" convenience entirely.
   **`eof` boundary:** with a full 64-code alphabet and no reserved pad
   value, the all-max digit combination (`63,63,63,63` in base 64) packs to
   exactly `0xFFFFFF` — `eof`'s value (see
   [PR #1308](https://github.com/functionalscript/functionalscript/pull/1308)).
   Reserving one code as an explicit pad/terminator (mirroring option 1's
   "digit values start at 1" prefix-free trick — needed anyway to decode
   strings shorter than 4 characters unambiguously) already keeps every real
   digit ≤ 62, capping the maximum packed value below `0xFFFFFF` and closing
   this collision for free; still comfortably fits the 50-character alphabet
   above.
3. **Enumerated table.** One append-only list of all multi-symbol tokens;
   symbols assigned sequentially from `0x110001`. A lookup function throws on
   unknown strings. Uniform for operators *and* keywords, no length limit;
   symbol values depend on list order, so the list must be append-only.
4. Rejected: hashing (collisions, not decodable); hand-picked mnemonic
   characters per operator (mnemonics run out, typos become silent grammar
   bugs).

Open question that drives the choice: are keywords (`if`, `const`,
`instanceof`, …) distinct terminals in the parser grammar? Option 2's larger
alphabet covers every keyword up to 4 characters (`if`, `do`, `in`, `of`,
`for`, `let`, `var`, `new`, `try`, `else`, `case`, `enum`, `this`, `void`,
`with`, `null`, `true`, …) that option 1 cannot, but neither packing option
reaches 5+ character keywords (`class`, `const`, `while`, `yield`, `throw`,
`function`, `instanceof`, …) — those still need option 3, either for
keywords alone (mixed with option 1 or 2 for operators) or for everything.

### Tasks

- [ ] Decide whether keywords are distinct terminal symbols
- [ ] Choose between packing (option 1 or 2) and enumeration (option 3)
- [ ] If packing: settle the exact alphabet (including the pad/terminator
      code) and confirm the `eof`-collision analysis under option 2
- [ ] Implement the encoding function with validation and the reverse mapping
- [ ] Use it in the tokenizer output and the parser grammar

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
