## DataJS conformance vectors

**Priority:** P1 — it blocks stage 4, which is P1. Raised with the stages it
sits between; see
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md).
**Status:** open

### Problem

[`spec/datajs/README.md`](../README.md) states conformance in prose. Prose
cannot be executed, so nothing stops the reference implementation and the
specification from drifting apart — which is exactly what happened to the
`fjs/fsc` grammar that stage 2 deleted, unproven and unimported.

Two later stages need this corpus. Stage 4 (`fjs/media/datajs`) must prove its
parser and serializer implement *the spec* rather than each other, and stage 6
must prove the DataJS ⊂ FunctionalScript ⊂ JavaScript subset laws.

Stage 3 is **not** a consumer, though an earlier draft of this file said it was.
Stage 3 is JSON's tokenizer, and what it must prove — that its accepted set
stays JSON's, but for the one enumerated `n`-deletion defect its invariants
name — is a property of JSON, established by JSON's own
accepted-input proofs and by those two invariants
[self-contained-tokenizer](../../../fjs/media/json/todo/self-contained-tokenizer.md)
states, with its character sweeps as coverage rather than proof: that design is
explicit that no finite sweep is exhaustive. A DataJS corpus has nothing to say
about any of it.

**This corpus must therefore land before or together with stage 4**, which is
compatible with running stage 3 first: the sequence is 3, then 1b, then 4.
Landing stage 4 without it would mean writing stage 4's proofs twice.

### Proposal

A machine-readable corpus with six parts.

**Document inputs come in two forms.** Code-unit arrays carry all but two of
the rules below, and rightly: those rules are about the token stream, and a
corpus that made every consumer decode UTF-8 first would be testing its own
reader. Two rules are *not* about the token stream and cannot be reached that
way at all, so their vectors carry a **byte array** instead, fed to the
reader's public byte-accepting path — which stage 4 owes:

- a document **has no BOM**, which a decoder satisfies the parser on by
  stripping `EF BB BF` before the parser ever runs; and
- a document **is UTF-8**, which nothing in a code-unit array can violate — so
  vectors carry invalid UTF-8 to be refused, **one per error class and one at
  each end of every class**, since a decoder can reject a class's lowest member
  and accept its highest just as easily as it can reject one class and accept
  another. Each class is a *range*, and naming a class without its endpoints
  leaves the vector's value to whoever picks it:

  | class | lowest | highest |
  | - | - | - |
  | invalid lead byte, low | `C0` | `C1` |
  | invalid lead byte, high | `F5` | `FF` |
  | stray continuation byte | `80` | `BF` |
  | overlong, three bytes | `E0 80 80` | `E0 9F BF` |
  | overlong, four bytes | `F0 80 80 80` | `F0 8F BF BF` |
  | encoded surrogate | `ED A0 80` (U+D800) | `ED BF BF` (U+DFFF) |
  | above U+10FFFF | `F4 90 80 80` | `F4 BF BF BF` |

  Each overlong range's highest member sits immediately below that width's
  valid minimum — `E0 9F BF` under `e0 a0 80`, `F0 8F BF BF` under
  `f0 90 80 80` — so the pairs bracket the transition from both sides, and the
  same holds for the surrogate hole and the U+10FFFF edge. The two-byte
  overlong `C0 80` needs no row: `C0` is an invalid lead outright, measured, so
  the invalid-lead class already carries it.

  Two classes are not ranges and keep their own vectors. A **truncated
  sequence** (`C2` at end of input) has no vector at all — see the exemption
  below. A valid lead followed by a **non-continuation** byte needs one per
  position **in every width that has that position**, and the intruding byte
  has two sub-classes, so each cell holds two vectors — the whole matrix, not a
  diagonal of it and not one half of each cell:

  | width | position 1 | position 2 | position 3 |
  | - | - | - | - |
  | two bytes | `C2 41` / `C2 C2` | — | — |
  | three bytes | `E2 41 80` / `E2 C2 80` | `E2 82 41` / `E2 82 C2` | — |
  | four bytes | `F0 41 80 80` / `F0 C2 80 80` | `F0 9F 41 80` / `F0 9F C2 80` | `F0 9F 98 41` / `F0 9F 98 C2` |

  A byte is a continuation exactly when it is `10xxxxxx`, so a
  non-continuation is either **high bit clear** (`00`–`7F`, the `41` column) or
  **high bit set but not a continuation** (`C0`–`FF`, the `C2` column). A
  decoder testing `b >= 0x80` where it means `0x80 <= b <= 0xBF` rejects every
  `41` cell and accepts every `C2` one — half of every cell in this matrix
  passing while the check it tests is wrong. Review found that after the first
  draft filled all six positions with `41` alone.

  The high-bit intruder must be a **valid lead byte**, which is why it is `C2`
  and not `C0` or `FF`: those are invalid leads outright, measured, so a vector
  using one has the invalid-lead class as a second ground for refusal and stops
  testing the position it was written for. Any valid lead does equally well —
  `C2` and `F4` differ nowhere under the one comparison that separates this
  sub-class from the other — so one representative per cell is enough. The
  ASCII intruder is constrained from the other direction: `00`–`1F` is a raw
  control character and `22` and `5C` end or escape the string that carries the
  vector, each a second ground for refusal, so the column sits in the printable
  remainder and `41` is that. An
  earlier draft had one cell per width — `C2 41`, `E2 82 41`, `F0 9F 98 41` —
  which is one diagonal, and a decoder with separate per-width branches
  passes a diagonal while failing every cell it misses. All twelve measured
  invalid, each for "invalid continuation byte" rather than any other reason.

  The non-continuation class and the truncated case are distinct failures
  despite looking alike:
  Python's decoder names them differently, "unexpected end of data" against
  "invalid continuation byte". Review
  supplied three of these seven after the first draft sampled three, which is
  the same "enumerate, do not sample" the productions below need. Each malformed
  sequence sits **inside an otherwise valid quoted string**, and that placement
  is the vector. A permissive decoder replaces a bad sequence with U+FFFD, and
  U+FFFD is an ordinary DataJS string character — so with the sequence inside a
  string the replacement yields a **valid** document, and refusal can only be
  for the malformed bytes. Put the same sequence between tokens or alone and
  the replacement yields an invalid document, which the parser rejects for its
  own reasons: the vector passes while the UTF-8 rule goes unenforced. This is
  the one-reason rule reaching the byte form.

  **Truncation at end of input has no vector, and the reason is worth more
  than one would be.** To be truncated the lead byte must be the document's
  last, so there is no closing quote and no `;`; adding them makes it `C2 22`,
  the non-continuation class instead. An earlier draft exempted it from the
  placement rule and kept it anyway, claiming the class survived and only the
  attribution was lost. That was wrong, and review said so: a byte reader that
  replacement-decodes the trailing lead and then rejects the unterminated
  document passes **without checking UTF-8 at all**, so the vector cannot fail
  and tests nothing. It is not a weakened vector, it is one of the
  cannot-fail vectors this corpus already refuses to ship.

  So the class is recorded as **untestable through a document-level byte
  input**, and the seam that would test it — asserting what the decoder does
  with the bytes, rather than what the reader does with the document — is
  raised as a task rather than invented here. Whether a conforming
  implementation must expose a decoder is an API question for the spec, not
  one this corpus should settle by requiring it of every consumer.

Byte-form vectors must **accept** as well as reject, and the accept set has a
derivation rather than a list. **Four leads constrain their second byte** —
`E0` admits `A0`–`BF`, `ED` admits `80`–`9F`, `F0` admits `90`–`BF`, `F4`
admits `80`–`8F`, since outside those the sequence would be overlong, a
surrogate, or above U+10FFFF. Those four constraints **partition the valid lead
bytes into eight parts**, and each part is a contiguous run of scalars a
decoder can implement, get wrong, or omit on its own. So: **both ends of every
part**, measured.

| lead | scalars | lowest | highest |
| - | - | - | - |
| one byte, in a string | U+0020–U+007F | `20` | `7f` |
| one byte, between tokens | tab, LF, CR | `09`, `0a`, `0d` | — |
| `c2`–`df` | U+0080–U+07FF | `c2 80` | `df bf` |
| `e0` | U+0800–U+0FFF | `e0 a0 80` | `e0 bf bf` |
| `e1`–`ec` | U+1000–U+CFFF | `e1 80 80` | `ec bf bf` |
| `ed` | U+D000–U+D7FF | `ed 80 80` | `ed 9f bf` |
| `ee`–`ef` | U+E000–U+FFFF | `ee 80 80` | `ef bf bf` |
| `f0` | U+10000–U+3FFFF | `f0 90 80 80` | `f0 bf bf bf` |
| `f1`–`f3` | U+40000–U+FFFFF | `f1 80 80 80` | `f3 bf bf bf` |
| `f4` | U+100000–U+10FFFF | `f4 80 80 80` | `f4 8f bf bf` |

The eight parts are contiguous and together cover **U+0080 through U+10FFFF
with exactly one hole**, U+D800–U+DFFF, which is the surrogate range and the
one place the reject side takes over. That is the check on the table: a part
whose neighbours do not meet it is a part written wrong.

**Four rounds of review each removed one way of sampling this instead of
deriving it**, and the shape repeated at every level:

- The first table used **interior** values, so a decoder rejecting a whole lead
  range passed: `C2`, `E0` and `F0 90` at the bottom, `DF`, `EF` and `F4` at
  the top.
- Then it had **one edge of each constrained lead** — `e0 a0 80`, `ed 9f bf`,
  `f0 90 80 80`, `f4 8f bf bf` — so a decoder accepting only `90` after `F0`,
  or only `8F` after `F4`, passed while refusing most of the plane. The
  opposite edges are accepts too, and are now the other end of those rows.
- Then it had no **surrogate hole** flanks. A hole in a range has two
  boundaries like any other, and a decoder rejecting the whole `ED` lead range
  refuses valid text up to U+D7FF while still rejecting the encoded surrogate
  correctly — passing the row's endpoints and the surrogate error class alike.
- Then, with every constrained lead covered twice over, the **unconstrained**
  ranges had nothing: no `e1`–`ec` and no `f1`–`f3` anywhere in the set, so a
  decoder implementing only the special branches — `E0`, `ED`, `F0`, `F4` — and
  refusing every ordinary four-byte sequence passed the whole corpus. Review
  found that one, and it is why the table is now indexed by **lead partition**
  rather than by width: the width framing had no row for a range that no
  constraint singles out, and so could not show one was missing.

**The one byte range depends on where the byte is**, which is why it is two
rows. Inside a string it starts at U+0020, because everything below is a
rejected raw control. Between tokens, tab, LF and CR are *permitted
whitespace*, so `09`, `0a` and `0d` are accepts — and they need byte-form
vectors of their own, because the code-unit whitespace accepts never reach a
decoder at all. A byte reader rejecting any of the three during decoding
passed every other vector here. An earlier draft of this table gave one
unqualified one-byte row starting at U+0020, which was the string rule applied
to the whole document; the same three characters are a rejection in one context
and an acceptance in the other, so no vector here may leave its context
unstated.

This table exists because a boundary needs a vector on each side, and the four
rounds listed above are review saying so four times running — U+10FFFF, then
the three minima, then the two- and three-byte maxima that were still interior
values in the same sentence claiming to cover both ends, then the ranges no
constraint singles out. Fixing the reported instance and not sweeping the rest
is what turned one finding into four. One
multibyte vector is not enough either — with only a two-byte
one, a decoder accepting ASCII and two-byte sequences while rejecting every
three- and four-byte sequence still passes, and the BMP and astral cases under
`normalize` cannot help because they exercise serializer output rather than a
reader. Every other case here is a rejection, so an implementation that
refuses every byte array without decoding it would pass them all while
refusing valid byte-encoded documents — which is the accept-direction rule
below, and review found this document breaking it in the same commit that
stated it.

A vector naming a code path the corpus cannot reach is worth less than no
vector, because it reads as coverage. Review found this document claiming a
code-unit BOM vector "tests the decoder" one round after adding it, which it
cannot: the corpus reader had already decoded it.

The six parts:

- **accept** — document text plus the graph it denotes, including the sharing.

  **Derived from the grammar: every production, and every branch of every
  production, owes an accept vector.** Review found the accept side short five
  times in three rounds — the four permitted whitespace characters, the lone
  surrogate, the byte form, the simple escapes, and the fraction and exponent
  — always because the set had been assembled from interesting cases rather
  than read off the productions. What that derivation requires, where the
  grammar branches:

  A production's **character classes** are part of where it branches, and they
  carry the same rule as the byte table above: **both ends of every range, at
  every position the class appears in**. An interesting case reaches for the
  middle of a range — `12`, `1.5`, `a9` — and a reader that implements `a`–`z`
  and forgets `A`–`Z`, or `[1-9]` and forgets `9`, is the ordinary way to get a
  class wrong.

  "Every position" means the **fixed** ones. `\uXXXX` has exactly four, so its
  endpoints are needed in each of the four — an implementation can unroll four
  reads and get the third wrong. A repetition like `[0-9]*` has no fixed
  positions to enumerate, so one occurrence of each endpoint anywhere in the
  repetition is the whole obligation; demanding more would be a rule no vector
  set can satisfy.

  - **`number ::= '-'? int frac? exp?`** — the sign present and absent, both
    `int` alternatives (`0` and `[1-9][0-9]*`), `frac` present and absent,
    `exp` present and absent, and within `exp` both letter cases and all three
    sign states: `0`, `-0`, `9`, `109`, `-109`, `1.09`, `-1.09`, `1e09`, `1E2`,
    `1e+2`, `1e-2`, `1.09e-2`. `9` and `109` put both ends of `[1-9]` in the
    leading position and both ends of `[0-9]` after it; `1.09` and `1e09` do
    the same for the digits of `frac` and `exp`, which `1.5` and `1e2` left in
    the middle. A reader accepting integers and the named words while rejecting
    every fraction and exponent passed the earlier set entirely.
  - **`string`** — all nine escapes, not just the one an interesting case
    happened to use: `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t` and
    `\uXXXX`, plus a raw non-ASCII character. The lone surrogate exercises
    `\u` alone, so a reader supporting raw text and `\u` while rejecting the
    eight simple escapes passed too. `\uXXXX`'s four hex digits are three
    ranges — `0`–`9`, `a`–`f`, `A`–`F` — in **four positions**, and the rule
    above says every endpoint in every position, which one pair of vectors
    cannot do: six escapes can, each position taking the six endpoints in a
    different rotation. Writing only the four hex digits of each:
    `09af`, `9afA`, `afAF`, `fAF0`, `AF09`, `F09a` — measured, every position
    carries all of `0`, `9`, `a`, `f`, `A`, `F`, and none of the six lands in
    `D800`–`DFFF`. A reader decoding only lowercase hex accepts the lone
    surrogate `\ud800` and every other escape vector while refusing an input
    spelling the grammar admits, and one unrolling its four digit reads accepts
    uppercase in the first two positions and refuses it in the last two.
    Review found both halves of that, one round apart.
  - **`bigint ::= '-'? int 'n'`** — both signs against both `int`
    alternatives: `0n`, `-0n`, `109n`, `-109n`. `int`'s own class endpoints are
    not repeated here: it is the same production `number` uses, and a reader
    with a separate digit scanner for bigints is not an implementation this
    grammar describes.
  - **`id ::= [A-Za-z_$][A-Za-z0-9_$]*`** — both positions, and both ends of
    every range in each. The first position admits six endpoints (`A`, `Z`,
    `a`, `z`, `_`, `$`) and the tail eight (those six plus `0` and `9`), which
    **`A9`, `Za`, `az`, `z_`, `_$`, `$A`** cover between them but for `0` and
    `Z` in the tail, which **`a0Z`** supplies. The contextual-keyword vectors
    (`async`, `as`, `from`, `get`, `of`, `set`) are all lowercase letters, so a
    reader rejecting `$`, a leading `_`, or any uppercase letter passed the set
    while narrowing a production it never touched — and the earlier set here,
    `$`, `_`, `_0`, `a$`, `a9`, closed the first two and left the third.
  - **`infinity`, `array`, `object`, `key`, `document`** — both signs; empty
    and non-empty; both `key` alternatives; zero `const`s and several.

  The reject half of this corpus is derived from the spec's narrowing rules,
  and this is its twin: the same discipline pointed at the productions instead
  of the prose. Ad-hoc accept sets fail in one direction only, which is why
  every one of those five was invisible until someone asked which way a vector
  pointed.

  Cases beyond that derivation, each earning its place: a **lone surrogate**, `export default "\ud800";` denoting the
  one-unit value `[0xd800]` — it appears under `normalize` and in the
  serializer-accept set too, but roles are judged independently, so a
  reader-only implementation whose string model cannot hold one passes every
  reader vector without this. **Four of them, not one**: the surrogate block is
  two ranges, high `D800`–`DBFF` and low `DC00`–`DFFF`, and an implementation
  tests them separately because pairing does — so `\ud800`, `\udbff`,
  `\udc00` and `\udfff`, both ends of both halves, in each of the three roles
  that carry the case. Review found the set using the high half's lower end
  alone, which a reader validating only `D800`–`DBFF` passes while refusing
  every isolated low surrogate; an **escaped
  surrogate pair**, `export default "\ud83d\ude00";` denoting the *two* units
  `[0xd83d, 0xde00]`, since a reader combining an escaped pair into one scalar
  returns the wrong graph and nothing else reaches that path — the lone
  surrogate exercises a single escape, and the four-byte UTF-8 accepts exercise
  the raw-character path. This document used that exact pair to argue for code
  units over code points and then never made it a vector; **each of the four
  permitted whitespace characters between tokens** — space, tab, LF and CR — because the rejection half of this corpus is
  extensive and a reader accepting only U+0020 passes every one of those
  vectors while narrowing the language; every leaf (`-0`, `NaN`, `±Infinity`,
  bigint, `undefined`), the
  `["__proto__"]` key, `-0n` — an accepted input spelling denoting `0n`, since
  bigint has no negative zero — a `const` referenced exactly once and a
  `const` never referenced at all — the grammar imposes no reference count, and
  the
  normalizer's counting rule is one serializer's rather than a validity rule —
  a `const` bound to a **contextual keyword** (`async`, `as`, `from`, `get`,
  `of`, `set`), which the grammar permits and a reader borrowing JavaScript's
  reserved-word list would refuse,
  duplicate keys (last value, first position), array-index key
  ordering **with both sides of its boundaries** — an index is
  `0 ≤ n < 2^32 − 1`, so the largest one is `"4294967294"` and the vector has
  to carry it as well as the first non-index `"4294967295"`, plus
  `"2147483648"`, the first index above the signed-32-bit range. One vector
  mixes them with small indices, an ordinary key, `"01"` (non-canonical) and
  `"1.0"`, and asserts the whole observable order:

  ```
  {"z":0,"4294967295":0,"4294967294":0,"2147483648":0,"1":0,"01":0,"1.0":0,"0":0}
      ⇒ 0, 1, 2147483648, 4294967294, z, 4294967295, 01, 1.0
  ```

  Each of the three large keys catches a different wrong cutoff, which is why
  none of them substitutes for another: `"4294967295"` catches an
  implementation treating every decimal-looking key as an index, and review
  found the corpus stopping there — with only that one, an **off-by-one**
  upper bound classifies every listed key correctly while leaving
  `"4294967294"` in first-occurrence order, and a **signed 32-bit** cutoff
  does the same from `"2147483648"` up. A boundary needs the value on each
  side of it, and the accepting side was the one missing. `{"2":0,"1":0}`
  alone is passed by an implementation that treats every decimal-looking key
  as an index, which reorders the ordinary keys above and corrupts observable
  key order; one-line and readable spellings of
  the same value; empty containers, deep nesting, and shared nodes reached by
  several paths.
- **reject** — document text plus what is wrong with it. Cases: a missing or
  non-final `export default`, a missing `;`, `;;`, a trailing comma, a comment,
  an `import`, an identifier key, a bare or string `"__proto__"` key and its
  escaped spelling `"\u005f_proto__"` (the rule is on the decoded value), a
  a number spelling JavaScript takes and DataJS does not — **every
  integer-literal family**, since sampling hexadecimal leaves the others open:
  `0x10`, `0b10`, `0o10`, and the same four as bigints, `0x10n`, `0b10n`,
  `0o10n`, `1_0n`, plus `+1`, `.5`, `1.`, `1_0`, `01` — and two identifier spellings it takes and DataJS does
  not: a **non-ASCII** one, `const é=1;export default é;`, and an **escaped**
  one, `const \u0061=1;export default \u0061;`. Both are valid JavaScript, so a
  reader borrowing the host's number or identifier grammar passes the whole-set
  JavaScript check and only this corpus can catch it. The escaped case is the
  one the ASCII rule alone does not reach: `\u0061` *denotes* `a`, which is a
  perfectly good `id`, so the vector is about the spelling and nothing else —
  which is also why **both** occurrences are escaped. Escaping only the
  declaration, as the review that found this proposed, leaves `export default
  a;` referring to a name DataJS never saw declared, and an implementation with
  no spelling check at all refuses it for the unbound reference — a second
  ground, and the rule below forbids exactly that; a
  computed key that is **not** the one permitted spelling — `{["x"]:1}` and
  `{["\u005f_proto__"]:1}`, since `["__proto__"]` is the only computed form
  the grammar admits — `1.5n`,
  `1e2n`, `01n`, `-NaN`, `-undefined`, a bare `-`, a forward or unbound
  reference, a rebound name, each excluded const name, and the string spellings
  JavaScript takes and DataJS does not: two **quoting forms** — single quotes
  and a template literal; every **escape outside JSON's nine** — `\v`, `\0`,
  `\'`, `` \` ``, `\x41`, `\u{41}`, and the **identity escape** `\z`, which
  stands for every other character and is what makes the rule a whitelist
  rather than a longer blacklist; and a **line continuation**, a backslash
  before a raw newline, which JavaScript reads as `"ab"` in
  `export default "a\<LF>b";`. Then the **raw control characters** a string
  may not contain — U+0000, U+0009 and U+001F, pinning both ends of the
  below-U+0020 range and one ordinary member, plus raw **LF** and **CR**. The
  first three are valid inside a JavaScript string literal and none inside a
  DataJS one; LF and CR are invalid in both, which classifies them as
  grammar-only tests rather than excusing their absence, since a standalone
  reader can accept a raw LF as string content while rejecting the other three
  correctly. Then the characters JavaScript
  treats as whitespace or a line terminator and DataJS does not, of which there
  are **21**, not the six the spec enumerates: U+000B, U+000C, U+2028, U+2029,
  U+FEFF, and the fifteen `Space_Separator` characters other than U+0020 —
  U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F and U+3000. **All 21 get
  vectors**, not one per shape. An earlier draft took six of the fifteen `Zs`
  characters — U+00A0, U+1680, U+2000, U+202F, U+205F, U+3000 — on the
  reasoning that an implementation reaching that class at all reaches all of
  it. Review was right that nothing guarantees it, and this paragraph carries
  the disproof in its own first sentence: **the spec's own list of these
  characters omitted fifteen of them**. A hand-written whitespace table with a
  hole in it is not a hypothetical here — it is the thing that made this
  section necessary — and a reader whose table stops at U+2000 accepts U+200A
  while passing every sampled vector. So: U+000B, U+000C, U+2028, U+2029,
  U+FEFF, U+00A0, U+1680, U+2000 through U+200A one each, U+202F, U+205F,
  U+3000. Twenty-one is not a set worth sampling. **U+FEFF needs vectors in two positions and two input
  forms.** Between tokens and as the document's first character are different
  tokenizer states, and a tokenizer may well skip a leading BOM specifically
  while rejecting one between tokens; both spellings are valid JavaScript,
  measured. But neither, as *code units*, reaches the rule that a document
  "has no BOM": every document in this corpus is a code-unit array, so the
  corpus reader has already decoded it, and a UTF-8 decoder that strips a
  leading `EF BB BF` hands the parser a document with no BOM in it to find.
  That vector has to be **bytes** — see the byte form below — and review
  caught this document claiming otherwise one round after adding the vector. Then the array **elisions** JavaScript reads as holes
  and the grammar `array ::= '[' (value (',' value)*)? ']'` cannot spell at
  all: `export default[,1];`, `[1,,2]` and `[1,,]`, leading, medial and
  trailing. `[1,]` is *not* one of these — it is the trailing comma above, a
  different rule, and it leaves no hole. Then the three places whitespace is
  *required*, one vector each: `constx=1;export default x;`,
  `exportdefault 1;` and `export default1;`.
- **serializer reject** — programmatic inputs a serializer must refuse rather
  than approximate: a function or symbol leaf, a non-plain built-in (`Date`,
  and at least one that is not — **`Map` or a boxed number**, not `RegExp`;
  see below), a sparse-array hole, a symbol-keyed, accessor or non-enumerable
  own property,
  an array carrying an own property beyond its elements and `length` (`a=[1];
  a.meta=2`), and a cycle — six of them, below. Each is a case where the
  obvious implementation emits a valid document denoting something else.

  The **accessor** case is two vectors rather than one — a getter and a
  setter-only property — because a serializer guarding on `descriptor.get`
  alone refuses the first and silently accepts the second. The getter vector
  asserts **two** things: that the input was refused, and that the getter was
  never invoked.

  The **cycle** case is six vectors: the two self-loops, and every **ordered
  pair** of container kinds around a two-node cycle. Two axes force that shape.

  Cycle **length** — a self-loop (`o.self=o`) against a cycle through a second
  container (`a.next=b; b.next=a`) — because a serializer whose only guard
  compares a child against its immediate parent refuses every self-loop and
  recurses forever on every pair.

  Cycle **container kind**, which is not a property of the cycle but of the
  walkers it passes through: a visited set lives in a walker, so `obj→obj`,
  `arr→arr`, `obj→arr` and `arr→obj` are four different traversals of what is
  otherwise one shape. The mixed pair is one cycle — `o.a=arr; arr[0]=o` —
  entered from `o` for the first and from `arr` for the second, since the root
  reaches one of the two nodes first and that is what a walker sees. Two implementations show the axis is real, and they fail
  on different cells:

  - **The set in one walker only.** With the immediate-parent check in both
    walkers and a visited set in the array walker alone, the diagonal
    *self-loop in an object* plus *pair of arrays* is refused entirely — and a
    pair of objects hangs. The mirror implementation misses the mirror
    diagonal. So both homogeneous pairs are required, and a diagonal will not
    do.
  - **The set reset at the walker boundary** — each walker keeping its ancestry
    as a local of its own recursion and starting a fresh one when it dispatches
    to the other kind. That refuses **both** homogeneous pairs correctly and
    recurses forever on `obj→arr→obj`, which is why homogeneous coverage is not
    coverage of the boundary. Review found this one, after the first draft of
    this paragraph called the axis binary.

  The remaining two cells — the second entry point of the mixed pair, and the
  second self-loop — are symmetric completion rather than demonstration: the
  boundary implementation hangs on a mixed cycle entered from either end, and I
  could not name an implementation that only one of them catches. The file says
  so rather than implying six separate demonstrations.

  All six cycles sit **one level below the root** — `root=[x]` with `x` on the
  cycle — for the reason the whole set shares, below.

  **Every serializer-reject vector puts its offending value below the root**,
  never as the root itself, and the placement is part of the vector exactly as
  it is for the malformed byte sequences above. A serializer that validates its
  argument and then recurses without validating again refuses every offender
  handed to it directly and emits a document for the same offender one level
  down — so a set that roots its offenders passes such an implementation
  whole. The placements **cover both container kinds across the set** — some
  offenders under an array element, some under an object property value — since
  a walker can recurse into one and not the other. That is a property of the
  set, not of each vector: one offender in each kind of container pins both
  recursion paths, so this axis multiplies the set by nothing.

  **Every rejection vector must be refusable for exactly one reason.** Review
  found three vectors that a *cheaper* rule could refuse before the rule under
  test ran — a non-enumerable `getter`, a non-enumerable `symbolKey`, and a
  `RegExp` carrying an own non-enumerable `lastIndex` — and in each the vector
  passed while the implementation was wrong. A vector with a second ground for
  refusal tests whichever ground the implementation happens to reach first,
  which is not the one it was written for.

  **Derive the narrowing vectors from the spec's own narrowing rules.**
  Everywhere DataJS is narrower than JavaScript, the whole-set subset law is
  blind — it asks only whether an *accept* vector is valid JavaScript, never
  whether something DataJS rejects would be accepted by the host — so a reject
  vector is the only instrument that sees it. Twenty-six consecutive review
  rounds each found one missing: the plain number spellings and the non-ASCII
  identifier together, then the *escaped* identifier spelling, then line
  continuations and template literals, then the remaining escapes, then the raw
  control characters, then the vertical tab and the required separators, then
  the fifteen `Space_Separator` characters the spec's own list omits, then the
  array elisions and the leading BOM, then the accept side of the whitespace
  rule, then the accept sides of the byte form and the lone surrogate, then
  the simple escapes and the fraction and exponent — the last two of which
  finally produced a derivation for the accept set rather than another pair of
  vectors — then the normalizer's escaping branches and JavaScript's own
  expression forms, then spread, the module statements, and two more UTF-8
  error classes — which finally produced a per-production table rather than
  another production's worth of vectors — then the serializer-accept set,
  which had no derivation at all, and the repeated primitive, then `id`'s
  character classes and the valid UTF-8 sequence widths — both of them
  derivations applied to some of their items and not all, which is the shape
  every one of the last four rounds has taken — then a seventh UTF-8 error
  class and the valid side of the U+10FFFF boundary, the latter repeating a
  failure this document had already named and attributed to the array-index
  keys — then two rules of this document's own contradicting each other, and
  two table entries that lost a binding between the measurement and the
  writing-down, then a truncation vector that could not fail, the lower
  boundary of every UTF-8 width, and non-continuation bytes at the later
  positions of a sequence — then the normalize set taking documents where a
  serializer role takes graphs, the two- and three-byte maxima, `__proto__` in
  the writing direction, and JavaScript's other integer-literal families —
  then the permitted control whitespace in byte form, which the accept table
  had excluded by applying a string rule to the whole document — then the
  overlong classes per width, the two accepts flanking the surrogate hole, and
  the lone surrogate and key order in the writing direction — then the upper
  edge of every invalid range, which turned the error classes into a table of
  endpoints for the same reason the valid widths became one — then the
  non-continuation matrix, which had been covered along one diagonal, and raw
  LF and CR, which one paragraph excluded on the reasoning another used to
  keep four sibling vectors — then the escaped surrogate pair, which this
  document argued for and never made a vector, and the `_0`/`_1` ordering,
  which no single-const case can test, and both edges of the four constrained
  second-byte ranges — then the whole serializer-reject side, where the cycle
  class was one vector for a class with two axes, the entire set left the
  offender's **placement** unstated where the byte set had pinned it three
  rounds earlier, the normalize numbers were six positive finite thresholds
  and nothing else, and post-order naming rested on two shared siblings, which
  pre-order names the same way — then the walker boundary the cycle set had
  just called a binary axis, `obj→arr→obj` passing every homogeneous cell, an
  exact-bytes vector written the round before that **spelled its object keys
  bare**, requiring a document the grammar rejects, and every cell of the
  non-continuation matrix using an ASCII intruder, so that half of the class —
  a high-bit byte that is not a continuation — had no vector anywhere — then
  the valid lead bytes **no constraint singles out**, `E1`–`EC` and `F1`–`F3`,
  which the accept table had no row for because it was indexed by width, so a
  decoder implementing only the four special leads passed the corpus — then
  the four vectors the round before had *just added under that rule*, which
  put uppercase hex in two of `\uXXXX`'s four positions and lone surrogates in
  one of the surrogate block's two halves, plus the normalize set's missing
  three-byte raw character and its two missing sign cases, ordinary negative
  numbers and ordinary negative bigints. A rule stated in a commit is not a
  rule applied to that commit's own vectors, which is the newest way this
  document has found to be short — then the whitespace class sampled six of
  fifteen on an assumption its own paragraph disproves, sharing tested only
  through arrays, and the host variations named on objects alone. The sweep for the lead-partition shape had
  already found the same hole in the **code-unit** accepts: every
  `id` vector was lowercase, `int` was `12`, `frac` was `1.5` and `\uXXXX`'s
  hex was lowercase, so four more classes were sampled in the middle where the
  rule says both ends. Every time the list had been written from memory rather
  than read off the spec, and the last three rounds are the telling ones: by
  then the class had been named *and* this derivation written, and the list was
  still short each time. Naming a class does not check a list; neither does a
  derivation pointed at the wrong sentence; and neither does one pointed at the
  right sentence that stops reading halfway through it, nor one that never
  enumerated the section at all. The spec narrows in six places, and each
  owes vectors:

  - **Strings** — and this is the section that kept biting, because it holds
    **three** rules in two sentences and each was found separately. §Strings
    *closes* by naming five forms — single quotes, template literals, `\x`,
    `\u{…}`, line continuations — but that closing sentence is an
    illustration, not the rule. The sentence before it carries the other two:
    the escape **whitelist** — `\"` `\\` `\/` `\b` `\f` `\n` `\r` `\t`
    `\uXXXX`, and nothing else — and the **raw-character** exclusion, "any
    other character except an unescaped `"`, an unescaped `\`, or a code point
    below U+0020". A whitelist's complement is not a list to copy, so both of
    those give vectors by class from JavaScript's grammar rather than by
    transcription. Successive drafts of this very derivation read the closing
    sentence and declared the string half complete at five, then read the
    whitelist and missed the raw-character clause **in the same sentence** —
    which is how `\v`, `\0`, `\'`, `` \` ``, `\z` and then the raw controls
    each stayed missing a round longer.
  - **Numbers** — the closing sentence of its §Numbers: no hex, no leading
    `+`, no leading or trailing point, no separators, no leading zeros.
  - **Identifiers** — §Identifiers' ASCII-only rule, which excludes both a
    non-ASCII letter and the `\uXXXX` spelling of an ASCII one.
  - **Whitespace** — §Whitespace, which narrows twice, and where the *spec's
    own list* is the trap. Its rule is general and correct: whitespace is
    exactly JSON's four characters, so **every other character JavaScript
    treats as whitespace or a line terminator** is rejected. The six it then
    names after a colon are illustrations, and measured against ECMAScript the
    real set is 21 — the colon list omits every `Space_Separator` character
    but U+00A0. Derive from the rule; the six are not a set to copy. §Whitespace
    also *requires* whitespace in three places, after `const`, after `export`,
    and before an identifier-starting value after `default`.

    This section has now been got wrong twice in successive rounds, each time
    by treating a list as closed: first the tail below was transcribed and
    dropped the vertical tab, then the spec's six were adopted as complete.
    A conforming reader needs none of this — it accepts four characters and
    rejects the rest, so it gets all 21 for free. Only a reader **delegating**
    to a JavaScript tokenizer over-accepts, which is precisely why the vectors
    have to exist and why they must reach the `Zs` class the spec never lists.
  - **The document rule** — "a document is UTF-8; it has no BOM". Separate
    from §Whitespace even though both concern U+FEFF, because it is about the
    *decoder* rather than the tokenizer: a leading BOM is stripped by ordinary
    decoding, so only a vector that pins U+FEFF as the **first character**
    tests it.
  - **The grammars themselves**, not only the prose — and **every** production,
    which is where this kept going wrong. A production states rejections no
    sentence in the spec states, and it is easy to skip precisely because there
    is nothing to transcribe; review found this source applied to one
    production at a time across three rounds. Every one of the cases below is
    valid JavaScript **evaluating to a value DataJS can express**, measured, so
    a reader that delegates parsing or evaluates the module gets a permitted
    value back and has no reason to object:

    | production | what it excludes | vectors |
    | - | - | - |
    | `document ::= const* export` | any other statement or declaration | `let a=1;…`, `var a=1;…`, `function f(){}…` |
    | `const ::= 'const' id '=' value ';'` | multiple declarators, destructuring | `const a=1,b=2;…`, `const [a]=[1];…` |
    | `export ::= 'export' 'default' value ';'` | any other export form | `const a=1;export{a};export default a;` |
    | `value ::= <closed list>` | every other expression form | `(1)`, `1+1`, `[1][0]`, `String(1)`, `void 0`, `-(-1)` |
    | `array ::= '[' (value (',' value)*)? ']'` | elisions, spread | `[,1]`, `[1,,2]`, `[1,,]`, `[...[1]]` |
    | `object ::= '{' (member (',' member)*)? '}'` | spread | `{...{"a":1}}` |
    | `member ::= key ':' value` | shorthand, methods, accessors | `const a=1;export default{a};`, `{a(){}}`, `{get a(){return 1}}` |
    | `key ::= string \| '[' '"__proto__"' ']'` | identifier and numeric keys, other computed keys | `{a:1}`, `{1:2}`, `{["x"]:1}` |

    Where a row shows a bare value it stands for `export default <value>;`.
    The two using `a` carry `const a=1;` because they need it: without the
    binding, `export{a}` and `{a}` are refusable for an unbound name as well
    as for their syntax, which the one-reason rule forbids — review caught
    both, and the measurements they came from *had* the binding, so this was
    lost between measuring and writing the table down.

    Two of these are worth singling out. **`value`'s** complement is
    open-ended, like the escape whitelist, so its vectors go by class rather
    than enumeration; and `-(-1)` pins the spec's own point that `-` is not an
    operator but part of the token that follows it. **`{get a(){return 1}}`**
    evaluates to `{"a":1}` — an entirely ordinary graph — so nothing after the
    parse can tell it apart from the document that spells it directly.

  **And check both directions.** The corpus has a reader half and a serializer
  half, and a rule can be covered in one while absent in the other — which has
  now happened twice in successive rounds. Required whitespace was covered by
  the *normalize* set, which constrains emitted bytes and cannot catch a reader
  accepting a document that omits a space. Array holes were covered by
  *serializer reject*, which takes a programmatic sparse array and cannot catch
  a reader accepting `[1,,2]` as document text. Each rule owes a vector in
  every direction it can be violated, and one direction's coverage reads
  exactly like the other's until someone asks which way it points.

  The third direction is **accept**, and it went missing the round after this
  was written. Rejection coverage alone cannot catch a reader that *narrows*
  the language: this corpus rejects seventeen kinds of whitespace and, until
  review asked, never accepted a document separated by a tab, an LF or a CR,
  so a reader honouring only U+0020 passed the lot. Every rule that admits
  something owes an accept vector for each thing it admits, not only reject
  vectors for the neighbours it excludes.

  Stating that rule did not make it applied. The very commit that wrote it
  added a byte-array input form with only rejecting vectors — so an
  implementation refusing every byte array would have passed — and left the
  lone surrogate, which the corpus can now transport, in the `normalize` set
  alone, where a reader-only implementation never meets it. Review found both
  in the next round. A new capability owes accept vectors at the moment it is
  added, not when someone asks.

  Plus what DataJS simply lacks where JavaScript has it: comments, `import`,
  identifier keys and trailing commas.

  **Two things are not on this list, and saying so keeps a later round from
  adding vectors that cannot fail.** JavaScript rejects `1.5n`, `1e2n` and
  `01n`; a strict module rejects the legacy octal escapes `\101` and `\8`; and
  and a raw LF or CR inside a string literal is a JavaScript SyntaxError too.
  None of that is grounds for *omitting* a vector, only for classifying it: a
  standalone reader can accept a raw LF as string content while rejecting NUL,
  TAB and U+001F correctly, so the vector still fails something. An earlier
  draft drew the opposite conclusion for LF and CR alone — skipping them while
  keeping the bigint and octal cases on identical reasoning, four lines apart —
  and they are reject vectors now like the rest. Two of the
  three **required-separator** vectors are the same: `export default1;` and
  `exportdefault 1;` are SyntaxErrors, since `default1` and `exportdefault`
  each lex as one identifier — the spec says as much about the first. They stay
  in the reject set as tests of the corpus's own grammar, against a reader that
  matches keyword prefixes itself, but they cannot catch a delegating one.
  `constx=1;export default x;` is the odd one and the only true narrowing of
  the three: it **parses** as JavaScript and fails at run time with a
  `ReferenceError`, so a reader delegating its parse accepts it. All measured,
  not assumed. Each tests the corpus's own grammar rather than
  a narrowing, because no reader can over-accept them by delegating to a host
  that refuses them too.

  The rule has now caught one *before* it landed — the escaped-identifier
  vector above, whose proposed spelling left an unbound reference as a second
  ground. That is the first time it worked as a design constraint rather than
  as a post-mortem, which is the whole point of writing it down.

  The rule reaches the leaves too, which review found by applying it: an
  ordinary function has own non-enumerable `name` and `length`, and a
  non-arrow adds a non-configurable `prototype` — so a serializer that
  never learned to reject functions can refuse one through its
  non-enumerable-property check. An arrow function's `name` and `length` are
  configurable, so deleting them leaves a callable with **no own properties**
  at all, and refusing it requires recognizing a function. `symbol` needs no
  such care: it has none to begin with.
- **serializer accept** — programmatic inputs a serializer must **not** refuse,
  each with the **graph its output must denote**. Not the exact document:
  whitespace, layout, const names and the hoisting of singly-reached values are
  free choices ([`README.md`](../README.md)), so pinning bytes here would fail
  conforming serializers. Exact bytes are the `normalize` set's business alone.
  **Derived from the data model, as the reader's accept set is derived from
  the grammar** — every leaf and every container shape, not only the host
  variations below. Conformance is per role, so a serializer-only
  implementation never runs a reader or normalize vector: one that handles
  every recipe here while rejecting every `bigint`, `undefined`, `NaN` or
  infinity passed the whole set. The leaves are JSON's four plus the five
  JavaScript adds — `undefined`, a bigint, `NaN`, `Infinity`, `-Infinity` —
  with `-0` beside them, and the containers are an empty and a non-empty
  array and object, nesting, and a node reached twice — in each of the three
  sharing shapes `graph equivalence` names below, since the walker a repeat is
  met in is what decides whether it is hoisted. That last one is not
  decoration: hoisting a value reachable more than once is the one thing the
  spec says is **not** a free choice, so it is the only container case whose
  output shape is constrained.

  Three cases need naming beyond the leaf and container shapes, because the
  reader's set covers them and a serializer-only implementation runs none of
  its vectors:

  - an object with an own enumerable **`__proto__`** data property, which a
    serializer could otherwise refuse though its own output syntax exists to
    express it — `{["__proto__"]:…}` is what the grammar provides that form for;
  - a string holding a **lone surrogate** — `[0xd800]`, `[0xdbff]`, `[0xdc00]`
    and `[0xdfff]`, both ends of both halves of the block, for the reason given
    under the reader set — with the vector asserting the emitted document
    denotes that exact code-unit sequence: a serializer that refuses such
    strings, or replacement-encodes them, passes any ASCII-string vector;
  - an object mixing **array-index and string keys**, since observable order is
    a property of the emitted document and nothing else in this set constrains
    it. Review reported the first two; this one came from sweeping the reader's
    set against this one afterwards, which is what should have happened when
    `__proto__` was added a round earlier.

  The remaining cases are host variations. The spec is explicit that these are
  outside the data model rather than invalid, and that rejecting them is a
  defect rather than caution ([`README.md`](../README.md)): a `null` prototype,
  frozen, sealed, non-extensible, and a non-writable property — **each on both
  an object and an array** — plus an `Array` subclass, which has only the one
  kind. `Object.freeze` produces the last two together, so a serializer that
  rejects unusual descriptors cannot serialize a frozen value — including the
  output of a reader that freezes what it returns, which the spec permits.

  **Both kinds because the walkers are separate**, the third place this corpus
  has needed that and the first where the risk is over-strictness rather than
  non-termination: a serializer validating shape in its object walker alone
  accepts every frozen object here and refuses the frozen array, and one
  dispatching on the prototype rather than on `Array.isArray` refuses the
  null-prototype array while `Array.isArray` still reports `true` for it,
  measured. Each variant exists on an array: a frozen array's elements come
  back `writable: false, configurable: false`, a sealed one is non-extensible
  with configurable elements, and an element can be made non-writable on its
  own — all measured, none of them a shape the object cases reach. What each vector asserts is
  that the output is **valid and denotes the input's data** — the host
  variation leaves no trace, and `graph equivalence` supplies the comparison.
- **graph equivalence** — an input graph and the documents that do and do not
  denote it, so a serializer cannot pass by emitting merely *valid* output:
  `[a,a]` with one shared `a` is not `export default [[],[]];`. **Three sharing
  shapes, not one**, for the reason the cycle set is every ordered pair of
  container kinds: the two references reached from an array (`[a,a]`), from two
  object properties (`{"x":a,"y":a}`), and from one of each
  (`[a]` beside `{"x":a}` under a common root). A serializer hoisting a repeat
  it meets inside one walker, but starting fresh when it dispatches to the
  other, gets both homogeneous cases right and inlines the mixed one — the same
  implementation that recurses forever on `obj→arr→obj`, here silently changing
  identity instead of hanging. Review found the set array-shaped throughout.
- **normalize** — an input **graph**, in the meta-encoding, and the exact bytes
  normalized form must produce. Not an input *document*: a normalized
  serializer is a serializer role, so its input is a programmatic value, and an
  implementation providing that role and no reader could not run a
  document-input set without implementing a role it never claimed. Review found
  every vector here starting from a document, which under per-role conformance
  left canonical output unchecked for exactly the implementations the set
  exists to check. Document-to-document normalization needs no new role — it is
  the reader's set composed with this one — so nothing is lost by making the
  input a graph. What each vector pins: const hoisting by reference identity, post-order `_0`, `_1`, …
  naming, `ToString(Number)` spelling with the `-0` exception,
  `QuoteJSONString` escaping — **every branch of it**, because a noncanonical
  spelling is still a *valid* document, so only exact bytes tell them apart:
  the seven simple escapes `\"` `\\` `\b` `\t` `\n` `\f` `\r`, any of which
  a normalizer may instead emit as `\u00XX`; any other code point below
  U+0020 as `\u00` plus two **lowercase** hex digits, so U+001F pins
  `\u001f` and not `\u001F`; a **lone surrogate**, which must come back
  escaped rather than as a replacement character, and all four of them —
  `\ud800`, `\udbff`, `\udc00`, `\udfff` — since the block is two ranges and
  a normalizer re-escaping only the high half emits a replacement character for
  the low; the **never-escaped `/`**, which a normalizer borrowing a JSON
  writer that escapes it gets wrong; and a **raw** character of every UTF-8
  width, which is what `QuoteJSONString` leaves unescaped, so their vectors pin
  the encoder's bytes: ASCII at one byte, which every other vector here already
  carries, then `c3 a9` for `é`, `e2 82 ac` for `€`, and `f0 9f 98 80` for
  U+1F600. Widths rather than the lead partition the reader's byte table uses,
  because an encoder branches on the scalar's magnitude and computes the lead
  from it. Without the multibyte three every pinned byte sequence in this set
  is ASCII and a serializer emitting Latin-1, or CESU-8's `ed a0 bd ed b8 80`
  for that astral character, passes a set whose whole promise is exact bytes;
  review supplied the three-byte width after the first draft had the other
  two, the gap a normalizer escaping every U+0800–U+FFFF scalar as `\uXXXX`
  walks straight through. Normalized output
  has **seven** simple escapes where the accept grammar admits **nine**: `\/`
  and `\uXXXX` are input spellings a reader must take and a normalizer must
  never emit, so the two lists differ on purpose and neither checks the other —
  observable key order, one-line layout. Pin **`export default[1,1];`** as the
  output for `const x=1;export default[x,x];`, because primitives always
  inline and a repeated one is the case where that bites: the shipped
  `fjs/djs` hoists it into a `const` today, which the spec's own divergence
  table lists as a difference this work closes. A normalizer carrying that
  behavior forward emits `const _0=1;export default[_0,_0];` — valid, denoting
  the same graph, and wrong — and nothing else in this set can see it. It is
  also the sharpest boundary in normalized form, since hoisting a **node**
  reached twice is mandatory while hoisting a repeated **primitive** is
  forbidden, and the two look identical to a serializer that counts
  references without asking what it is counting. Pin the `__proto__` key's exact bytes,
  `{["__proto__"]:1}`: a normalizer reusing an ordinary key writer emits
  `{"__proto__":1}`, which is not DataJS at all and which JavaScript reads as
  prototype replacement rather than an own property — a normalized form that
  denotes a different graph than its input. Pin that
  `-0n` normalizes to `0n` — the grammar accepts the spelling and normalized
  form must never emit it, which is the one place a bigint and a number differ
  on negative zero — and pin **`-109n`** beside it, because `-0n` is the one
  negative bigint whose output drops the sign, so a normalizer emitting the
  magnitude and an `n` passes it while turning every other negative bigint
  positive. Pin the
  number thresholds explicitly — `1e20`, `1e21`, `1e-6`, `1e-7`,
  `5e-324`, `1.7976931348623157e308` — since that is where a host's own
  formatter diverges. Those six are positive and finite, which leaves the three
  number leaves no threshold reaches: pin **`-0`**, **`Infinity`** and
  **`-Infinity`** as well. `-0` is the one value `ToString(Number)` cannot
  spell — measured, `String(-0)` is `"0"` — so a normalizer must special-case
  it, and `-0.0` and `-0e0` are valid documents denoting the same value; the
  infinities are likewise not their own only spelling, since `1e999` and
  `-1e999` evaluate to them. Those nine are still every sign case *except the
  ordinary one*: pin **`-1.5`** as well, since a normalizer formatting through
  the magnitude and special-casing `-0` and the infinities passes all nine and
  emits `1.5` for it. `NaN` needs no vector of this kind — the grammar
  gives it exactly one spelling — but it has one anyway as the
  identifier-starting root below. Pin `root=[p,p]` with `p=[c]` so the hoisting count
  is occurrences rather than paths — and pin **`root=[a,b,a,b]`**, two
  independent shared containers, so the `_0`, `_1` naming is tested at all.
  With a single hoisted const there is no order to get wrong: a normalizer
  traversing siblings in reverse names them backwards and passes every
  one-const case. Pin the object analogue too, since there first encounter
  follows observable key order rather than array position. Two shared
  **siblings** still leave *post*-order untested, because pre-order and
  post-order agree on siblings: pin **`root=[p,p,c]`** with `p=[c]`, a shared
  parent whose shared child is also reached from the root. Post-order names the
  child first — `const _0=[];const _1=[_0];export default[_1,_1,_0];` — where a
  normalizer naming on the way *down* emits
  `const _1=[];const _0=[_1];export default[_0,_0,_1];`, which is a valid
  document denoting the same graph and passes every sibling case. What
  separates them is the **names**, not their order: a const referencing a later
  one throws on evaluation (measured: `const _0=[_1];const _1=[];` is a
  `ReferenceError`), so dependency-before-dependent is forced by the language
  in any document that runs at all, and no vector has to pin it. Pin the object
  analogue of this one too — `root={"a":p,"b":p,"c":q}` with `p={"x":q}`, giving
  `const _0={};const _1={"x":_0};export default{"a":_1,"b":_1,"c":_0};` — for
  the reason the cycle set covers every ordered pair of container kinds rather
  than a diagonal: naming can live in a per-container emitter rather than in
  one shared traversal, and then only the container kind that carries the
  nesting sees the order it assigns. **Every key in that output is quoted**,
  since `key ::= string | '[' '"__proto__"' ']'` admits no identifier form —
  review caught this vector spelling its keys bare, which would have required
  a document DataJS rejects and failed the very implementation it exists to
  check. Include a normalized root that is a bare
  number and a bare bigint, so `export default 1;` cannot regress to
  `export default1;` — which JavaScript rejects, `default1` being one
  identifier. Include an **identifier-starting** root as well (`NaN`, or any of
  `true`, `false`, `null`, `undefined`, `Infinity`): a normalizer that
  dispatches on type can emit the space for digits and drop it for words,
  producing `export defaultNaN;`, and the two numeric roots cannot see that.

The corpus is data, not code, so it can be read by an implementation in any
language. It is stored as **JSON, permanently** — not "JSON until DataJS can
read it", which an earlier draft said and which contradicts its own reason: the
corpus must be readable by the very implementation it tests, and a corpus that
only a working DataJS parser can read cannot be used to bring one up. The same
argument applies to every later reimplementation, so the constraint never
lapses.

#### The meta-encoding, since JSON cannot spell what the corpus asserts

That decision has a consequence an earlier draft left implicit, and review was
right that leaving it implicit forces stage 1b to invent a schema and lets
stages 4 and 6 read the same vector differently. Almost nothing in the accept
set is JSON-expressible: sharing, `undefined`, bigint, `NaN`, `±Infinity` and
`-0` are the *point* of DataJS, and the serializer-reject set is worse — a
cycle, a sparse hole, an accessor, a symbol key and a `Date` are not values any
document can carry. So the corpus does not store values. It stores a
**description** of them, and the description is the part this file has to fix:

- **A document is a node table plus a root.** Every node is a tagged object,
  and a reference is `{"ref": <index>}`. Sharing is then something a vector
  *states* rather than something a reader might reconstruct — `[a,a]` with one
  shared `a` is two `{"ref": 3}`s, and `[[],[]]` is two distinct nodes. Cycles
  fall out of the same mechanism, which is what the serializer-reject set
  needs, and no encoder has to detect them.
- **Leaves are tagged and lexical.** `{"num": "-0"}`, `{"num": "5e-324"}`,
  `{"big": "-12"}`, `{"str": [<code unit>, …]}`, `{"bool": true}`,
  `{"null": true}`,
  `{"undef": true}`, `{"nan": true}`, `{"inf": 1}`, `{"inf": -1}`. Numbers are
  carried as their **exact lexeme**, never as a JSON number: a JSON reader that
  parses `5e-324` and re-emits it has already involved a host formatter, which
  is precisely what the normalize set exists to pin.
- **Arrays are `{"arr": [node, …]}`**, elements in order, each element a node or
  a `ref`. `[a,a]` with one shared `a` is `{"arr": [{"ref": 3}, {"ref": 3}]}`
  and `[[],[]]` is two distinct nodes — the pair of vectors graph-equivalence
  exists to separate, and the encoding has to keep them apart before any
  consumer reads it. A **sparse hole occupies a position** rather than being
  absent, as `{"host": "hole"}`, since a missing element and a hole are
  different inputs and an encoding that drops one cannot state the difference.
- **Objects are ordered pairs, not JSON objects.** `{"obj": [[key, node], …]}`
  — because observable key order and the `"__proto__"` key are vectors here,
  and a JSON object can express neither. The pair form also sidesteps the
  `__proto__` hazard in any host that builds objects from literals.

  **Every string in the corpus is an array of UTF-16 code units** — leaf
  values, object keys, and the `key` of a `host` recipe alike — never a decoded
  JSON string. DataJS strings are code-unit sequences, so a valid document can
  hold a **lone surrogate** (`"\uD800"`, which normalized form must re-escape),
  and a JSON decoder is not obliged to materialize one: an implementation whose
  string type admits only scalar values replaces or rejects it, and stages 4
  and 6 then reconstruct different graphs from the same vector. Code units are
  the string analogue of carrying numbers as lexemes — the corpus does not let
  the host decide what its own text means. Review found this.

  **Keys are unique and in observable order**, because these pairs describe the
  *graph*, not the document. A duplicate-key vector lives on the other side of
  the accept pair: the document text says `{"a":1,"b":2,"a":3}` and the graph
  it denotes is `[["a", 3], ["b", 2]]` — last value, first position, which is
  the rule the vector exists to pin. Letting `obj` carry all three source
  members would make the encoding a second parser, and one two consumers could
  disagree about; letting it carry duplicates without a collapse rule would be
  worse. The document half is a string, so it can say anything; the graph half
  is normalized by construction.
- **Host-only inputs are recipes, not data.** Some of these have no value to
  describe at all — a `Date`, a function, a symbol key, an accessor, a sparse
  hole. Others have perfectly ordinary data and a *host variation* the encoding
  has no place for: a frozen object, a `null`-prototype array, an array
  carrying an own property beyond its elements. Either way the encoding cannot
  state it, so each is a named recipe the consumer builds. The vocabulary is
  **closed, and closed means enumerated** — "and so on" was an open list
  wearing the word closed, which review caught. Four **leaf** recipes:

  | recipe | builds |
  | - | - |
  | `{"host": "fn"}` | a function value with **no own properties** — an arrow function with `name` and `length` deleted, per the one-reason rule below |
  | `{"host": "symbol"}` | a fresh unique symbol, as a *value* |
  | `{"host": "builtin", "kind": <kind>[, "ms": <integer>]}` | a non-plain built-in object: `date` (with `ms`), `map`, `regexp` or `boxedNumber` |
  | `{"host": "hole"}` | an array hole — legal **only** as an `arr` element |

  …and seven **modifier** recipes, each taking the node it applies to, so the
  property cases say which object they are about — the gap review found in
  `getter`, which named no container. The first five can build inputs a
  serializer must **refuse**; the last two build inputs it must **accept**, the
  half review found missing — without them a serializer that rejects every
  unusual prototype or descriptor passes the corpus while being nonconforming.
  *Can*, not *must*: `ownProp` on an `obj` builds an ordinary own enumerable
  string-keyed property, which is exactly what a serializer has to accept, and
  only an extra property on an **array** is a rejection case. The recipe is a
  construction; the vector is the claim:

  | recipe | builds |
  | - | - |
  | `{"host": "ownProp", "on": <node>, "key": <string>, "value": <node>}` | an enumerable own data property, which is how `a=[1]; a.meta=2` is said |
  | `{"host": "nonEnumerable", "on": <node>, "key": <string>, "value": <node>}` | the same, non-enumerable |
  | `{"host": "getter", "on": <node>, "key": <string>, "value": <node>}` | an **enumerable** accessor property that **records its own invocation** and then returns `value` |
  | `{"host": "setter", "on": <node>, "key": <string>}` | an **enumerable** accessor property with a **setter and no getter**, which reads as `undefined` |
  | `{"host": "symbolKey", "on": <node>, "value": <node>}` | an **enumerable** own data property under a fresh unique symbol |
  | `{"host": "proto", "on": <node>, "to": "null" \| "arraySubclass"[, "inherited": [<key>, <node>]]}` | the same data under a `null` prototype, or as an `Array` subclass instance — `inherited` puts one **enumerable** member, key and value, on the subclass's prototype |
  | `{"host": "attrs", "on": <node>, "how": "frozen" \| "sealed" \| "nonExtensible" \| "nonWritable"[, "key": <string>]}` | the same data with those attributes; `key` is **required with `nonWritable` and forbidden otherwise**, and must name an **existing own data property** of the target |

  `nonWritable`'s `key` carries that constraint because the recipe is otherwise
  not a *modifier* at all: `Object.defineProperty` with an unknown key **adds**
  a non-enumerable `undefined` property, turning a serializer-**accept** vector
  into a serializer-reject one, while another consumer might refuse the recipe
  outright. Naming an existing own data property is what keeps the two
  consumers building the same graph — and keeps the vector about writability,
  which is outside the data model, rather than about a property that should
  not be there.

  **Every modifier's target must be an `obj` or `arr` node** — or a modifier
  over one, since a modifier denotes its target. Nothing else has properties to
  add or attributes to set, and `arraySubclass` narrows further to an `arr`.
  `hole` is the mirror constraint on the leaf side: legal only as an `arr`
  element. Stating both is what stops a vector like "freeze a number" from
  being writable at all.

  **A modifier node denotes its target, modified** — the same object `on`
  denotes, not a copy. Four consequences, and they are stated because review
  found two consumers could reasonably read this differently:

  - **Identity is the target's.** A `ref` to the modifier and a `ref` to its
    target yield the same object, so a vector cannot describe the target
    *before* the modification. That is deliberate: the node table is a heap,
    not a history.
  - **Only nodes reachable from `root` are built**, modifiers included. The
    table is data, not a program, so an unreachable row is inert and cannot
    reach into the graph by side effect.
  - **A modifier appears only as a table entry, never inline** in an `arr`, an
    `obj`, or another modifier's `on`, all of which take a `ref` to it. Without
    that restriction two inline modifiers on one target have no relative order,
    and `ownProp` then `attrs: frozen` succeeds where the reverse fails.
  - **Reachable modifiers apply in table order**, which the restriction above
    makes total, so a target carrying several is unambiguous.

  A cycle needs no recipe: it is a `ref` to an ancestor.

  Three of these carry an obligation the recipe alone does not express, and
  each came from review:

  - **Both accessor shapes, because the spec's rule is wider than its
    reason.** The spec rejects "an accessor property" and explains it with
    *reading a getter is an effect* — a reason that covers only half the rule.
    A **setter-only** accessor has nothing to read, and that is precisely what
    makes it dangerous: measured, an enumerable setter-only property has
    `descriptor.get === undefined` and reads as `undefined`, so a serializer
    that guards with `if (descriptor.get)` passes it straight through and emits
    `{"x":undefined}` — a **valid DataJS document**, since `undefined` is one of
    this format's values, denoting something the input never was. That is
    [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) exactly:
    an unsupported input answered with a plausible wrong value rather than
    refused. `JSON.stringify` shows the same shape of loss from the other end,
    dropping the property and emitting `{}`. `setter` therefore takes no
    `value`: there is no value to name, which is the whole point. Like every
    other accessor recipe it is **enumerable**, or the non-enumerability rule
    refuses it first.
  - **`getter` must be observable, not merely present.** The spec forbids
    reading a getter *because reading it is an effect*
    ([`README.md`](../README.md)), so a serializer that invokes the accessor
    while enumerating and rejects the object afterwards is wrong and would pass
    a vector that only checked the rejection. The recipe therefore records its
    invocation, and **the vector asserts it was never invoked** as well as that
    the input was refused. *Enumerable* is load-bearing and easy to lose:
    `Object.defineProperty` defaults to non-enumerable, and a non-enumerable
    accessor is refused for *that* reason without the read path ever being
    reached — so an implementation that eagerly reads every enumerable getter
    would pass the invocation assertion. **`symbolKey` carries the same
    requirement for the same reason**: built with `Object.defineProperty`
    defaults it is non-enumerable, and a serializer refusing it for *that*
    never has to notice the enumerable symbol-keyed property it would
    otherwise drop silently. Two consumers would be testing two different
    rejection paths from one vector. Rejecting for the right reason and
    rejecting after doing the forbidden thing are different outcomes.
  - **`arraySubclass` with `inherited` is a serializer-accept vector with
    teeth.** A serializer that enumerates with `for...in` copies inherited
    enumerable properties into its result, which the spec forbids: the data is
    the object's **own** enumerable string-keyed properties. Putting one
    enumerable member on the subclass's prototype and asserting it is *absent*
    from the output is what catches that. The member carries its **key**, not
    just a value, and **the key must not collide with an own key of the
    target** — for an `arr` that rules out any index it holds, and `length`.
    A colliding key is shadowed by the own property during `for...in`, so the
    vector would pass against a serializer that copies inherited members: the
    one it exists to fail. This is the only vector in the set
    whose assertion is about a member that must **not** appear.

    An earlier draft did this with an arbitrary **custom** prototype, and
    review was right that the spec does not clearly permit one: it rejects
    "any other non-plain object" and exempts prototypes only by naming
    `null`-prototype objects, `null`-prototype arrays and `Array` subclasses.
    An implementation rejecting `Object.create({x: 1})` as non-plain would be
    reading the normative text correctly and failing the corpus. An `Array`
    subclass is **explicitly** permitted and its prototype can carry a member,
    so it exercises the same filtering with no spec question attached — and
    the corpus should not be where a spec question gets silently answered.
  - **`builtin` covers a class, not `Date`.** The spec rejects "a `Date`, or
    any other non-plain object", and a corpus naming only `Date` is passed by
    an implementation that special-cases `Date` and serializes an empty `Map`
    or `RegExp` as `{}` — valid output denoting something else, which is the
    failure the serializer-reject set exists to catch. The `kind` list is
    closed like everything else here, and `map`, `regexp` and `boxedNumber`
    are in it precisely because they are *not* `Date`.

    **The non-`Date` case must have no own properties**, or it can be refused
    for the wrong reason. Measured:

    ```text
    Map        no own properties
    Date       no own properties
    Number(1)  no own properties
    RegExp     lastIndex, own and non-enumerable
    ```

    A serializer refuses a `RegExp` the moment it sees a non-enumerable own
    property — a rule it needs anyway — without ever asking whether the object
    is plain, and then still writes an empty `Map` as `{}`. So `regexp` stays
    in the `kind` list but cannot be the case that discharges the requirement;
    `map` or `boxedNumber` must be. Review found this, and it is the same shape
    as the enumerable-`getter` finding: a vector refused by a cheaper rule
    never exercises the one under test.

  The list being closed is what makes it useful — a vector needing a recipe not
  in it extends the schema and both consumers, deliberately, rather than each
  consumer improvising. Each implements the ten once, and the corpus stays
  data. Nothing in the encoding marks a recipe as accept-side or reject-side;
  which set a vector lands in is the vector's claim, not the recipe's.

The test of this encoding is whether two independent consumers can disagree.
They cannot: identity is an index, a number is a lexeme, key order is array
order, and the host values are a closed vocabulary rather than a construction
the reader improvises.

Two properties worth proving directly rather than case by case: every
**accept** document parses in FunctionalScript to the same graph, and every
**accept** document is accepted by a JavaScript engine with the same result.
Those are the subset laws, and they can run over the whole accept set.

**They land at different times, and this corpus only owes the second.** The
FunctionalScript check cannot run when this corpus lands: today's front end has
no `NaN`, `Infinity` or `-Infinity`, and its statement separator is a newline
rather than `;` — both are stage 5's work
([parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)).
Running it earlier would fail on almost every accept vector, for reasons that
are not the corpus's fault. So the FunctionalScript subset law is **stage 6's
task**, over this corpus, and this file only requires the JavaScript one, which
needs nothing beyond an engine.

### Tasks

- [ ] Write the meta-encoding down as a schema before any vector, per the
      section above: node table, `ref` indices, the leaf tags, the `arr` form
      with holes occupying positions, the object pair form **with unique keys
      in observable order**, strings as UTF-16 code-unit arrays everywhere a
      string appears, the **byte-array** document form and which vectors use
      it, and the eleven `host` recipes — four leaves, seven
      modifiers, each modifier naming the node it applies to — with their
      application order, the rule that a modifier is a table entry and never
      inline, what a modifier node denotes, `builtin`'s and `proto`'s and
      `attrs`'s closed value lists (`proto`'s optional `inherited` key/value
      pair, whose key may not collide with an own key of the target), and
      and **both** accessor shapes — `getter`'s enumerable accessor with its
      invocation record, and `setter`'s enumerable setter-only property. It is the
      part two
      consumers can silently disagree about, so it lands first and gets its own
      round-trip proof — encode a graph, decode it, and assert the sharing
      survives.
- [ ] **Raise the plain-object boundary with the spec**, which this corpus
      cannot settle: `README.md` rejects "any other non-plain object" and
      exempts prototypes by naming three cases, so whether
      `Object.create({x: 1})` is permitted is unstated. The vectors avoid the
      question rather than answering it; the spec should answer it.
- [ ] **Raise §Whitespace's enumeration with the spec.** Its rule — whitespace
      is exactly JSON's four, everything else JavaScript treats as whitespace
      is rejected — is complete and correct, but the six characters it names
      after the colon read as that set and are not: measured against
      ECMAScript, 21 characters qualify, and the list omits every
      `Space_Separator` but U+00A0 (U+1680, U+2000–U+200A, U+202F, U+205F,
      U+3000). An implementer reading the colon as the rule accepts fifteen
      characters DataJS rejects. The corpus derives from the rule and so is
      correct either way; the spec should either mark the list as examples or
      complete it.
- [ ] **Raise the decoder seam with the spec**, which this corpus cannot
      settle: UTF-8 truncation at end of input is unreachable through a
      document-level byte input, because any completion of the document turns
      it into the non-continuation class and any refusal is attributable to
      the incomplete document instead. Testing it needs an assertion on what
      the **decoder** does with the bytes, which means requiring conforming
      implementations to expose one — an API demand the spec should make or
      decline, not something the corpus should impose by listing a vector that
      only a decoder-exposing implementation can satisfy. Until then the class
      is recorded as untestable and has no vector.
- [ ] Choose the corpus's location. The encoding is settled above: JSON,
      permanently, per the bootstrapping constraint.
- [ ] Write the accept, reject, **serializer accept**, serializer reject,
      **graph equivalence** and normalize sets covering the cases listed.
      Check each rejection vector for a **second ground of refusal** before
      committing it — three of the ones designed here had one, and a vector
      refused by the cheaper rule never exercises the rule it was written for.
      Check its **placement** too: a malformed byte sequence goes inside a
      quoted string and a serializer-reject offender goes below the root, and
      in both directions the placement is what makes the vector able to fail.
      Ask of every class whether an **object walker and an array walker can
      differ on it**, and cover both kinds where they can. Four classes here
      have needed it — cycles, where each offender sits, sharing, and the host
      variations — and only the first was reported as a walker question; the
      other three read as ordinary single cases until asked.
      Run every **expected-bytes** string in the normalize set through the
      accept grammar before committing it — normalized output is a document, so
      the accept rules bind it, and a vector demanding a document DataJS
      rejects fails exactly the implementations it exists to confirm. One
      designed here spelled its object keys bare, which `key ::= string | '['
      '"__proto__"' ']'` does not admit. The
      serializer-accept set is the one an implementation passes by being too
      strict, so it is the one most easily left for later and least safe to.
- [ ] Add the **JavaScript** whole-set subset-law check. The FunctionalScript
      one is stage 6's, once stage 5 has taught the front end `;` and the
      special numbers — see above.
- [ ] Point stages 4 and 6 at the corpus as their proof source. Not stage 3 —
      see above.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`spec/datajs/README.md`](../README.md) — the specification the corpus
  makes executable; its Conformance section links back here.
- [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  — the plan; this is the second half of its stage 1.
