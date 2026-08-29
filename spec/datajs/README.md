# DataJS

DataJS is JSON with two extensions, and no other additions:

1. a value may be **shared**, so a document denotes a directed acyclic graph
   where JSON denotes a tree;
2. the leaf set gains the JavaScript values JSON cannot carry —
   `undefined`, `bigint`, `NaN`, `Infinity` and `-Infinity`.

The first is the reason the format exists; the second is what it costs to
round-trip a JavaScript value honestly.

`-0` is neither, and worth naming separately: JSON syntax spells it and
`JSON.parse` preserves the sign, but `JSON.stringify` writes it as `0`, so it
survives DataJS and not a JSON round trip.

A document is a JavaScript module: `const` statements naming values, then one
`export default` naming the value the document denotes.

```js
const $0=[1,2];export default {"a":$0,"b":$0};
```

Read as JSON that would be two equal arrays. Read as DataJS it is **one**
array named twice — the sharing is the point.

A `const` is *how* sharing is written, not a claim about use: a name may be
referenced any number of times, including once or not at all, and the grammar
imposes no reference count. What counts a value's references is
[normalized form](#normalized-form), which is one serializer's rule rather
than a rule about which documents are valid.

The format is meant to be implementable from this document in an afternoon,
and then to stop changing. Everything not needed to write a value graph
belongs to [FunctionalScript](../README.md), not here.

**What the format optimizes is the implementer's job** — writing a parser and a
serializer that are correct — and not compactness, and not readability. Every
rule here is chosen to remove a decision: ASCII identifiers so no
implementation needs Unicode tables, a mandatory `$` so none carries a
reserved-word list, `;` rather than a line terminator so none learns which
invisible characters end a statement, whitespace pinned at three positions so
none reasons about token merging, one spelling of `__proto__`, and a restated
algorithm wherever hosts disagree. The conveniences that are missing —
comments, trailing commas, identifier keys — are missing for that reason, each
being one more thing to implement and to agree on.

Some of them cost a person something real, and it is worth saying so rather
than calling the omission neutral. A trailing comma gives every element line
the same shape, so entries are added and removed by adding and removing whole
lines — any of them, any number of them, without looking at what is around
them. Without one the last element is a special case that the person editing
has to notice every time: delete the final line and the line above is left with
a comma and nothing after it; paste a line after it and that same line is
missing the comma it now needs. The diff noise follows from this, and is the
smaller half of it. That is a
genuine loss to whoever edits a document by hand, and it is accepted because a
convenience in the grammar is a rule in every implementation of the format,
forever — and there will be more implementations of DataJS than hand-edited
DataJS documents.

In JavaScript the job is already done: a document *is* a module, so an engine
loads one with `import` — no parser, no library, no build step. Every other
language gets this specification, which is the afternoon above.

Layout is where nothing is at stake, and the format spends nothing on it.
Whitespace between tokens costs neither side anything — a reader skips it, a
writer picks what it likes — so tooling is free to default to a layout people
can read. [Normalized form](#normalized-form) is there for when a caller needs
exactly one byte sequence.

## Status

**This document specifies a target, not the current implementation.** The
FunctionalScript compiler in this repository does not accept DataJS today: it
separates statements by newline, so it rejects the `;` this format requires.
The `;` is the difference that stops a document parsing at all, but it is not
the only one. The shipped `fjs/djs` serializer also differs from
[normalized form](#normalized-form) in four ways, each of them stage 4–6 work
rather than a bug:

| shipped `fjs/djs` | this specification |
| --- | --- |
| `const c0 = …` | `const $0=…` |
| hoists a repeated primitive into a const | primitives always inline |
| keys sorted lexicographically — `{"10":0,"9":0}` | array-index keys first in numeric order — `"9"` before `"10"` |
| `NaN`, `±Infinity` become `null`; `-0` becomes `0` | each round-trips exactly |

The first row is the one that is more than a layout difference: a name must
start with `$`, so `c0` is not a name this format has at all, and the shipped
output is invalid rather than merely non-normalized.

The work that closes all of it is staged in
[`todo/parser-serializer-restructure.md`](../../todo/parser-serializer-restructure.md).

Note the two nearby uses of "DJS". [`spec/README.md`](../README.md) uses it for
the data subset the compiler accepts **today**, which is wider than DataJS:
it has `import`, comments, identifier keys, trailing commas, and newline
separation. This document specifies **DataJS**, the narrow interchange format.
"DJS" survives only as an informal abbreviation of DataJS.

## Principles

1. **Derive behavior from JavaScript.** DataJS ⊂ FunctionalScript ⊂
   JavaScript, where `⊂` means *accepted with identical meaning*. A subset may
   reject what its superset accepts; it must never accept something and mean
   something different by it. Where a rule could be argued either way, the
   answer is whatever a JavaScript engine does.
2. **One spelling wherever possible.** Fewer spellings mean fewer decisions
   for an implementer and fewer disagreements between implementations.
3. **No semantics on invisible characters.** Two files that render identically
   in every editor must not mean different things. This is why a visible `;`
   terminates every statement, rather than a line terminator or the end of the
   file.
4. **Restate, do not cite.** Where DataJS depends on a JavaScript algorithm,
   this document writes the algorithm out. An implementer should not need
   ECMA-262 open beside it.

## Grammar

### Whitespace

Whitespace is exactly JSON's: **space** (U+0020), **tab** (U+0009), **LF**
(U+000A), **CR** (U+000D). It is insignificant everywhere and may appear
between any two tokens.

Every other character JavaScript treats as whitespace or a line terminator is
**rejected**: U+2028, U+2029, no-break space, form feed, vertical tab, and a
byte order mark, wherever they appear outside a string literal. Accepting them
would import a taxonomy no implementer of a data format should have to know.

Whitespace is **required after `const`, after `export`, and after `default`**.
Three positions, with no condition attached to any of them, and optional
everywhere else.

Two of the three were never a choice. A `const` name begins with `$`, and
`export` is always followed by `default`, so `const$0` and `exportdefault` lex
as one identifier in every document that could hold them — the space was
forced by the grammar before any rule asked for it. The third is the choice
this format makes: `export default1;` and `export default$0;` are JavaScript
syntax errors, `default1` and `default$0` each being a single identifier, while
`export default[1];` would lex perfectly well, since `[` cannot merge with
anything. DataJS requires the space anyway, so that neither a reader nor a
writer ever consults the next character to find out. The
[rationale](#rationale) gives what that buys.

So the one-line spelling of a document is `const $0=[];export default [$0,$0];`,
and `export default [1];`, `export default -1;` and `export default "a";` all
carry the space.

A document is UTF-8. It has no BOM.

### Tokens

```text
punctuator ::= '{' | '}' | '[' | ']' | ':' | ',' | '=' | ';'
word       ::= 'const' | 'export' | 'default'
             | 'true' | 'false' | 'null' | 'undefined' | 'NaN'
             | infinity | id
infinity   ::= '-'? 'Infinity'
```

A `-` is **not an operator**: it belongs to the token that follows it, and the
grammar says so rather than leaving it to prose. Three productions carry the
optional sign — `number`, `bigint` and `infinity` — and nothing else does, so
`-NaN`, `-undefined`, `-true` and a bare `-` have no rule that accepts them.

Folding the sign into the token is also what keeps the grammar LL(1): every
alternative of `value` then begins on a distinct terminal, where a separate `-`
would leave `-Infinity`, `-1` and `-1n` indistinguishable one token in.

#### Strings

A string is a JSON string, unchanged: double quotes, the escapes `\"` `\\`
`\/` `\b` `\f` `\n` `\r` `\t` and `\uXXXX`, and any other character except an
unescaped `"`, an unescaped `\`, or a code point below U+0020.

Single quotes, template literals, `\x` escapes, `\u{…}` escapes and line
continuations are rejected. JSON has none of them.

#### Numbers

A number is a JSON number, unchanged:

```text
number   ::= '-'? int frac? exp?
int      ::= '0' | [1-9] [0-9]*
frac     ::= '.' [0-9]+
exp      ::= [eE] [-+]? [0-9]+
```

No hexadecimal, no leading `+`, no leading or trailing decimal point, no
numeric separators, no leading zeros.

`NaN`, `Infinity` and `-Infinity` are **words**, not number syntax, and are
values of the number type. `-0` is ordinary number syntax and denotes negative
zero.

#### Bigints

A bigint is its **own production**, not a suffix on the number grammar:

```text
bigint ::= '-'? int 'n'
```

`int` is the number grammar's integer part, so there is no fraction, no
exponent and no leading zero. This is not a stylistic restriction: JavaScript
rejects `1.5n` and `1e2n`, so a "number followed by `n`" rule would accept
text that is not JavaScript.

`-0n` is accepted and denotes `0n`; bigint has no negative zero.

#### Identifiers

```text
id ::= '$' [A-Za-z0-9_$]*
```

ASCII only. JavaScript allows the whole Unicode identifier grammar; DataJS
does not, so that no implementation needs Unicode identifier tables.

**The leading `$` is mandatory**, and it is what keeps an `id` out of the way
of every other word. No JavaScript reserved word contains a `$`, and neither
does any of `true`, `false`, `null`, `undefined`, `NaN` and `Infinity`, so an
`id` can never be one of them — the grammar decides it, with no list of
excluded names to carry. A tokenizer decides the same question on the first
character: a word starting with `$` is an `id`, and a word starting with a
letter is one of the nine spelled out in the `word` production or an error.

An `id` is used for `const` names and for references to them, and nowhere
else — DataJS has no identifier keys.

### Document

```text
document ::= const* export
const    ::= 'const' id '=' value ';'
export   ::= 'export' 'default' value ';'

value    ::= 'null' | 'true' | 'false' | 'undefined' | 'NaN'
           | infinity | number | bigint | string
           | array | object | id

array    ::= '[' (value (',' value)*)? ']'
object   ::= '{' (member (',' member)*)? '}'
member   ::= key ':' value
key      ::= string | '[' '"__proto__"' ']'
```

**Every statement ends with `;`**, `export default` included. The `;`
**terminates** a statement rather than separating one from the next, which is
what it does in JavaScript, and it is written in every case with no positional
exception: a writer emits it after each statement without asking which one is
last, and a reader requires it at the end of each without asking either.

The `;` is the last *token* of a document, not necessarily its last character:
whitespace stays insignificant here as everywhere, so `export default 1;`,
`export default 1;\n` and `export default 1;  \n` are the same document, and a
file that ends the way a text editor ends files is valid.
[Normalized form](#normalized-form) picks one of them by emitting no trailing
newline, which is a rule about those bytes and not about what a reader accepts.

`export default 1` **without** the `;` is therefore rejected, as are `;;`, a
leading `;`, and a stray `;` anywhere else. There is no empty statement.

There are **no trailing commas** — but that is a different rule for a different
reason, and the two should not be read as one. A comma *separates* items and
has a second reading in JavaScript: `[1,,2]` is three elements with a hole in
the middle, so a trailing comma has to be given an explicit exception saying it
does not make one. JSON removed elision and with it the need for that
exception. A `;` has no second reading to avoid — the only construct near it is
the empty statement, which this format rejects on its own — so there is nothing
for a "no trailing `;`" rule to buy.

There are **no comments** and **no `import`**: a DataJS document is closed,
denoting its value with no reference to any other file.

`export default` is required, and is the last statement.

## Data model

A document denotes a **directed acyclic graph** of values.

### Leaves

| Leaf | Written | In JSON |
|---|---|:-:|
| null | `null` | ✅ |
| boolean | `true`, `false` | ✅ |
| string | `"a"` | ✅ |
| number | `-42.5`, `3e2`, `-0` | ✅ |
| number | `NaN`, `Infinity`, `-Infinity` | ❌ |
| bigint | `34n`, `-34n` | ❌ |
| undefined | `undefined` | ❌ |

Number round trips are exact in the sense of JavaScript's `Object.is`:
`-0` reads back as `-0` and not `0`, and `NaN` reads back as `NaN`.

### Objects

An object's members are its own properties, and DataJS follows JavaScript's
object semantics exactly. Two rules, both observable, and both restated here
because an implementation in a language with ordered dictionaries will
otherwise get them wrong:

**Duplicate keys — last value, first position.** In `{"a":1,"b":2,"a":3}` the
key `a` holds `3`, and it comes *before* `b`, because the first occurrence
fixed its position.

**Key order — array indices first.** A key that is an *array index* — a
canonical decimal string for an integer `0 ≤ n < 2^32 − 1`, with no sign, no
leading zero and no fraction — comes before every other key, and index keys
are ordered by numeric value. All remaining keys follow in first-occurrence
order. So `{"2":0,"1":0}` denotes an object whose keys are observably `"1"`,
`"2"` — in that order — in every JavaScript engine, and an implementation in
another language must reorder identically.

**`__proto__` has one spelling.** The only way to write that key is the
computed form:

```js
export default {["__proto__"]:1};
```

The rule is on the key's **decoded value**, not its spelling: a plain string
key is rejected whenever it decodes to `__proto__`, so `{"\u005f_proto__":1}`
is rejected exactly as `{"__proto__":1}` is. JavaScript decides the same way —
the escaped form is a prototype assignment too, and an implementation matching
source text instead would accept it and read back an own property JavaScript
never created. The computed form is spelled `["__proto__"]` and only that,
since one spelling is the point of the rule.

A bare `__proto__` key and the string form `{"__proto__":1}` are **rejected**,
because JavaScript reads them as an instruction to replace the object's
prototype rather than as data. The computed form is an ordinary own property
in JavaScript, so it means in DataJS what it means in JavaScript — the whole
reason it is the accepted spelling.

### Sharing, and why the graph is acyclic

A `const` names a value; a reference to that name denotes **the same node**,
not an equal copy. In

```js
const $0=[];export default [$0,$0];
```

the two elements are one array, and a conforming reader must produce a
representation in which they remain one node. In a host with reference
identity that is automatic. In a host without it, the reader owes an explicit
representation — handles, indices into a node table, whatever the host offers
— because a reader that hands back two equal copies has returned a different
graph. Documenting that it flattens does not make it conforming.

A reference may name only a **previously declared** `const`. That single rule
gives the format three properties for free: a document is acyclic by
construction, it can be parsed in one pass, and no implementation needs cycle
detection to read one.

Cycles are therefore unrepresentable. A serializer handed a cyclic value
rejects it rather than inventing a spelling — see
[Serialization](#serialization).

## Const names

A `const` name is an `id`, and each name is bound at most once. There is no
list of excluded names: every `id` begins with `$`, and no JavaScript reserved
word and none of this format's value words do, so a name can never collide
with either.

The two collisions that would otherwise need excluding are both real, and both
gone:

- **A name JavaScript refuses as a binding.** Module code is strict, so
  `const class=1;` and `const eval=1;` are syntax errors — a document
  containing one would not be JavaScript at all, breaking the subset law
  outright. There are around fifty such words, `arguments`, `await`, `enum`,
  `import`, `let`, `static` and `yield` among them.
- **A name this format reads as a value.** JavaScript *permits*
  `const undefined=1;`, and afterwards `undefined` means that const. A subset
  that bound the name and went on treating the word as a literal would accept
  a document and mean something different by it. `NaN` and `Infinity` are the
  same case.

Neither list has to be written down, checked, or tracked as JavaScript grows
new keywords, because `$class`, `$eval` and `$undefined` are ordinary names
and `class`, `eval` and `undefined` are not names at all.

`$` alone is a name, and so is `$$`: the grammar requires the `$`, not
anything after it.

## Serialization

A serializer conforms when its output is a valid document **that denotes the
input graph** — the same values, with the same sharing. Validity alone is not
the bar: `export default null;` is a perfectly valid document and almost never
the right answer.

Given that, the remaining choices are free: whitespace and layout, the names
of the consts, and whether a value reachable only once is hoisted into one.

Hoisting a value reachable **more than once is not a free choice**. Writing it
inline at each occurrence yields a document denoting equal copies rather than
one shared node — a different graph — so a serializer must emit a `const` for
it. A `const` is the only way the format expresses sharing at all.

A reader must accept every valid document however it is spelled.

### What may be serialized

A serializer's input is an ordinary programmatic value, which may be outside
the data model. Anything outside it is **rejected as an error**, never
approximated:

- a leaf outside the leaf set — a function, a symbol, a `Date`, or any other
  non-plain object;
- a hole in a sparse array, which is not an `undefined` element;
- an own property this format cannot write: a symbol key, an accessor
  property (reading a getter is an effect), or a non-enumerable property —
  each would otherwise vanish from the output. An array's own `length` is the
  one exception: it is non-enumerable on every array, it is not a member, and
  the syntax carries it implicitly in the element list;
- an array carrying any own property besides its elements and `length`.
  `const a=[1]; a.meta=2` has the own keys `0`, `length` and `meta`, and array
  syntax holds only elements, so `meta` has nowhere to go;
- a cycle.

**Only the data is in the model.** What a serializer reads from an object is
its own enumerable string-keyed data properties, and from an array its
elements; what it reads from those is their values. Everything else about the
host object is outside the data model, because DataJS has no syntax for any of
it and therefore cannot carry it:

- property attributes — `writable`, `configurable`, and whether the object is
  extensible, sealed or frozen;
- the prototype — a `null`-prototype object, a `null`-prototype array, or an
  `Array` subclass all serialize as their data, and read back ordinary;
- anything else the host attaches that is not an own enumerable string-keyed
  data property.

A round trip therefore preserves the **value**, not the object. This is
deliberate and not a gap to close by rejecting the unusual cases: `Object.freeze`
makes every property non-writable and non-configurable, so rejecting those
descriptors would make frozen values unserializable — including the output of a
reader that freezes what it returns, which this specification explicitly
permits.

Enumerability and accessors are the exception, rejected above rather than
ignored here, and the line is worth stating: they change *which values appear
at all*, which is a question about the data. Everything in this section's list
is a question about the object holding it.

Every one of these is a case where the obvious implementation quietly produces
a document denoting something else. `JSON.stringify` substitutes `null` for a
function, expands a hole to `null`, drops a symbol-keyed member, and drops that
`meta` without a word. DataJS rejects instead, because a silently wrong
document is worse than no document.

### Normalized form

Normalized form is one specific serializer, chosen so that a value has
**exactly one** byte spelling. It is optional — a conforming implementation
need not produce it — but an implementation that claims to produce normalized
DataJS must produce these bytes.

**Layout.** One line. A single space after `const`, after `export` and after
`default` — the three the [Whitespace](#whitespace) rule requires — and nowhere
else: no indentation, and no trailing newline. Normalized form inherits that
rule's freedom from conditions; there is no value whose first character changes
the layout.

**Which values become consts.** A value is hoisted into a `const` if and only
if it is an object or an array whose **incoming reference occurrences** number
more than one, counting by reference identity. An occurrence is one place the
node appears: an array element, a member value, or the exported value. It is
not a count of root-to-node paths — for `root=[p,p]` with `p=[c]`, `p` has two
occurrences and is hoisted, while `c` has exactly one and stays inline, even
though two paths reach it. Primitives are always written inline: primitive sharing is not
observable, and counting them by value would raise the `0`/`-0` and `NaN`
questions that the `Object.is` guarantee forbids answering either way.

**Order and names.** Emit consts in **post-order of one depth-first traversal**
of the exported value — arrays in element order, objects in observable key
order, descending into a shared node only the first time it is met. Assign
names `$0`, `$1`, … in emission order. Post-order is what makes a node's
dependencies land before the node itself, which the declare-before-use rule
requires. For `root = [parent, parent, child]` where `child` is inside
`parent`, `child` finishes first: it is `$0` and `parent` is `$1`.

**Numbers** are spelled by ECMAScript's `ToString` applied to a Number — the
algorithm `String(x)` implements. It is restated here rather than cited,
because host formatters disagree on exactly these cases: JavaScript writes
`1e20` as `100000000000000000000` where Python writes `1e+20`.

- `NaN` is `NaN`; the infinities are `Infinity` and `-Infinity`.
- Positive zero is `0`. It is spelled directly, before the digit selection
  below, which requires `s ≥ 1` and so has no answer for it.
- A negative number is `-` followed by the spelling of its magnitude. `-0` is
  the one departure from `ToString`, which spells it `0`; normalized DataJS
  spells it `-0`.
- Otherwise pick integers `s`, `k`, `n` with `10^(k-1) ≤ s < 10^k` such that
  `s × 10^(n-k)` **converts back to exactly this Number**, choosing `k` as
  small as possible; `s` is that shortest digit string, `k` its length, and
  `n` the position of the decimal point. Round-trip conversion decides this,
  not exact real-number equality: `0.1` is the Number nearest one tenth, whose
  exact value is `0.1000000000000000055511151231257827…`, and its spelling is
  `0.1` because those digits convert back to it. Where several `s` of that
  length qualify, take the one whose `s × 10^(n-k)` is closest to the Number's
  exact value; if two are equally close, take the even `s`. Then:
  - `k ≤ n ≤ 21` — the `k` digits, then `n − k` zeros: `100`;
  - `0 < n ≤ 21` — the first `n` digits, `.`, the remaining `k − n`: `1.5`;
  - `−6 < n ≤ 0` — `0.`, then `−n` zeros, then the `k` digits: `0.000001`;
  - otherwise — the first digit, then `.` and the remaining `k − 1` digits
    when `k > 1`, then `e`, then `+` or `-`, then the digits of `|n − 1|`:
    `1e+21`, `1e-7`, `1.7976931348623157e+308`.

The thresholds are exact and worth pinning: `1e20` is `100000000000000000000`
while `1e21` is `1e+21`, and `1e-6` is `0.000001` while `1e-7` is `1e-7`. A
positive exponent carries `+`; there is no uppercase `E` spelling, and no
"shortest form" tie left to break.

**Bigints** are their full decimal digits followed by `n`, never exponent
notation — which would read back as a number. A negative bigint carries `-`;
zero is `0n` and never `-0n`, which the grammar accepts as an input spelling
of the same value and normalized form must therefore not emit.

**Strings** are spelled by ECMAScript's `QuoteJSONString`, the algorithm
`JSON.stringify` uses for a string: the escapes `\"` `\\` `\b` `\t` `\n` `\f`
`\r` where they apply, any other code point below U+0020 as `\u00` followed by
two **lowercase** hex digits, an unpaired surrogate as `\u` followed by four
lowercase hex digits, and every other code point literally. `/` is never
escaped.

**Object keys** are emitted in the observable order defined above, with
duplicates already collapsed — a normalized document never contains a
duplicate key.

Tooling should *default* to a readable layout — one statement per line,
indented containers — which is simply one of the many valid non-normalized
spellings, and which costs an implementation nothing, since a reader has to
accept every spelling regardless. Normalized output is something a caller asks
for, typically to hash or compare documents.

## Relationship to JSON

**Every JSON value is a DataJS value. No JSON document is a DataJS document** —
a DataJS document is a JavaScript module, which a JSON document is not.

Two different mechanisms exclude them, and an implementer checking documents
should know which applies. Object-shaped JSON such as `{"a":1}` is **not valid
JavaScript** at the top level of a module at all: the `{` opens a block. Scalar
and array JSON — `42`, `"txt"`, `[1,2]` — *is* valid JavaScript, and fails the
later test instead: it declares no `export default`, so it is a module that
exports nothing.

The conversion is textual:

```text
"export default " + json + ";"
```

with one exception: a key **decoding to** `__proto__` must be rewritten to
`["__proto__"]`, since DataJS rejects every plain-string spelling of it. That
covers escaped spellings such as `"\u005f_proto__"`, which JSON and DataJS
both read as the same key. For JSON containing no such key, that prefix and
that suffix around the document are exactly a valid DataJS document.

The space in that literal is the one the [whitespace](#whitespace) rule
requires, and the `;` is the one every statement takes. The space is what
anyone would have written anyway, and under the earlier merging-based rule it
would have been necessary for `1` and `true` and superfluous for `[1,2]` and
`{"a":1}` — one more reason to make it unconditional: the obvious conversion is
now the correct one for every JSON document rather than for most of them.

The reverse direction is partial, and both of its conditions are about the
graph the document *denotes* — the values reachable from `export default`,
since an unused `const` contributes nothing to it. A document converts to JSON
when no reachable value is a leaf JSON lacks (`undefined`, `NaN`, the
infinities, bigint), and no reachable **object or array** is reachable more
than once — JSON cannot express that sharing, and writing the node twice
denotes a different graph. `const $dead=undefined;export default 1;` therefore
converts to `1`: the unreachable `undefined` is not part of what the document
means.

A shared *primitive* is not an obstacle. `const $x=1;export default [$x,$x];`
converts to `[1,1]`: primitives have no reference identity, so the two
occurrences were never distinguishable from two copies, exactly as
[normalized form](#normalized-form) says when it declines to hoist them.

## Relationship to FunctionalScript and JavaScript

A DataJS document is a valid FunctionalScript module and a valid JavaScript
module, denoting the same value in all three. FunctionalScript adds `import`,
comments, identifier keys, functions and the rest of the language; DataJS is
what remains when everything not needed to write a value graph is removed.

The inclusion is a testable claim, not a stylistic one, and the conformance
suite states it as: every accepted DataJS document parses in FunctionalScript
to the same graph, and every DataJS document is accepted by a JavaScript
engine with the same result.

## Files and media type

Recognized extensions: `.data.js`, `.data.mjs`, `.d.js`, `.d.mjs`.

Tools emit **`.data.js`**. Use `.data.mjs` where a file must resolve as an ES
module regardless of the enclosing package's `"type"` field.

The media type is **`text/javascript`**, with the format identified out of
band as the dialect **`vnd.fjs.datajs+vnd.fjs.fjs`** — most specific first, so
a consumer that knows only FunctionalScript still reads it correctly.

DataJS gets no media type of its own, and the reason is not stylistic: RFC 9239
makes JavaScript MIME types a closed list with no registered `+javascript`
suffix, so `application/datajs` would be opaque to every existing consumer and
would break the one thing a DataJS document is guaranteed to be — a JavaScript
module a browser can `import`. A JSON-shaped format could take
`application/{dialect}+json` and fall back to `application/json`; a
JavaScript-shaped one has no such ladder.

This follows the dialect design in
[`fjs/todo/group-fs-subdirectories-by-concern.md`](../../fjs/todo/group-fs-subdirectories-by-concern.md),
which settled the question for FunctionalScript's formats generally. That
document names the wider compiler subset's dialect `vnd.fjs.djs`; DataJS is
narrower and takes its own segment, which is the one detail still to reconcile
there — see [that todo](../../fjs/todo/group-fs-subdirectories-by-concern.md)
rather than duplicating the chain rules here.

## Conformance

Conformance is per role, because an implementation may provide only one of
them — a library that just writes DataJS accepts no documents at all, and one
that just reads it emits none.

- A conforming **reader** accepts every document this specification accepts,
  rejects every document it rejects, and yields the graph the document
  denotes, sharing included.
- A conforming **serializer** rejects every input outside
  [the data model](#what-may-be-serialized) and otherwise emits a valid
  document denoting the input graph.
- A conforming **normalized serializer** is a conforming serializer whose
  output is the byte sequence [normalized form](#normalized-form) defines.

An implementation states which roles it provides, and is judged only on those.
The machine-readable corpus that decides each is
[`spec/datajs/todo/conformance-vectors.md`](./todo/conformance-vectors.md);
until it lands, this prose is the only statement of conformance.

## Rationale

**Why `;` and not a newline?** A lone CR is a JavaScript line terminator, so is
U+2028; newline separation drags that taxonomy into a data format, and makes
two files that look identical mean different things. `;` is visible, has one
spelling, and lets a document minify to a single line — which is what makes a
DataJS document embeddable in a JSON string, streamable one-per-line, and
writable as a one-line test fixture.

**Why does `export default` end with `;` like every other statement?** An
earlier draft dropped it, reasoning that a trailing `;` is a trailing separator
and this format already rejects the other one — JSON's comma separates members
and never follows the last, so `;` should separate statements and do the same.
That reasoning was wrong, and the way it was wrong is worth keeping.

**The comma rule is not about trailing punctuation; it is about ambiguity.** A
comma between elements has a second reading in JavaScript: `[1,,2]` is three
elements with a hole at index 1, and `[1,2,]` is two elements only because the
grammar carves out an exception saying the last comma makes no hole. JSON
removed elision, and with it the need to choose. A `;` has no second reading to
disambiguate. The nearest construct is the empty statement, which this format
rejects on its own account. So refusing a trailing `;` buys none of what
refusing a trailing comma buys — it copies the shape of a rule without its
reason.

**In JavaScript the `;` terminates, it does not separate.** The production is
`export default AssignmentExpression ;`, with the `;` inside it. A format that
calls itself a JavaScript subset and then reinterprets a terminator as a
separator has to be read against its host grammar rather than with it, which is
the opposite of what principle 4 asks.

**Writing it is unconditional; omitting it is not.** This is the same argument
that decides the [whitespace](#whitespace) positions. A serializer that ends
every statement with `;` never asks which statement is last; one that omits the
final `;` must know where it is. Both readers are equally easy, both grammars
are equally easy — the `;` simply lives in whichever production owns it — so
nothing about the implementer's job favours the shorter form, and the writer's
job favours the uniform one.

**And it removes a dependence on ASI.** Without the `;`, a document is
JavaScript only because automatic semicolon insertion supplies one at the end
of the input stream. That is the benign ASI rule, carrying none of the taxonomy
this format refused to import — a lone CR terminating a statement, U+2028 doing
the same, restricted productions with "no LineTerminator here" all belong to
the *other* rule. But it makes the terminator the absence of further text,
which is a strange thing for a format whose third principle is that nothing
invisible carries meaning. It is also not robust under composition: appending a
line beginning with `[` to `export default [1]` — a document without the `;` —
silently changes the exported
value from `[1]` to `1`, where the `;` keeps it `[1]` — measured. A closed
document is not supposed to be appended to, so this is a hazard under misuse
rather than a defect in correct use; it is listed last for that reason.

The cost is one byte in every document, and the smallest document is
`export default 1;` rather than `export default 1`.

**Why no comments?** They are trivia with no denotation, and every one of them
is a decision for a normalizer. A format whose purpose is to be normalized and
compared does not need them.

**Why no identifier keys or trailing commas?** They are second spellings of
things that already have one. FunctionalScript has them; DataJS is where the
spellings are spent carefully. The trailing comma is the one that costs
something — it is what makes every element line the same shape, so entries can
be added and removed as whole lines with no special case at the end — and it is
refused anyway, since a serializer never needs it and a reader would have to
accept both spellings forever.

**Why must every name start with `$`?** Because the alternative is a list. A
`const` named `class`, `eval` or `await` makes a document JavaScript rejects
outright; one named `undefined`, `NaN` or `Infinity` makes a document
JavaScript accepts and DataJS reads differently, which is the worse of the two
failures. An earlier draft excluded both sets by enumerating them — about fifty
words each implementation would carry, and a list JavaScript can add to. The
`$` moves the question into the token grammar, where the first character
settles it.

**The two collisions do not have the same guarantee, and it is worth being
exact about which is which.**

The **value-word** collision — the silent one, where JavaScript accepts a
binding and DataJS reads the word as a literal — is closed permanently, and by
*this* grammar rather than by JavaScript's. The words DataJS reads as values
are the nine its `value` and `word` productions name, all ASCII letters, and
that list is fixed here. It does not grow when ECMA-262 grows, so no future
JavaScript global or literal can become one, whatever it is called. Nothing a
future edition does can reopen this.

The **reserved-word** collision — the loud one, where JavaScript rejects the
binding and the document is not JavaScript at all — is not closed by this
grammar, because ECMA-262 decides it. It is worth being exact about what would
have to happen, since "a future keyword" is broader than the actual risk. **Two
things would both have to be true.** ECMA-262 would have to choose a spelling
containing `$` for a new keyword, *and* make that keyword **reserved** rather
than contextual. Either alone is harmless: a contextual keyword does not remove
a name from the set of legal bindings, and a reserved word spelled in letters
cannot collide with a name that starts with `$`.

Both are contrary to how the language has actually grown.

- **Contextual is the normal shape of an addition.** Measured over sixteen
  contextual keywords including the recent and proposed ones — `using`,
  `accessor`, `satisfies`, `match`, `defer`, `source` — fourteen are still
  legal `const` names today. Additions of this kind cannot break a DataJS
  document at all, whatever they are spelled with.
- **The reserved list is essentially closed.** Its thirty-eight words, and the
  eight strict-mode future reserved words beside them, have been fixed since
  ES1–ES6; the language grows by adding contextual keywords and punctuation,
  not by taking identifiers away from programs that already use them.
- **`$` is carved out for user names by the grammar itself.**
  `IdentifierStartChar` lists `$` and `_` explicitly, alongside `UnicodeIDStart`
  — the specification says in its own grammar that these two are for
  identifiers. Reserving a `$` word would invalidate existing valid programs,
  since `$`-leading identifiers are legal and widespread.
- **New markers come from outside the identifier grammar.** When TC39 needed a
  sigil for private names it took `#`, which was not a valid identifier
  character — measured, `const #x=1` is rejected while `const $x=1` and
  `const _x=1` are accepted. That choice is the pattern, and it points away
  from `$`.

No rule forbids it, so the format also reduces what a collision would cost.

- **Normalized form spells its names `$` followed by digits** — `$0`, `$1`, …
  Machine-produced documents, which is what exists in bulk, therefore use a
  shape no keyword plausibly takes. The exposure is to hand-chosen names only.
- **The failure would be loud.** A document using the affected name stops
  parsing as JavaScript: a syntax error at load, never a value silently read as
  something else. The silent class is the one closed permanently above.
- **Recovery is mechanical, and the format already ships it.** Re-normalizing a
  document renames every `const` to `$0`, `$1`, …, so the fix for a colliding
  name is running the normalizer rather than editing documents by hand.
- **The conformance corpus pins `$class` and `$undefined` as ordinary names**,
  so an implementation that quietly reintroduces an exclusion list fails
  conformance. The mitigation cannot decay into the thing it replaced.

If ECMA-262 ever did move toward `$`, one further step is available and is a
one-line change: narrow `id` to `$` followed by digits, which removes
word-shaped names from the format entirely and makes the question moot. It is
not taken now, because a hand-written document is easier to read with names
like `$config` than with `$7`.

**Which character carries the prefix is a separate question from whether there
is one**, and only the second is forced. `_` has the same property that the
argument above rests on — no reserved word contains an underscore either, so
`_class`, `_eval` and `_undefined` are equally ordinary names — so the grammar
does not decide between them. `$` is the decision, made once and not derived;
what follows is what it costs, so that the cost is on the record rather than
discovered later.

**The cost is that `$` reads as a named placeholder nearly everywhere.** That
is a general association, not two incidents: `${name}` in a template literal,
`$1` for a capture group in a `String.prototype.replace` pattern, `$0` and `$1`
as positional parameters in a shell, `$VAR` and `${VAR}` in the substitution
languages of `make`, `envsubst`, CI configuration and most templating engines.
And it lands exactly where it is least welcome, since normalized form names its
consts `$0`, `$1`, … — so the documents most likely to be piped through a shell
for hashing or comparison are the documents most exposed. `_0` would carry none
of it.

What the association does *not* cost is also worth stating. It is a hazard of
the surrounding text, not of the format: embedding a document as data — in a
JSON string, a file, a request body, a database column — is unaffected, since
none of those interpret `$`. Within JavaScript, `$` has no meaning of its own;
`${` belongs to template literals, and **no name can produce that sequence**,
since a name is `$` followed by identifier characters. A *string's contents*
can hold `${` like any other text — `export default "${name}";` is a valid
document — so embedding one in a template literal interpolates, but that is
true of JSON in a template literal too and is not something the prefix
introduced. Where a context does interpret `$`, each has a spelling that turns
it off: single quotes or a quoted `<<'EOF'` heredoc in a shell, `$$` in `make`,
a replacement function rather than a pattern string for `replace`.

The rest of the cost is one character per name, spent where the format had no
other use for it: DataJS has no identifier keys, so an `id` appears only in a
`const` statement and the references to it, and normalized `$0` is exactly as
long as the `_0` an earlier draft used.

**Why require a space after `default` when `export default[1];` would lex?**
Not because the conditional rule cannot be implemented. It can, and without
maximal munch: require whitespace before an identifier, a word, or an
**unsigned** number or bigint whenever the preceding character is an identifier
character — one character of look-behind, decided as the token starts. Those
are exactly the tokens that can begin with an identifier character, which is
why a signed value needs no space and `export default-1;` would stay legal. It
leaves the grammar LL(1) too, though the credit there belongs to folding `-`
into its token rather than to anything about whitespace. So this is a choice
between two workable rules, and it goes to whichever is harder to get wrong.

A reader saves one condition. A **serializer** saves more. Under the
conditional rule a serializer cannot write `export default` and hand the rest
to the value writer: it has to know the first character that writer is about to
emit, and that is not determined by the value's type. `Infinity` takes the
space and `-Infinity` does not; `1` takes it and `-1` does not; `1n` takes it
and `-1n` does not. Normalized form has one byte spelling per value, so a
serializer claiming to produce it would have to make the space depend on the
*sign* of a number — a coupling between the statement writer and the value
writer that exists for no reason except this rule. Unconditional, the statement
writer emits `export default ` and never looks at the value at all.

The reader's side is smaller but real: `const`, `export` and `default` may be
lexed as a keyword followed by at least one whitespace character, needing no
look-behind either. A word elsewhere may end wherever it ends, because a wrong
split there — `null$13` read as `null` `$13`, or `null0` as `null` `0` — yields
two adjacent value tokens, and the grammar has no production for those.
Walking it for pairs where the left token can end with an identifier character
and the right can begin with one turns up `const`·name, `export`·`default` and
`default`·value and nothing else; every other adjacency has a punctuator, a
string or a `-` between.

The cost is one byte, in one place, in the documents whose exported value
begins with `[`, `{`, `"` or `-`. The other two spaces were unavoidable
already, so nothing else grows — and the reader, the writer and normalized form
each lose a condition.

**Why only these two extensions?** Both are things JSON cannot express at
all, rather than conveniences. Sharing is a class of value JSON has no syntax
for; the extra leaves are values a JavaScript program holds and JSON silently
destroys — `JSON.stringify` turns `NaN` and the infinities into `null` and
`-0` into `0`, drops an `undefined` member while turning an `undefined` array
element into `null`, and throws outright on a `bigint`. Everything else JSON's
tree already covers, and each further feature would be another version of the
format for implementers to track.
