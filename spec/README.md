# FunctionalScript Language

This is the specification of the language that the compiler accepts **today**.
A FunctionalScript module is exactly a module that

```sh
fjs compile <input> <output>
```

compiles; every rule below is a rule the `fjs` parser and serializer enforce.

Features the parser does not recognize yet — functions, operators, property
access, type annotations — and the design documents for the VM, I/O,
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
The two converge as
[`todo/parser-serializer-restructure.md`](../todo/parser-serializer-restructure.md)
proceeds.

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
|FunctionalScript|`.f.js`|A graph of values.|

The extension is what separates the two languages, and it is the only thing
that does: a text is read as whichever language its name declares.

This table is about the *language* — what `fjs compile` reads and writes. The
repository's own authored FunctionalScript is spelled `.f.mjs` instead, and its
type-level APIs live in authored `types.ts`; `.f.js` is reserved there for the
stage-2 marker, meaning a module the parser/compiler in the same revision
accepts. Neither spelling changes what the language is: a `.f.mjs` is the same
graph of values a `.f.js` is. The repository extension contract is
[`fjs/fsc/README.md`](../fjs/fsc/README.md).

### JSON Input

A `.json` input is a JSON document, read by the JSON reader. Anything else is
a FunctionalScript module, read by the module parser.

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

A `.json` output is a **tree**; any other extension makes the output a
[DataJS](./datajs/README.md) document, which is a **graph**.

```sh
fjs compile input.f.js output.f.js   # DataJS, a JavaScript module
fjs compile input.f.js output.json   # JSON
```

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
- Object properties are emitted in the order the object carries them —
  JavaScript's own-property order, array-index keys first — in both formats.
- A `__proto__` key is emitted as `["__proto__"]:` in a DataJS document and
  as `"__proto__":` in JSON ([below](#the-__proto__-key)).
- `NaN`, `Infinity` and `-Infinity` — a literal, or a number that overflowed
  to infinity — are emitted as those words in a DataJS document, and `-0` as
  `-0` in both formats.

The output is data in both formats: the module the compiler writes contains
`const` statements and one `export default`, never a function.

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

An expression is a data expression. Function definitions, operators, property
access, and grouping are not recognized yet — see the
[roadmap](./todo/README.md).

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

A number is written with JSON number syntax: an optional `-`, an integer part,
an optional fraction, an optional exponent.

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
bind, shadow or key them, and each denotes its value wherever it stands.

The `-` is lexical: it joins the number to its left as part of one token, so
`-42.5` is a number literal and `- 42.5` is not a value at all, and it joins
`Infinity` the same way — `-Infinity` is one token and `-NaN` is not a value.
There is no negation operator ([operators](./todo/2340-operators.md)).

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
`$`, not starting with a digit.

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
fjs compile input.f.js output.f.js   # {["__proto__"]:1}
fjs compile input.f.js output.json   # {"__proto__":1}
fjs compile input.json  output.f.js  # reads {"__proto__":1} as a property
```

A JSON document therefore survives the loop `proto.json → a.f.js → out.json`
byte for byte, each hop spelling the key its own language's way. The
disagreement is about a *text*, not a value, so nothing is unreachable.

The identifier spelling is not a key in either language: no JSON document
contains one, so `{ __proto__: 1 }` is an error whatever the input file is
called.

In JavaScript output the bracketed form is what makes the module round-trip —
it is the only spelling whose evaluation reproduces the property. In JSON
output the plain key stays: `JSON.parse` has no prototype special case, so
JSON already round-trips, and the bracketed form is not JSON at all.

## Importing Other Modules

```js
import a from "./a.f.js";
```

An `import` statement binds the exported value of another module to a name, so
modules can be shared and reused — a common configuration, a shared table of
constants, a fragment that several outputs include.

- Only the **default import** form is recognized. Named imports, namespace
  imports ([namespace-import](./todo/2220-namespace-import.md)), and import
  attributes ([import-attributes](./todo/2140-import-attributes.md)) are not.
- The path is a [string literal](#strings), resolved relative to the importing
  module.
- Each module is parsed and evaluated once per resolved path, and its value is
  shared by every importer. A circular dependency is an error.
- An imported file is read as a FunctionalScript module whatever its
  extension, so a **JSON document cannot be imported**: choosing the language
  is the import statement's job, and the language has no `with { type: "json" }`
  clause yet ([import-attributes](./todo/2140-import-attributes.md)).
- Every `import` comes before every `const`
  ([module structure](#module-structure)).

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
statement here ends at a `;`, never at a spot an engine infers. This is the
rule [`todo/parser-serializer-restructure.md`](../todo/parser-serializer-restructure.md)
settles on for the compiler-formatted `.f.js` output language (its stage 5),
landed ahead of that stage with the parser's move to the LL(1) backend, where
telling a newline from a `;` reached through newlines took unbounded
lookahead. The compiler writes the `;` after every statement it emits.

|Statement|Form|
|---------|----|
|default import|`import name from "./path";`|
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
