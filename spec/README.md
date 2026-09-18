# FunctionalScript Language

This is the specification of the language that the compiler accepts **today**.
A FunctionalScript module is exactly a module that

```sh
fjs compile <input> <output>
```

compiles; every rule below is a rule the `fjs` parser and serializer enforce.

Features the parser does not recognize yet — every operator but unary `-`,
type annotations — and the design documents for the VM, I/O,
serialization, and the rest of the roadmap live in
[`spec/todo/`](./todo/README.md).

Those documents sort planned features into two layers, and use the names here.
**DJS** — data JS — is the data subset: a module denotes a graph of values,
and any of them can be serialized without additional run-time information.
**FJS** is DJS plus functions, which cannot be serialized that way. Everything
the compiler accepts today is DJS, so this document specifies DJS; the layer a
feature belongs to is a statement about where it lands, not about what is
implemented now.

**DJS here is not DataJS.** [`spec/datajs/`](./datajs/README.md) specifies
**DataJS**, a much narrower interchange format: JSON with two extensions —
values may be shared, so a document denotes a DAG rather than a tree, and the
leaf set gains `undefined`, `bigint`, `NaN` and the infinities — and with a
`;` **required** after every statement, `export default` included (as the
DJS described here requires it too), no `import`, no comments, no
identifier keys and no trailing commas. The data subset
described in *this* document is wider and is what the compiler accepts today.
The compiler bridges the two: `fjs compile` writes a module of the wider
subset as a DataJS document, through DataJS's own writer.

## Principles

**Compatibility with JavaScript.** FunctionalScript is a subset of JavaScript,
not a language that resembles it. Every FunctionalScript module is an ES
module, and it denotes in FunctionalScript the value that a JavaScript engine
gives it. Nothing has to be stripped, preprocessed, or interpreted specially
for `node`, `deno`, `bun`, or a browser to load a `.f.js` file: the file is
already JavaScript.

Two rules follow, and they outrank everything else:

1. if FS code passes validation/compilation, then it doesn't have
   side-effects;
2. the code that passed validation/compilation should behave on the
   FunctionalScript VM the same way as on any other modern JavaScript engine.

Compatibility runs one way only. Every FunctionalScript module is JavaScript;
most JavaScript is not FunctionalScript. So the language is a **whitelist**,
and it whitelists complete semantic patterns rather than individual operations
in isolation. An otherwise-forbidden JavaScript construct may appear as a
component of a recognized pattern that lowers to a FunctionalScript primitive
— the bracketed `__proto__` key ([below](#the-__proto__-key)) is the current
example.

Rule 2 also decides what to do when JavaScript gives one text a meaning
FunctionalScript cannot reproduce: the text is a compilation error. Giving it
a second, more convenient meaning would make a module mean one thing here and
another thing in a browser.

When we implement features of FunctionalScript, the first priority is a
simplification of the VM.

## Exporting a Value

This is a complete module:

```js
export default 5;
```

A module denotes exactly one value, and `export default` is how it says which.
The statement is **required** and **last**: only comments and whitespace may
follow it. A module without one is an error.

Every module is this shape, however large the value gets:

```js
export default { "name": "fjs", "tags": ["data", "config"] };
```

`export default` alone already expresses everything JSON expresses — the value
that follows it is the whole content of the module. What takes a module past a
tree, and past what JSON can hold at all, is the rest of the language:
[constants](#shared-values-constants) and [imports](#importing-other-modules)
name shared parts, and [`bigint`](#supported-value-types) and
[`undefined`](#supported-value-types) are values JSON has no spelling for.

Named exports are not recognized yet ([export](./todo/3240-export.md)).

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export#using_the_default_export>.

## Command Line

```sh
fjs compile <input> <output>
```

`fjs compile` reads the input, resolves and evaluates every module it imports,
and writes the exported value to the output. Both file names are part of the
command: the **input extension names the input language** and the **output
extension names the output format**.

The point is that configuration data can move between the two languages
without a bespoke tool at either end. A legacy configuration can be read as
JSON and converted to `.f.js`, where it gains comments, shared constants, and
imports; and a `.f.js` configuration can be compiled back to `.json` for a
consumer that speaks only JSON.

```sh
fjs compile legacy.json config.f.js    # adopt a legacy configuration
fjs compile config.f.js  config.json   # produce JSON for a JSON-only consumer
fjs compile config.f.js  bundle.f.js   # inline every import into one module
```

On success the command writes the output and exits `0`. On failure it writes
nothing, reports the error on `stderr`, and exits `1`:

```text
config.f.js:3:18 - error: __proto__ requires the computed key form
```

A parse error carries the token's `path:line:column`. An error with no token
to point at — a missing file, a circular dependency, a malformed `.json`
input — names the file being compiled instead.

`fjs compile` is one of several `fjs` commands; see
[`fjs/README.md`](../fjs/README.md) for the rest.

### File Types

|File type|Extension|Denotes|
|---------|---------|-------|
|JSON|`.json`|A tree of values.|
|DataJS|`.data.js`|A graph of values.|
|FunctionalScript|`.f.js`|A graph of values and functions.|

The extension is what separates the languages, and it is the only thing that
does. On the way **out** a text is written in whichever language its name
declares ([output](#output)). On the way **in** the compiler tells JSON from
JavaScript and no more: a `.json` file is a document, and anything else is
read by the module parser, `.data.js` included — so a `.data.js` input holding
a function is accepted today, its name a claim the reader does not check.
DataJS is a subset of FunctionalScript, so every `.data.js` is
FunctionalScript too; the extensions differ so that a document can say which
subset it keeps to.

This table is about the *language* — what `fjs compile` reads and writes. The
repository's own authored FunctionalScript is spelled `.f.mjs` instead, and its
type-level APIs live in authored `types.ts`; `.f.js` is reserved there for the
stage-2 marker, meaning a module the parser/compiler in the same revision
accepts. Neither spelling changes what the language is: a `.f.mjs` is the same
graph of values a `.f.js` is. The repository extension contract is
[`fjs/fsc/README.md`](../fjs/fsc/README.md).

### JSON Input

A `.json` input is a JSON document, read by the JSON reader. Anything else is
a FunctionalScript module, read by the module parser. An imported `.json`
file is a JSON document too, and its import says so with `with { type: "json" }`
([importing](#importing-other-modules)).

```json
{
    "a": null,
    "b": [-42.5, false, "hello"]
}
```

A JSON document is **not** a FunctionalScript module. A module is a sequence
of statements, and no statement begins with a value: as JavaScript, `{"a":1}`
does not parse at all and `[1,2]` is an expression statement that exports
nothing. Reading such a text as a module would give it a meaning no JavaScript
engine gives it, against principle 2.

What the two languages share is *values*, not texts. Every JSON value is a
FunctionalScript value, so a JSON document compiles into a module denoting the
same value — with one key spelled differently on the way
([`__proto__`](#the-__proto__-key)).

Two readers also means a `.json` file is JSON and nothing more. Comments,
`bigint`, `undefined`, identifier keys, computed keys, and trailing commas
belong to the module language, and a `.json` input using any of them is an
error.

The extension is a declaration, not a guess about the content. JavaScript
decides the same way: `import` takes a module's type from the extension — or,
in a browser, from the response MIME type — together with an import attribute
(`with { type: "json" }`), and never from the text. A `.js` file holding JSON
is JavaScript there, and stating `type: "json"` for it is an error rather than
a reinterpretation.

### Output

An output is the language its extension declares, matched by the longest
suffix first. A `.json` output is a **tree**; a `.data.js` output is a
[DataJS](./datajs/README.md) document, which is a **graph** of values; and any
other `.js` output is a FunctionalScript module, a graph of values *and
functions*.

```sh
fjs compile input.f.js output.data.js   # DataJS, a JavaScript module
fjs compile input.f.js output.js        # FunctionalScript
fjs compile input.f.js output.json      # JSON
```

The JavaScript names are nested, not disjoint: a DataJS document is a
FunctionalScript module, so the narrower name is what asks for the narrower
writer — the one that refuses a function.

`fjs compile` writes two more things, neither of them a document of this
language: the program's EDAG under `.edag.data.js`, and a generated Rust
module under `.rs`. They are compiler artifacts, and
[`fjs/fsc`](../fjs/fsc/README.md)'s to describe. An extension declaring none
of the five is refused, rather than written in a language the name does not
declare.

- A DataJS document is written in
  [normalized form](./datajs/README.md#normalized-form): one line, and a
  value referenced more than once hoisted into a `const` named `$0`, `$1`, …
  so it stays shared ([shared values](#shared-values-constants)). Every value
  a module denotes has a document.
- JSON is a tree, and the compiler refuses what JSON cannot spell rather than
  write a file that reads back as a different value: a shared value, which
  written twice reads back as two; `bigint`, `undefined`, `NaN`, `Infinity`
  and `-Infinity`, which JSON has no word for. A `bigint` is refused even
  though its digits are JSON, since `1` reads back as the *number* `1`. The
  refusal names the output file and writes nothing.
- A FunctionalScript document is written in the same normalized form, and
  from the program's graph rather than from its value: the module is not
  evaluated, so a function has a document too, which is what DataJS and JSON
  have no spelling for. Writing the graph is not writing the value, so the two
  module outputs part wherever the program computes: `const a = { b: 1 };
  export default a.b;` is `export default {"b":1}.b;` here and
  `export default 1;` as DataJS. They agree on a normalized DataJS document,
  which computes nothing — every one of them is a fixed point of both.
- Object properties are emitted in the order the value carries them for the
  value outputs — JavaScript's own-property order, array-index keys first,
  a repeated key keeping its first position and its last value — and in the
  order the *literal* carries them for a FunctionalScript document, whose
  members are the graph's: `{b:1,"0":2,a:3,b:4}` stays as written there and is
  `{"0":2,"b":4,"a":3}` as DataJS. A member a later duplicate shadows is in
  the graph and not in the value, so `const x = []; export default {a: x, a: 1};`
  writes that `[]` in a FunctionalScript document and nowhere else.
- A `__proto__` key is emitted as `["__proto__"]:` in a DataJS or
  FunctionalScript document and as `"__proto__":` in JSON
  ([below](#the-__proto__-key)).
- `NaN`, `Infinity` and `-Infinity` — a literal, or a number that overflowed
  to infinity — are emitted as those words in a DataJS or FunctionalScript
  document, and `-0` as `-0` in every format.

## Comments

Comments are trivia. They may appear between any two tokens and are ignored.

```js
// a line comment runs to the end of the line

/** @type {number} */
export default -42.5;
```

|Form|Syntax|
|----|------|
|line comment|`// ...`|
|block comment|`/* ... */`|

Block comments carry JSDoc/TypeScript type declarations, which is why the
language has them: a `.f.js` file is type-checked as JavaScript, and JSDoc is
how it says what its types are.

A comment is trivia, as whitespace is: it neither ends a statement nor keeps
one open, so the `;` that ends a statement may follow a comment, on the same
line or a later one ([module structure](#module-structure)).

Comments belong to the module language. A `.json` input containing one is an
error, because JSON has no comments.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#comments>.

## Supported Value Types

An expression is a data expression, a property access, a function, a call, a
negation, or any of those in parentheses ([grouping](#grouping)). Unary `-` is
the one operator — see the [roadmap](./todo/README.md).

|Value|Example|In JSON|
|-----|-------|:-----:|
|`null`|`null`|✅|
|boolean|`true`, `false`|✅|
|number|`-42.5`, `3e2`|✅|
|number, not JSON's|`NaN`, `Infinity`, `-Infinity`|❌|
|string|`"hello"`|✅|
|array|`[1, "a"]`|✅|
|object|`{ "a": 1 }`|✅|
|`bigint`|`34n`, `-34n`|❌|
|`undefined`|`undefined`|❌|
|reference|`a`|❌|

A reference is a declared `import` or `const` name and denotes the value that
name holds ([shared values](#shared-values-constants)). It is not a kind of
value of its own: what a reference denotes is one of the types above, and what
makes it worth writing is that two references can denote the *same* value.

The ❌ rows are what a module has and a JSON document does not, so they are
also what a `.json` output cannot carry ([output](#output)).

### Numbers

A number is written with JSON number syntax less its sign: an integer part, an
optional fraction, an optional exponent. A leading `-` is not part of the
literal but the [unary minus](#supported-value-types) applied to it, which is
why `- 42.5` is the same value written with a space.

```js
export default [0, -42.5, 3e2, 1E-7];
```

The syntax is JSON's, so the JavaScript spellings JSON leaves out are not
recognized: no hexadecimal (`0x10`), no leading `+`, no leading decimal point
(`.5`), no numeric separators (`1_000`). The three numbers JSON cannot spell
are written as the words JavaScript gives them — `NaN`, `Infinity` and
`-Infinity` — exactly as [DataJS](./datajs/README.md) writes them:

```js
export default [NaN, Infinity, -Infinity];
```

`NaN` and `Infinity` are reserved words, like `undefined`: a module cannot
bind or shadow them, so each denotes its value wherever a value stands.

They still name a property, as every reserved word does: `{ NaN: 1 }` and
`a.NaN` are a key and an access, and mean the string `"NaN"`, exactly as in
JavaScript, where a property is named by an `IdentifierName` and a value by
an `IdentifierReference`. `-Infinity` names nothing in either language: it is
two tokens in both — the operator and the word — which no property name may
be.

The `-` is the **unary minus operator** ([operators](./todo/2340-operators.md)),
and the only operator the language has. It is not part of the literal after
it: `-42.5` is the negation of `42.5`, `- 42.5` is the same value written with
a space, and `-NaN` and `-Infinity` are values as JavaScript has them. It binds
looser than a property access or a call, as it does in JavaScript, so `-1 .x`
is `-(1 .x)` and `-1()` is `-(1())`. What it takes is JavaScript's
`UnaryExpression`, which an arrow function is not, so `-(...a) => 1` is a
syntax error in both. Two adjacent `-` characters are the decrement operator,
which the language has no rule for: a negation of a negation is `- -1`.

A negative number is therefore an expression rather than a literal *in the
syntax*. The graph is another matter: lowering folds a negation of a numeric
literal into the number, since negating one is exact arithmetic, so the EDAG
of `-1` is the leaf `-1` and not an operation. A negation of anything else
stays an operation there — folding one would mean saying what a string or a
container converts to — and what such a value is worth is computed where a
value is wanted, a `.json` or DataJS output being the value.

### Strings

Currently we support only JSON strings:

```js
export default "hello!";
```

Double quotes, and JSON's escapes — `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`,
`\t`, and `\uXXXX`. No single-quoted strings and no template literals; both
are deferred, see
[js-string-literals](./todo/2460-js-string-literals.md) and
[template-literals](./todo/3440-template-literals.md).

This holds at every level of a module — values, object keys, and the path of
an `import` statement are all JSON strings.

### Arrays

```js
export default [
    "hello",
    42,
    [true, null],
];
```

An array may be empty, may hold any value including another array or an
object, and may end with a **trailing comma**. Two adjacent commas are not an
elision: an array has no holes.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Trailing_commas>.

### Objects

```js
export default {
    a: "hello",
    "b": 2,
    ["c"]: [1, 2],
};
```

An object may be empty and may end with a trailing comma, like an array. When
one key is written twice, the last value wins, as in JavaScript.

#### Property Keys

A key is a constant, written in one of three ways:

|Form|Example|
|----|-------|
|string literal|`{ "a": 1 }`|
|identifier|`{ a: 1 }`|
|bracketed string literal|`{ ["a"]: 1 }`|

The three spellings denote the same key and mix freely inside one object. An
identifier key is spelled as a JavaScript identifier — letters, digits, `_`,
`$`, not starting with a digit — and may be a reserved word, `{ if: 1 }`, as
it may in JavaScript.

The brackets hold a **string literal**, not an expression: a key is a constant
in every form. A key computed from a reference or any other expression, and a
numeric key such as `{ 3e7: true }`, are not recognized yet — see the
[roadmap](./todo/README.md).

#### The `__proto__` Key

JavaScript gives the three spellings of a `__proto__` key two different
meanings:

```js
{ __proto__: v }      // sets [[Prototype]]; no own property
{ "__proto__": v }    // sets [[Prototype]]; no own property
{ ["__proto__"]: v }  // an ordinary own property named "__proto__"
```

Only the bracketed spelling denotes a property, so it is the only one
FunctionalScript accepts. The other two are compilation errors:

```js
export default { __proto__: 1 };    // error
export default { "__proto__": 1 };  // error
export default { ["__proto__"]: 1 }; // ok
```

**The bracketed form is the workaround**: it is how a module holds a property
actually named `__proto__`, and there is no other way to write one.

FunctionalScript has no prototype chains at run time
([property-accessor](./todo/2330-property-accessor.md)), so a spelling whose
only meaning is "assign a prototype" has no meaning to give. Rejecting it is
the whitelist principle rather than a special case, and it keeps principle 2:
a module means on the FunctionalScript VM what it means on any other
JavaScript engine.

A value may still carry a `__proto__` property; what a module cannot do is
*read* it with `o.__proto__`, which is a separate rule of
[property-accessor](./todo/2330-property-accessor.md).

##### The one key the two languages read differently

`"__proto__"` is an ordinary data key in a JSON document — `JSON.parse` makes
it an own property — and a prototype assignment in a JavaScript module. It is
the only text the two languages disagree about; every other JSON document
denotes the same value in both.

Each language keeps its own reading, because each is right about itself:
JSON's reader gives the document the value `JSON.parse` gives it, and the
module parser refuses the spelling rather than give a module a value no
JavaScript engine would give it.

So `fjs compile` reads and writes the key differently in each language, and
the extension of each file **named on the command line** picks the language:

```sh
fjs compile input.f.js output.data.js   # {["__proto__"]:1}
fjs compile input.f.js output.json      # {"__proto__":1}
fjs compile input.json  output.data.js  # reads {"__proto__":1} as a property
```

A JSON document therefore survives the loop `proto.json → a.data.js → out.json`
byte for byte, each hop spelling the key its own language's way. The
disagreement is about a *text*, not a value, so nothing is unreachable.

The identifier spelling is not a key in either language: no JSON document
contains one, so `{ __proto__: 1 }` is an error whatever the input file is
called.

In JavaScript output the bracketed form is what makes the module round-trip —
it is the only spelling whose evaluation reproduces the property. In JSON
output the plain key stays: `JSON.parse` has no prototype special case, so
JSON already round-trips, and the bracketed form is not JSON at all.

## Grouping

```js
export default ([80, 443]).length;
```

A value may be written in parentheses, and it denotes that value: `(x)` is
`x`, so the parentheses leave nothing behind — no node of their own and no
change to which values a module shares — exactly as in JavaScript. A group
is a value like any other and takes a property access or a call after its
`)`, and it holds one value: a bare comma inside it waits on the comma
operator ([operators](./todo/2340-operators.md)).

Parentheses are not a boundary that anything downstream can see. They keep
a property reference, so `(o.m)(a)` is the method call `o.m(a)` is
([functions](#functions)), and they keep sharing, so a `const` reached
through a group is the one value it is reached without one. They launder
nothing either: `(1).x` is the access `1 .x` is, `(1)(2)` the call `1(2)`
is, and `(o.toString)(1)` is refused at the key where `o.toString` is.

What a group does change is how far a prefix reaches, since `-` binds looser
than a step ([unary minus](#supported-value-types)): `(-1).x` is the access
on the negation and `-1 .x` the negation of the access, as JavaScript reads
each. A group is an operand of `-` as well, and the one way a function
reaches the prefix at all: `-((...a) => 1)` is a value where `-(...a) => 1`
is a syntax error, there and here.

A parenthesized parameter list, `(a, b) => …`, is not a group and is not
recognized yet ([parameters](./todo/3120-parameters.md)): JavaScript itself
tells one from the other only past the `)`, so `(a) => 1` is read as a group
and refused at the `=>`.

## Property Access

```js
const cfg = { ports: [80, 443] };
export default [cfg.ports[0], cfg["ports"].length];
```

A property access reads an **own property** of any value — a reference, an
array, an object, a number or a string written out, or an access — a member of
an object, an element or the `length` of an array, a code unit or the `length`
of a string. A numeric literal takes an access like anything else: `1 .x` is
`undefined`, written with a space since `1.x` is one number and a stray word.
The sign binds looser, as it does in JavaScript, so `-1 .x` is `-(1 .x)` and
`const n = 1;`
followed by `n.x` is `undefined` in both languages. The key is a constant — an identifier
after `.`, or a string or a number in brackets — and `0` and `"0"` name the
same element, as in JavaScript. A property the value does not own is
`undefined`, and reading one of `null` or `undefined` is an error, as
JavaScript throws.

FunctionalScript has no prototype chains, so a name a built-in prototype
gives a value — `push`, `toString`, `valueOf`, `constructor`, `__proto__`
and the rest, listed in [`fjs/js/prototype`](../fjs/js/prototype/module.f.mjs)
— is a **compilation error** as a key, in either spelling: JavaScript would
find a function there and this language nothing, and a module must mean one
thing in both. `length` is the exception, since an array, a string and a
function own it. The rules are
[property-accessor](./todo/2330-property-accessor.md)'s, and they hold for a
method call too, `a.toString()` being refused where `a.toString` is; a key
computed at run time is not recognized yet.

## Importing Other Modules

```js
import a from "./a.f.js";
```

An `import` statement binds the exported value of another module to a name, so
modules can be shared and reused — a common configuration, a shared table of
constants, a fragment that several outputs include.

- Only the **default import** form is recognized. Named imports and namespace
  imports ([namespace-import](./todo/2220-namespace-import.md)) are not.
- The path is a [string literal](#strings), resolved relative to the importing
  module.
- Each module is parsed and evaluated once per resolved path, and its value is
  shared by every importer. A circular dependency is an error.
- The name is a JavaScript identifier that JavaScript does not reserve:
  `import class from "./a.f.js";` is an error here as there.
- Every `import` comes before every `const`
  ([module structure](#module-structure)).

A JSON document is imported with the attribute JavaScript requires of it, and
denotes the value `JSON.parse` gives it:

```js
import a from "./a.json" with { type: "json" };
```

- The attribute is `with { type: "json" }`, spelled as JavaScript spells it:
  the key `type` and the string `"json"`, in braces after the path. Any other
  key or value is an error, as it is in JavaScript. `"json"` is the one type
  ECMAScript defines; `"text"` and `"bytes"` are proposals, blocked on their
  standardization ([import-text-bytes](../todo/blocked/import-text-bytes.md)).
- The attribute declares the file's language and never reinterprets the file,
  so it must agree with the extension: a `.json` file imported without it, and
  any other file imported with it, are errors — JavaScript refuses both, so
  that data a program did not declare cannot stand where it expects a module.
- The document is read by the JSON reader, as a `.json` input is
  ([JSON input](#json-input)): a `.json` file is JSON and nothing more.

`fjs compile` resolves imports and inlines them, so its output is one
self-contained file that imports nothing.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#default_import>.

## Shared Values, Constants

```js
const port = 8080;
const server = { "port": port, "host": "localhost" };
export default { "dev": server, "prod": server };
```

A `const` statement names a value so that it can be *used more than once*. It
is what makes a module denote a **graph** rather than a tree, and it is the
main thing FunctionalScript data has that JSON data does not.

JSON can only represent a tree, so a value used twice is written twice. Two
copies are not one shared value: they take twice the space, they drift apart
when only one is edited, and a reader that loads them gets two objects where
the author meant one. The usual answers — an id/reference convention, a
`$ref` pointer — require a bespoke format and a bespoke resolver on both
sides, and what they load still has a different shape from the object graph
the author had in mind. In FunctionalScript the sharing *is* the language:
`const` and `import` are how a value gets more than one reference, and a
JavaScript engine loading the module rebuilds exactly the graph that was
written.

- A name is a JavaScript identifier that JavaScript does not reserve:
  `const if = 1;`, `const export = 1;` and `const let = 1;` are errors here as
  they are there — any broken JavaScript program is a broken FunctionalScript
  program — while a key or a property name may be any word, `{ if: 1 }` and
  `a.default` included, as in JavaScript.
- A name must be declared before it is used. Forward references are not
  recognized yet ([forward-references](./todo/3140-forward-references.md)).
- Imported and constant names share one namespace: declaring the same name
  twice is an error.
- Every `const` comes after every `import` and before `export default`
  ([module structure](#module-structure)).
- `let` and `var` are not part of the language ([let](./todo/3220-let.md)).

Sharing is a property of the *value*, not of the name, so what the compiler
preserves is what the graph actually shares:

- a `const` referenced once is inlined into its single use;
- a value referenced more than once is emitted as a `const`, whether the
  source named it or not — a string repeated in two places is hoisted the same
  way an object is;
- objects and arrays are shared by identity, so two separately written objects
  with equal contents stay two objects.

```js
const a = { "x": 1 };
const b = [a, a];
export default [b, b, a];
```

```js
const c0 = {"x":1};
const c1 = [c0,c0];
export default [c1,c1,c0];
```

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const>.

## Functions

```js
export default (...args) => [args, args[0]];
```

The same function, written with a block body:

```js
export default (...args) => { return [args, args[0]]; };
```

A function that takes no arguments, its parameter list empty:

```js
export default () => 6;
```

A function is written as an arrow function of one rest parameter or of none,
and its body is an expression or a block. It denotes a function of its
arguments alone:

- The parameter is the arguments array, `args[0]` the first argument, and
  the body may name it and nothing declared outside — a `const`, an import,
  or an enclosing function's parameter is a **capture**, which is an error
  ([function-frame](./todo/3111-function-frame.md)). The parameter may shadow
  a module name, as in JavaScript.
- An **empty parameter list** binds no name at all, so a body written under
  one cannot reach its arguments: the arguments array is named by the
  parameter and by nothing else, and a word the list does not spell is
  unbound here exactly as any other unbound word is. Nothing else
  distinguishes the two lists. `() => 1` and `(...args) => 1` denote the one
  function, and a body `const` may take the name a parameter would have
  taken, there being no parameter to collide with. A list of **named**
  parameters, `(a, b) => body`
  ([parameters](./todo/3120-parameters.md)), is not recognized yet.
- The body is an expression or a block, and `value` and `{ return value; }`
  denote the same function. As an expression the body is any value except a
  bare object literal: after `=>` JavaScript reads `{` as a block, never as
  an object, so the spelling is refused rather than read another way, and the
  object is written in parentheses instead ([grouping](#grouping)) —
  `(...args) => ({ a: 1 })`, as in JavaScript. The block
  is any number of `const` statements and then one `return`, each with its
  `;` as after every statement, and an object literal is an ordinary value
  again, since after `return` JavaScript expects an expression. `return` and
  the value share a line: a newline between them ends the statement in
  JavaScript, which would return `undefined`, so it is refused here rather
  than read another way, exactly as a newline before `=>` is.
- A function **carries no name**. Its EDAG is `['=>', frame, body]`,
  name-erased, so `{ some: () => 0 }.some`, `const hello = () => 0` and
  `export default () => 0` compile to the same node whatever JavaScript
  would name them, and no program observes the difference: `f.name` is
  refused at the key of `.`, and `entry(f, 'name')` is `undefined`, since
  `name` is not an enumerable own property
  ([`fjs/edag/todo/entry.md`](../fjs/edag/todo/entry.md)). Nor is the arity
  observable, which is what leaves the two parameter lists nothing to be
  told apart by: `f.length` is `0` for a rest parameter as it is for none,
  a rest parameter not counting towards it in JavaScript.
- A body `const` is the body's, and binds as a module's does: it names a
  value the `return` and the statements after it may use, it may not be
  written twice, and it is not in its own initializer's scope. The parameter
  is a name of the body too, so a `const` may not take it. What a body
  `const` *may* take is a name the module binds — the body cannot reach the
  module's scope at all, a reference out being a capture, so the module's
  name is unreachable here rather than hidden
  ([no-shadowing](./todo/3150-shadowing.md) has nothing to decide about this
  case).

  ```js
  export default (...args) => {
      const first = args[0];
      const pair = [first, first];
      return [pair, pair];
  };
  ```

  `pair` is one array however many references reach it, as a module `const`
  is one value — which is the whole reason a body has them.
- A function is **called** as JavaScript calls one: `f(a, b)` with no
  receiver, and `o.m(a)` with `o` as the receiver. A call is a step after a
  value, as a property access is, and what a step applies to is everything
  written before it — so `f(1)(2)` calls what `f(1)` returns, and
  `o.m(1).n(2)` calls `n` on what `o.m(1)` returned. The arguments are the
  list an array holds, a trailing comma included.

  Parentheses around the property do not drop the receiver: `(o.m)(a)`
  passes `o` as surely as `o.m(a)` does, since the parentheses keep the
  property reference — only detaching the value loses it, as `(0, o.m)(a)`
  does with the comma operator. `(o.m)(a)` is in the language
  ([grouping](#grouping)) and is the same program as `o.m(a)`, down to the
  graph it compiles to; the detached spelling waits on the comma operator,
  so every call written on a property today is a call with a receiver.

  A method call's property is the access's, so the names an access may not
  read, a built-in prototype's among them
  ([property access](#property-access)), it may not call either.

  Only the EDAG output holds a call today, and the other three refuse one for
  two different reasons. `.data.js` and `.json` are values, and what a call
  *returns* is not a value the compiler computes — applying a function is the
  interpreter's work
  ([`fjs/fsc/todo/interpret-edag.md`](../fjs/fsc/todo/interpret-edag.md)) — so
  a module reaching a call has no value output, as one holding a function has
  none. The `.js` output is not a value and has no such excuse: the writer
  simply has no spelling for either call form yet, and refuses by the name of
  the node it meets, `a () node` and `a chain step`. Spelling them is the
  writer's own step, and until it lands a module with a call in it compiles
  to `.edag.data.js` alone.
- A function is written by the FunctionalScript and EDAG outputs
  ([output](#output)); `fjs compile` refuses to write a module holding one as
  DataJS or as JSON, since a value has no function in it.

## Module Structure

A module is a sequence of statements, each terminated by a semicolon — the
last one included: `export default 5;`. The `;` lets several statements share
a line, and whitespace may precede it, newlines included: a line break before
the `;` is insignificant, exactly as it is in DataJS and JavaScript. A
newline does not terminate a statement — `export default 5` at the end of a
file is an error at the end of the file, and `const a = 1` followed by
`export default a;` on the next line is an error at `export`. One terminator
per statement: `;;` is an error, not an empty statement.

The `;` is not a stylistic allowance. [DataJS](./datajs/README.md) *requires*
one after every statement, and every DataJS document must be a valid
FunctionalScript module — `const $0=[1];export default [$0,$0];` is normalized
DataJS, one line, and it parses here. JavaScript accepts the same module with
the same meaning, so the subset law holds; what FunctionalScript refuses from
JavaScript is the empty statement and automatic semicolon insertion — a
statement here ends at a `;`, never at a spot an engine infers. The rule
landed with the parser's move to the LL(1) backend, where telling a newline
from a `;` reached through newlines took unbounded lookahead, and it is the
rule of the compiler-formatted `.f.js` output language: the compiler writes
the `;` after every statement it emits. Trivia between tokens — whitespace
or a comment — is optional here, `export default[1];`, `export default{};`
and `import a from"./a.f.js";` included. Where two words would otherwise
lex as one identifier some trivia is needed — after `const`, `export` and
`import`, and between an import's name and `from`, since `const$0`,
`exportdefault`, `importa` and `afrom` are each one identifier — and a
comment separates as a space does: `const/**/a=1;` and
`import/**/a/**/from/**/"./a.f.js";` parse. After `default`, and before an
import's string, nothing is needed. DataJS requires a space after `const`,
`export` and `default` and admits no comment, more than this language asks,
so every DataJS document parses here.

|Statement|Form|
|---------|----|
|default import|`import name from "./path";`|
|JSON import|`import name from "./path.json" with { type: "json" };`|
|constant|`const name = expression;`|
|default export|`export default expression;`|

```js
import base from "./base.f.js";    // imports first

const extra = { "debug": true };   // then constants

export default [base, extra];      // exactly one, last
```

These three forms are the whole language. A statement begins with `import`,
`const`, or `export`, and never with a value; more forms land as the language
grows ([`spec/todo/`](./todo/README.md)).

## Roadmap

Everything else — unimplemented language features, ECMAScript proposals, I/O
effects, the content-addressable VM, object identity, mutability, and
serialization — is in [`spec/todo/`](./todo/README.md). A feature's document
moves into this one when the parser recognizes it.

For the implementation, see [`fjs/fsc/README.md`](../fjs/fsc/README.md), the
compiler and the data language it accepts today.
