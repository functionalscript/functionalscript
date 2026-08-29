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
const _0=[1,2];export default {"a":_0,"b":_0};
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
| `const c0 = …` | `const _0=…` |
| hoists a repeated primitive into a const | primitives always inline |
| keys sorted lexicographically — `{"10":0,"9":0}` | array-index keys first in numeric order — `"9"` before `"10"` |
| `NaN`, `±Infinity` become `null`; `-0` becomes `0` | each round-trips exactly |

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
   in every editor must not mean different things. This is why statements end
   with a visible `;` rather than a line terminator.
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

Whitespace is *required* exactly where leaving it out would merge two tokens
into one: between `const` and a name, between `export` and `default`, and
between `default` and any value beginning with an identifier character — a
name, `true`, `false`, `null`, `undefined`, `NaN`, `Infinity`, a number, or a
bigint. `export default1;` is not this format minus a space; it is a
JavaScript syntax error, because `default1` lexes as a single identifier.

Everywhere else whitespace is optional, so every document has a one-line
spelling: `export default-1;`, `export default[1];` and `export default"a";`
all need no space.

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
id ::= [A-Za-z_$] [A-Za-z0-9_$]*
```

ASCII only. JavaScript allows the whole Unicode identifier grammar; DataJS
does not, so that no implementation needs Unicode identifier tables.

An `id` is used for `const` names and for references to them. See
[Const names](#const-names) for the words that may not be used.

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

**Every statement ends with `;`**, `export default` included. There is no
per-statement exception and no empty statement: `;;` and a stray `;` are
rejected.

There are **no trailing commas**, **no comments**, and **no `import`**. A
DataJS document is closed: it denotes its value with no reference to any other
file.

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

A bare `__proto__` key and the string form `{"__proto__":1}` are **rejected**,
because JavaScript reads them as an instruction to replace the object's
prototype rather than as data. The computed form is an ordinary own property
in JavaScript, so it means in DataJS what it means in JavaScript — the whole
reason it is the accepted spelling.

### Sharing, and why the graph is acyclic

A `const` names a value; a reference to that name denotes **the same node**,
not an equal copy. In

```js
const _0=[];export default [_0,_0];
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

A `const` name is an `id`, each name is bound at most once, and two sets of
words are excluded.

**Excluded because JavaScript rejects them as a binding.** Module code is
strict, and JavaScript refuses `const <word> = 1` for each of these. Accepting
one would produce a "DataJS document" that is not JavaScript at all:

```text
arguments  await     break     case      catch     class     const
continue   debugger  default   delete    do        else      enum
eval       export    extends   false     finally   for       function
if         implements import   in        instanceof interface let
new        null      package   private   protected public    return
static     super     switch    this      throw     true      try
typeof     var       void      while     with      yield
```

**Excluded because DataJS reads them as values.** JavaScript *permits*
`const undefined = 1`, and afterwards `undefined` means that const. A subset
that bound the name but kept treating the word as a literal would accept a
document and mean something different by it, so DataJS rejects the binding:

```text
undefined  NaN  Infinity
```

Everything else matching `id` is available, including the contextual keywords
`async`, `as`, `from`, `get`, `of` and `set`: DataJS has no syntax in which
they are special, and JavaScript accepts them as bindings in module code.

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

**Layout.** One line. A single space appears exactly where the tokens would
otherwise merge, as defined under [Whitespace](#whitespace) — after `const`,
between `export` and `default`, and after `default` when the value begins with
an identifier character. Nowhere else: no indentation, and no trailing
newline.

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
names `_0`, `_1`, … in emission order. Post-order is what makes a node's
dependencies land before the node itself, which the declare-before-use rule
requires. For `root = [parent, parent, child]` where `child` is inside
`parent`, `child` finishes first: it is `_0` and `parent` is `_1`.

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
spellings. Normalized output is something a caller asks for, typically to hash
or compare documents.

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

with one exception: a bare `"__proto__"` key must be rewritten to
`["__proto__"]`, since DataJS rejects the string spelling. For JSON containing
no `__proto__` key, plain concatenation is exactly a valid DataJS document.

The reverse direction is partial. A DataJS document converts to JSON only when
it uses no leaf JSON lacks (`undefined`, `NaN`, the infinities, bigint) and no
**object or array** is reachable more than once — JSON cannot express that
sharing, and writing the node twice denotes a different graph.

A shared *primitive* is not an obstacle. `const x=1;export default [x,x];`
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

The media type is **`application/datajs`**, mirroring `application/json`, with
charset UTF-8 implied.

One practical caveat: that type describes the *data*. A server that expects a
browser to `import` the file must send a JavaScript MIME type (`text/javascript`)
instead, because a module load rejects any other type. The two uses do not
conflict — they are different requests for the same bytes — but a document
served for both needs a deliberate choice.

## Conformance

An implementation conforms if it accepts every document this specification
accepts, rejects every document it rejects, and denotes the graph described
here. The machine-readable accept / reject / round-trip corpus that decides
this is
[`spec/datajs/todo/conformance-vectors.md`](./todo/conformance-vectors.md);
until it lands, this prose is the only statement of conformance.

## Rationale

**Why `;` and not a newline?** A lone CR is a JavaScript line terminator, so is
U+2028; newline separation drags that taxonomy into a data format, and makes
two files that look identical mean different things. `;` is visible, has one
spelling, and lets a document minify to a single line — which is what makes a
DataJS document embeddable in a JSON string, streamable one-per-line, and
writable as a one-line test fixture.

**Why no comments?** They are trivia with no denotation, and every one of them
is a decision for a normalizer. A format whose purpose is to be normalized and
compared does not need them.

**Why no identifier keys or trailing commas?** They are second spellings of
things that already have one. FunctionalScript has them; DataJS is where the
spellings are spent carefully.

**Why only these two extensions?** Both are things JSON cannot express at
all, rather than conveniences. Sharing is a class of value JSON has no syntax
for; the extra leaves are values a JavaScript program holds and JSON silently
destroys — `JSON.stringify` turns `NaN` and the infinities into `null` and
`-0` into `0`, drops an `undefined` member while turning an `undefined` array
element into `null`, and throws outright on a `bigint`. Everything else JSON's
tree already covers, and each further feature would be another version of the
format for implementers to track.
