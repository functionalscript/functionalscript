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
  vectors carry invalid UTF-8 to be refused, and **one per error class**, since
  a decoder can reject three classes and accept a fourth. The classes are: an
  invalid lead byte (`C0`, `C1`, `F5`–`FF`), a **stray continuation byte**
  (`80` with no lead), a truncated sequence, an overlong encoding, a surrogate
  half encoded as three bytes, and a value **above U+10FFFF**
  (`F4 90 80 80`). Review supplied the second and last of those after the first
  draft sampled three — the same "enumerate, do not sample" the productions
  below need. Each malformed
  sequence sits **inside an otherwise valid quoted string**, and that placement
  is the vector. A permissive decoder replaces a bad sequence with U+FFFD, and
  U+FFFD is an ordinary DataJS string character — so with the sequence inside a
  string the replacement yields a **valid** document, and refusal can only be
  for the malformed bytes. Put the same sequence between tokens or alone and
  the replacement yields an invalid document, which the parser rejects for its
  own reasons: the vector passes while the UTF-8 rule goes unenforced. This is
  the one-reason rule reaching the byte form.

At least one byte-form vector must **accept**, and it carries a multibyte
character. Every other case here is a rejection, so an implementation that
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

  - **`number ::= '-'? int frac? exp?`** — the sign present and absent, both
    `int` alternatives (`0` and `[1-9][0-9]*`), `frac` present and absent,
    `exp` present and absent, and within `exp` both letter cases and all three
    sign states: `0`, `-0`, `12`, `1.5`, `-1.5`, `1e2`, `1E2`, `1e+2`, `1e-2`,
    `1.5e-2`. A reader accepting integers and the named words while rejecting
    every fraction and exponent passed the earlier set entirely.
  - **`string`** — all nine escapes, not just the one an interesting case
    happened to use: `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t` and
    `\uXXXX`, plus a raw non-ASCII character. The lone surrogate exercises
    `\u` alone, so a reader supporting raw text and `\u` while rejecting the
    eight simple escapes passed too.
  - **`bigint ::= '-'? int 'n'`** — both signs against both `int`
    alternatives: `0n`, `-0n`, `12n`, `-12n`.
  - **`infinity`, `array`, `object`, `key`, `document`** — both signs; empty
    and non-empty; both `key` alternatives; zero `const`s and several.

  The reject half of this corpus is derived from the spec's narrowing rules,
  and this is its twin: the same discipline pointed at the productions instead
  of the prose. Ad-hoc accept sets fail in one direction only, which is why
  every one of those five was invisible until someone asked which way a vector
  pointed.

  Cases beyond that derivation, each earning its place: a **lone surrogate**, `export default "\ud800";` denoting the
  one-unit value `[0xd800]` — it appears under `normalize` too, but roles are
  judged independently, so a reader-only implementation whose string model
  cannot hold one passes every reader vector without this; **each of the four
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
  a number spelling JavaScript takes and DataJS does not — `0x10`, `+1`, `.5`,
  `1.`, `1_0`, `01` — and two identifier spellings it takes and DataJS does
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
  below-U+0020 range and one ordinary member — each valid inside a JavaScript
  string literal and none inside a DataJS one. Then the characters JavaScript
  treats as whitespace or a line terminator and DataJS does not, of which there
  are **21**, not the six the spec enumerates: U+000B, U+000C, U+2028, U+2029,
  U+FEFF, and the fifteen `Space_Separator` characters other than U+0020 —
  U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F and U+3000. Vectors take one
  from each shape a delegating reader would get from its host rather than all
  21: U+000B and U+000C (the C0 pair), U+2028 and U+2029 (the line
  terminators), U+FEFF, and U+00A0, U+1680, U+2000, U+202F, U+205F and U+3000
  spanning the `Zs` block, since an implementation reaching that class at all
  reaches all of it. **U+FEFF needs vectors in two positions and two input
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
  a.meta=2`), and a cycle. Each is a case where the obvious implementation
  emits a valid document denoting something else.

  The **accessor** case is two vectors rather than one — a getter and a
  setter-only property — because a serializer guarding on `descriptor.get`
  alone refuses the first and silently accepts the second. The getter vector
  asserts **two** things: that the input was refused, and that the getter was
  never invoked.

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
  vector is the only instrument that sees it. Thirteen consecutive review rounds
  each found one missing: the plain number spellings and the non-ASCII
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
  another production's worth of vectors. Every time the list had been written from memory rather
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
    | `export ::= 'export' 'default' value ';'` | any other export form | `export{a};export default a;` |
    | `value ::= <closed list>` | every other expression form | `(1)`, `1+1`, `[1][0]`, `String(1)`, `void 0`, `-(-1)` |
    | `array ::= '[' (value (',' value)*)? ']'` | elisions, spread | `[,1]`, `[1,,2]`, `[1,,]`, `[...[1]]` |
    | `object ::= '{' (member (',' member)*)? '}'` | spread | `{...{"a":1}}` |
    | `member ::= key ':' value` | shorthand, methods, accessors | `{a}`, `{a(){}}`, `{get a(){return 1}}` |
    | `key ::= string \| '[' '"__proto__"' ']'` | identifier and numeric keys, other computed keys | `{a:1}`, `{1:2}`, `{["x"]:1}` |

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
  a raw LF or CR inside a string literal is a JavaScript SyntaxError too, so
  the raw-control vectors above stop at U+001F and skip those two. Two of the
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
  The spec is explicit that these are outside the data model rather than
  invalid, and that rejecting them is a
  defect rather than caution ([`README.md`](../README.md)): a `null`-prototype
  object or array, an `Array` subclass, a frozen or sealed object, a
  non-extensible object, and a non-writable property. `Object.freeze` produces
  the last two together, so a serializer that rejects unusual descriptors
  cannot serialize a frozen value — including the output of a reader that
  freezes what it returns, which the spec permits. What each vector asserts is
  that the output is **valid and denotes the input's data** — the host
  variation leaves no trace, and `graph equivalence` supplies the comparison.
- **graph equivalence** — an input graph and the documents that do and do not
  denote it, so a serializer cannot pass by emitting merely *valid* output:
  `[a,a]` with one shared `a` is not `export default [[],[]];`.
- **normalize** — an input document and the exact bytes normalized form must
  produce: const hoisting by reference identity, post-order `_0`, `_1`, …
  naming, `ToString(Number)` spelling with the `-0` exception,
  `QuoteJSONString` escaping — **every branch of it**, because a noncanonical
  spelling is still a *valid* document, so only exact bytes tell them apart:
  the seven simple escapes `\"` `\\` `\b` `\t` `\n` `\f` `\r`, any of which
  a normalizer may instead emit as `\u00XX`; any other code point below
  U+0020 as `\u00` plus two **lowercase** hex digits, so U+001F pins
  `\u001f` and not `\u001F`; a **lone surrogate**, which must come back as
  `\ud800` rather than a replacement character; the **never-escaped `/`**,
  which a normalizer borrowing a JSON writer that escapes it gets wrong; and a
  **BMP** and an **astral** character, which `QuoteJSONString` leaves *raw*, so
  their vectors pin the UTF-8 bytes (`c3 a9` for `é`, `f0 9f 98 80` for U+1F600).
  Without those last two every pinned byte sequence in this set is ASCII and a
  serializer emitting Latin-1, or CESU-8's `ed a0 bd ed b8 80` for that astral
  character, passes a set whose whole promise is exact bytes. Normalized output
  has **seven** simple escapes where the accept grammar admits **nine**: `\/`
  and `\uXXXX` are input spellings a reader must take and a normalizer must
  never emit, so the two lists differ on purpose and neither checks the other —
  observable key order, one-line layout. Pin the `__proto__` key's exact bytes,
  `{["__proto__"]:1}`: a normalizer reusing an ordinary key writer emits
  `{"__proto__":1}`, which is not DataJS at all and which JavaScript reads as
  prototype replacement rather than an own property — a normalized form that
  denotes a different graph than its input. Pin that
  `-0n` normalizes to `0n` — the grammar accepts the spelling and normalized
  form must never emit it, which is the one place a bigint and a number differ
  on negative zero. Pin the
  number thresholds explicitly — `1e20`, `1e21`, `1e-6`, `1e-7`,
  `5e-324`, `1.7976931348623157e308` — since that is where a host's own
  formatter diverges, and pin `root=[p,p]` with `p=[c]` so the hoisting count
  is occurrences rather than paths. Include a normalized root that is a bare
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
    `{x: undefined}` — a **valid DataJS document**, since `undefined` is one of
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
- [ ] Choose the corpus's location. The encoding is settled above: JSON,
      permanently, per the bootstrapping constraint.
- [ ] Write the accept, reject, **serializer accept**, serializer reject,
      **graph equivalence** and normalize sets covering the cases listed.
      Check each rejection vector for a **second ground of refusal** before
      committing it — three of the ones designed here had one, and a vector
      refused by the cheaper rule never exercises the rule it was written for. The
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
