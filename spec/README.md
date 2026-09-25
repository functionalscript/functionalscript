# FunctionalScript Language

This is the specification of the language that the compiler accepts **today**.
A FunctionalScript module is exactly a module that

```sh
fjs compile <input> <output>
```

compiles; every rule below is a rule the `fjs` parser and serializer enforce.

Features the parser does not recognize yet — among them the remaining unary
operators (`! + typeof`), the comma operator and type annotations — and the
design documents for the VM, I/O, serialization, and the rest of the roadmap
live in [`spec/todo/`](./todo/README.md). Loose equality (`== !=`) is not
waiting: it stays refused ([operators](#operators)).

The compiler accepts values ([supported value types](#supported-value-types)),
the [constants](#shared-values-constants) and
[imports](#importing-other-modules) that share them,
[property access](#property-access), [operators](#operators), and
[functions](#functions) with their calls, and this document specifies all of
them. The outputs differ in what they can write, so one module may compile to
one output and be refused by another ([output](#output)).

[`spec/datajs/`](./datajs/README.md) specifies **DataJS**, a much narrower
interchange format this language contains: JSON with two extensions —
values may be shared, so a document denotes a DAG rather than a tree, and the
leaf set gains `undefined`, `bigint`, `NaN` and the infinities — and with a
`;` **required** after every statement, `export default` included (as a
module here requires it too), no `import`, no comments, no identifier keys and
no trailing commas. The language this document describes is wider, and holds
functions besides. The compiler bridges the two: to a `.data.js` output,
`fjs compile` writes a module's default export as a DataJS document, through
DataJS's own writer, and refuses a module whose program — its imports
included — holds a function, a call, or an operator other than unary `-`
([output](#output)).

## Principles

**Compatibility with JavaScript.** FunctionalScript is a subset of JavaScript,
not a language that resembles it. Every accepted FunctionalScript module must
be valid JavaScript ES module source, including lexical restrictions and early
errors. Check the original text, not text repaired or stripped by a transpiler.
Nothing has to be preprocessed for `node`, `deno`, `bun`, or a browser to parse
a `.f.js` file: the file is already JavaScript.

Source inclusion and the following requirements hold at every development
stage and outrank everything else:

1. code that passes FunctionalScript validation/compilation has no side effects;
2. for the same admitted inputs and dependency environment, successful
   FunctionalScript and JavaScript executions have the same observable result,
   except for explicitly specified semantic exceptions. This includes later
   observations through exported functions, not just the initial module value.

The observable result is the serializable data the program returns. What a
JavaScript engine reports about the *written* output of a compiler — a
function's `name` or its text after `fsc` has serialized a module — is the
writer's spelling, not a result of the program, and no compatibility
question: a compatibility issue exists only where the same program returns
different serializable data on a FunctionalScript VM and a JavaScript engine.

The execution profile declares its ECMAScript and host-resolution environment.
An exception names its profile, affected operations and observable consequences;
an identity exception is not an excuse for arbitrary differences in another
profile. Missing support may be refused, but accepted source must not silently
receive a different successful meaning.

Compatibility runs one way only. Every FunctionalScript module is JavaScript;
most JavaScript is not FunctionalScript. So the language is a **whitelist**,
and it whitelists complete semantic patterns rather than individual operations
in isolation. An otherwise-forbidden JavaScript construct may appear as a
component of a recognized pattern that lowers to a FunctionalScript primitive
— the bracketed `__proto__` key ([below](#the-__proto__-key)) is the current
example.

**Every pattern instruction must be recognized after statement and expression
structure is known.** The parser owns JavaScript's syntax, line-terminator
restrictions and statement boundaries. Pattern recognition operates on that
parsed structure with validated binding relationships; it never reinterprets
source tokens, joins statements or repairs syntax. Syntactic recognition does
not by itself admit a construct into FunctionalScript: the complete pattern
must pass the whitelist, and protected operations cannot escape it.

Outside the explicitly specified exceptions, rule 2 also decides what to do
when JavaScript gives one text a meaning FunctionalScript cannot reproduce:
the text is a compilation error, not an invitation to give it a second,
more convenient meaning.

### Function-source representation exception

**Adopted:** in FunctionalScript VM execution, the default string representation
of a function is source reconstructed from its associated EDAG, not the original
source text. Original comments, formatting and identifier spellings need not
survive. This applies to `String(f)` and every admitted indirect conversion
that reaches the same default function representation, including conversions
inside complete instruction patterns. It applies to exported functions too.

Running source directly on a JavaScript engine retains that host's function
representation. Its text can differ from the FunctionalScript VM's, including
when a JavaScript consumer reflects on an exported function. Differences
caused by using that text as a key, comparing it or branching on it are
consequences of this exception, not a blanket waiver for unrelated results.
Non-function conversion, other admitted function observations and source
syntax retain their existing contracts. The exception alone admits no new
syntax or API.

[Function text and serialization](./todo/serialization.md#function-text-and-serialization)
owns the remaining questions: whether the FSC function serializer and
`String(f)` are the same operation, whether `String(f)` instantiates captured
frames, and how each handles `self`. Adopting EDAG-derived text does not settle
those questions or claim that the conversion is implemented today, and it is
not: every executor of the EDAG, the Rust VM included, answers a conversion
the compiler admits — `f.toString()`, `'' + f`, `[f].toString()` — with text
other than the EDAG's, a defect that
[default function text](./todo/3120-parameters.md#default-function-text-render-or-refuse)
tracks, not a result the language promises.

### Failure is one outcome

All execution failures are one indistinguishable semantic outcome:

```text
throw A ≡ throw B ≡ memory failure ≡ time failure
```

Error types, messages, stacks, source positions, the first failing operation
and the work performed before failure are not language-level observations.
Operational diagnostics may report a cause, but cannot become program values
that distinguish failures. Syntax rejection remains a compiler property:
accepting invalid JavaScript is not excused by failure equivalence.

This deliberately allows reordering failing EDAG computations to fail earlier.
Do not impose source-order barriers, identical evaluation counts or identical
resource thresholds merely to preserve failure behavior. Preserve successful
paths: failure equivalence does not authorize executing an otherwise skipped
failure on such a path or inventing a successful value by deleting a required
failure. Different executors may exhaust different memory or time limits; a
more efficient one may finish where another stops. A stopped run is a failure,
not a guessed result.

When we implement features of FunctionalScript, the first priority is a
simplification of the VM, subject to these requirements.

## Exporting a Value

This is a complete module:

```js
export default 5;
```

The module function returns an object of its exports: this module returns
`{ default: 5 }`. The default export is `5`, which a default import binds and
JSON/DataJS value output serializes. If the default export is an object, it
remains inside that property; its members do not become module exports.

Named constants are exports and local bindings:

```js
export const z = [5];
export const a = z;
export default a;
```

This module returns `{ a: z, default: z, z: z }`, with all three properties
sharing the same array. Export keys follow JavaScript namespace order
(lexicographic, including `default`). Initializers use the existing `const`
rules: earlier bindings are available, and duplicate bindings are errors.
The name `then` is reserved for exports, regardless of its value, and nowhere
else: a local `const`, a parameter or an import binding may be called `then`
([names](#shared-values-constants)).

Every other name a `const` may have can be exported, a built-in prototype's
included. The export object has no prototype — a JavaScript module namespace
has none — so `export const __proto__ = 7;` returns `{ ["__proto__"]: 7 }`, an
own property like any other export, and an importer selects it the same way
([importing](#importing-other-modules)).

At least one export is required. A named-only module needs no default:
`export const a = 5;` returns `{ a: 5 }`. When present, `export default` is
**last**; only [trivia](#whitespace-and-line-terminators) — whitespace,
newlines and comments — may follow it. Ordinary and exported
constants may appear together after all imports.

A default export can be any supported value:

```js
export default { "name": "fjs", "tags": ["data", "config"] };
```

`export default` alone already expresses everything JSON expresses — the value
that follows it is the module's default export. What takes a module past a
tree, and past what JSON can hold at all, is the rest of the language:
[constants](#shared-values-constants) and [imports](#importing-other-modules)
name shared parts, and [`bigint`](#supported-value-types) and
[`undefined`](#supported-value-types) are values JSON has no spelling for.

`export { ... }` and re-exports remain unsupported. Export-list options are
tracked separately in [export-lists](./todo/export-lists.md).

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export#using_the_default_export>.

## Command Line

```sh
fjs compile <input> <output>
```

`fjs compile` reads the input and resolves every module it imports into one
program. The value outputs, `.json` and `.data.js`, evaluate that program and
write the exported value; the graph outputs — FunctionalScript, EDAG and
Rust — write the program itself and evaluate nothing ([output](#output)). So a
module whose evaluation fails, such as `const c = null.x; export default 1;`
or one that imports it, compiles to no value output — the error is
`cannot read property "x" of null` — while a graph output never sees the
failure: it writes the program, which fails when it runs, as the module does
in JavaScript.

Both file names are part of the command: the **input extension names the
input language** and the **output extension names the output format**.

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

The two file names are filesystem paths, taken literally rather than as
import specifiers, so `%41`, `?` and `#` are ordinary characters in them. An
extension is matched exactly, case included: `out.JSON` names no output format
and is refused, `out.Data.js` is a FunctionalScript name rather than a DataJS
one, and an `in.JSON` input is read by the module parser. The command takes
exactly these two names, and any other count fails, naming no file: fewer
with `Error: Requires 2 arguments`, and more with the first one it does not
read, `Error: unexpected argument --tree`, rather than succeed without it.

On success the command writes the output and exits `0`. On failure it writes
nothing, reports the error on `stderr`, and exits `1`:

```text
/project/config.f.js:3:18 - error: __proto__ requires the computed key form
```

An error names the file it belongs to, which is the input only when the
failure is there. A failure of the program names the module it happens in —
the input or any module it imports — by the path the host loaded it from,
which on Node is absolute with symlinks resolved. An import that cannot be
resolved names the module importing it; one whose module lacks the selected
export, or is not what its import attribute declares, names that module; and
a circular dependency names the module met again. Only an input that cannot
be resolved at all keeps the spelling given on the command line. A value
output refusing the program — `a function has no value`,
`a call has no value`, `an operator has no value` — names the module holding
what it refused. A refusal of the output names the output as given instead,
since the module itself is sound: an extension naming no format, a value JSON
cannot spell, a node the FunctionalScript or Rust writer has no spelling for
(`out.js - error: a + node`). A failure to write the output — a missing
directory, a name that is a directory — is reported in the host's own words,
which name the output too:
`ENOENT: no such file or directory, open 'out/config.json'`.

A parse error carries the token's `path:line:column`, as above. A lexical
error — a character no token begins with, a string or block comment the input
ends inside, or one holding a character or escape it may not — carries a span
instead, from where its token began to where the input ends:
`path:line:column-column` within one line and `path:line:column-line:column`
across lines. A file holding only `export default @;` is reported at
`/project/bad.f.js:1:16-18`, or at `1:16-2:1` when a newline ends it. A
malformed number points at the character that spoils it: `08` at its `8`.
Lines and columns count from 1, and a column counts UTF-16 code units, so a
tab is one and a character beyond U+FFFF two. A line ends where JavaScript
ends one: at a newline ([whitespace](#whitespace-and-line-terminators)), and
at a U+2028 or U+2029 inside a string. A diagnostic counts LF alone yet, so a
position after a lone CR, or after either separator in a string, is reported
on an earlier line than JavaScript counts
([lone-cr-line-numbers](../fjs/js/tokenizer/todo/lone-cr-line-numbers.md)).

The JSON reader tracks no lines. A malformed `.json` document, the input or an
import, gives in its message the UTF-16 code-unit offset reading failed at,
counted from 0 — `/project/e.json - error: unexpected symbol at 19` — or
`unexpected end` when the text runs out
([parse-error-location-format](../fjs/media/json/todo/parse-error-location-format.md)).

`fjs compile` is one of several `fjs` commands; see
[`fjs/README.md`](../fjs/README.md) for the rest.

### Source Text

Every file `fjs compile` reads — the input and every module or document it
imports, directly or not — is UTF-8 text, as a JavaScript host reads a module
or a JSON import, and every output is written in UTF-8. Any character beyond
ASCII, one beyond U+FFFF included, may stand raw in a string, and any but
U+2028 and U+2029 in a comment ([comments](#comments)); it is the code point
its bytes encode, exactly as JavaScript reads it: `export default "é中😀";`
is a string of three code points, four UTF-16 code units. Everywhere else the
text is ASCII ([identifiers](#identifiers),
[whitespace](#whitespace-and-line-terminators)).

A byte order mark is refused, although a JavaScript host strips it:
`EF BB BF` decodes to U+FEFF, which is not whitespace here, so a module or a
`.json` document beginning with one is an error, as a
[DataJS](./datajs/README.md#encoding) document with one is.

Bytes that are not correct UTF-8 are not text, and a file holding them —
anywhere, a string or a comment included — is refused, naming the file:
`a.f.js - error: not UTF-8 text`. Decoding them anyway would give a raw `FF`
in a string U+00FF where a JavaScript host reads U+FFFD, a different value.

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
type-level APIs live in authored `types.ts`; `.f.js` there is the stage-2
marker, meaning a module the parser/compiler in the same revision
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

For the root, the declaration is the name on the command line. The root is
resolved to its real file as an import is, symlinks followed
([host profile](#importing-other-modules)), and a root named `.json` is read
by the JSON reader whatever the file it resolves to is called. A root with any
other name that resolves to a file named `.json` is refused, the way an import
of that file without `with { type: "json" }` is (`a JSON module needs the
import attribute with { type: "json" }`), since the command line has no
attribute to state that type with.

### Output

An output is the language its extension declares, matched by the longest
suffix first and case-sensitively. A `.json` output is a **tree**; a
`.data.js` or `.data.mjs` output is a [DataJS](./datajs/README.md) document,
which is a **graph** of values; and any other name ending in `.js` or `.mjs`,
`.f.js` and `.f.mjs` included, is a FunctionalScript module, a graph of values
*and functions*. An `.mjs` name asks for the writer its `.js` twin does, for a
file that must load as an ES module whatever the enclosing package's `"type"`
field says ([files and media type](./datajs/README.md#files-and-media-type)).

```sh
fjs compile input.f.js output.data.js   # DataJS, a JavaScript module
fjs compile input.f.js output.js        # FunctionalScript
fjs compile input.f.js output.json      # JSON
```

The JavaScript names are nested, not disjoint: a DataJS document is a
FunctionalScript module, so the narrower name is what asks for the narrower
writer — the one that refuses a function.

`fjs compile` writes two more things, neither of them a document of this
language: the program's EDAG under `.edag.data.js` or `.edag.data.mjs`, and a
generated Rust module under `.rs`, which [nanvm-lib](../nanvm-lib/README.md)
runs. They are compiler artifacts, and [`fjs/fsc`](../fjs/fsc/README.md)'s to
describe. A name ending in none of the eight suffixes — `.json`, `.data.js`,
`.data.mjs`, `.js`, `.mjs`, `.edag.data.js`, `.edag.data.mjs` and `.rs` —
declares none of the five, and is refused before the input is read, rather
than written in a language the name does not declare: `.ts`, `.JSON` and a
name with no extension alike.

`.json` and `.data.js` are the **value outputs**: they evaluate the program
and write the value it computes. `.js`, `.edag.data.js` and `.rs` are the
**graph outputs**: they write the program's graph and evaluate none of it.
What a module holds decides which outputs it has. A function, a call or an
operator counts wherever it stands in the program; a shared object or array
and a `bigint` count only where an output writes them, which for `.json` is
the selected value (below):

|A module holding|`.json`|`.data.js`|`.js`|`.edag.data.js`|`.rs`|
|----------------|-------|----------|-----|---------------|-----|
|a function|refused|refused|written|written|written|
|a call|refused|refused|refused|written|written|
|unary `-`|computed|computed|written|written|written|
|any other operator|refused|refused|refused|written|written|
|an object or array reached twice|refused|a `const`|a `const`|a shared node|a shared value|
|a `bigint`|refused|written|written|written|written, a literal within `i64`|

A value output refuses a function, which neither DataJS nor JSON can spell
(`a function has no value`), and a call or an operator other than unary `-`,
whose result is the interpreter's to compute
([`interpret-edag.md`](../fjs/fsc/todo/interpret-edag.md)): `a call has no
value`, `an operator has no value`. It computes unary `-` over a primitive, as
JavaScript does — `-"2"` is `-2` — and refuses it over an object or an array
(`no number for this value`). Of the graph outputs, the `.js` writer has no
spelling yet for a call or for an operator other than unary `-` (the
FunctionalScript bullet below), and the EDAG holds every node, folding unary
`-` where its operand lowers to a number or a `bigint` ([numbers](#numbers)).
The Rust module holds every node too and computes each operator as JavaScript
does, running the right operand of `&&`, `||` and
`??` and each arm of `?:` only where JavaScript evaluates it, so an unreached
`1n / 0n` never throws. The VM does not answer every member function the
compiler admits yet
([member-functions](../nanvm-lib/todo/member-functions.md)). The Rust writer
refuses a literal Rust has no spelling for, naming the output and writing
nothing: a `bigint` outside `i64` — `-9223372036854775808n` is written and
`9223372036854775808n` refused. A string holding a lone surrogate, which no
Rust `&str` can hold, is written as its UTF-16 code units.

For a FunctionalScript input, JSON and DataJS output serialize the module
result's `default` property, with sharing checked for that selected value.
Selecting the `default` does not narrow what they evaluate: a value output
evaluates the whole program — every `const`, exported or not, of the input and
of every module it loads, one an `import {}` loads included — so a function, a
call, or an operator other than unary `-` anywhere in that program refuses the
output, even where the `default` never reaches it:
`const g = () => 1; export default 5;` compiles to the three graph outputs
alone. A named-only root projects to `undefined`: DataJS writes
`export default undefined;`, while JSON refuses `undefined`. FunctionalScript
output preserves each named export as `export const` and writes `export default`
last when present. Dependencies and shared values are declared before use;
recompilation does not add another wrapper. EDAG and Rust
output write the complete export object. A direct `.json` input remains a
document: its value is used without projection, even when it contains a property
named `default`. Imported JSON instead exposes `{ default: document }` at the
module boundary, from which a default import selects the document.

- A DataJS document is written in
  [normalized form](./datajs/README.md#normalized-form): one line, and an
  object or array referenced more than once hoisted into a `const` named `$0`,
  `$1`, … in post-order, so it stays shared
  ([shared values](#shared-values-constants)); a primitive is written inline
  wherever it is read, however often, since sharing one is not observable.
  Every value a value output computes has a document, shared nodes, `bigint`,
  `undefined`, `NaN` and the infinities included.
- JSON is a tree, and the compiler refuses what JSON cannot spell rather than
  write a file that reads back as a different value: an object or array the
  value reaches along more than one reference — through a `const`, an import
  or a property access — which written twice reads back as two (`no JSON
  spelling for a shared node`); `bigint`, `undefined`, `NaN`, `Infinity` and
  `-Infinity`, which JSON has no word for. A primitive reached twice is not
  shared, having no identity to lose: `const s = "str"; export default [s, s];`
  is `["str","str"]`, while `const o = {}; export default [o, o];` is refused.
  A `bigint` is refused even though its digits are JSON, since `1` reads back
  as the *number* `1`. The refusal names the output file and writes nothing.

  The sharing check is exact within a module and coarser across modules,
  where it may refuse a tree it cannot prove is one, never the reverse. A
  module whose own value holds a shared node counts as shared under any
  route an importer takes into it, and so does every module it reaches:
  a selected container, `p.selected`, is refused when another member of `p`
  holds a shared node or a module the importer also selects, while a
  selected primitive is written, having no identity to lose. Two exports of one module that hold
  containers — `import { a, b }` returned as `[a, b]` — are refused even when
  disjoint, where `m.a` and `m.b` of one default import are not. The other
  four outputs accept these, and
  [`named-export-sharing-precision.md`](../fjs/fsc/todo/named-export-sharing-precision.md)
  is the task that lifts the refusal.

  A JSON document is written as `JSON.stringify` writes the value: one line,
  no whitespace and no trailing newline, members in the value's order
  (below), and numbers and strings spelled by the
  [normalized form](./datajs/README.md#normalized-form)'s rules. The one
  departure is `-0`, written `-0` where `JSON.stringify` writes `0`. A
  `.json` input compiled to `.json` is written the same way, its whitespace
  and escapes normalized.
- A FunctionalScript document is written from the program's graph rather
  than from its value: the module is not evaluated, so a function has a
  document too, which is what DataJS and JSON have no spelling for. Writing
  the graph is not writing the value, so the two module outputs part wherever
  the program computes: `const a = { b: 1 }; export default a.b;` is
  `export default {"b":1}.b;` here and `export default 1;` as DataJS. They
  agree on a normalized DataJS document, which computes nothing — every one
  of them is a fixed point of both.

  A module whose only export is `default` is written in the same normalized
  form, unless a module it loads holds a `const` or an import nothing reads.
  In that form a function referenced more than once is hoisted as an object
  is, and a `const` the value never reaches stays a statement, since loading
  the module evaluates it. Any other module — one with a named export, or
  one loading such a module — gives every array, object, function, access
  and operation outside a function body a `const` of its own, however many
  references reach it, in graph order with dependencies first, while a body
  keeps what it holds in place. Only a leaf stays inline, and `undefined` is
  not one there: it lowers to the node `["undefined"]`, so it gets a `const`
  as a node does — `export const a = 1; export default undefined;` is
  `const $0=undefined;export const a=1;export default $0;`. Each export names
  its value's `const` or holds its leaf:
  `const once = [1]; export const b = [once]; export default 3;` is
  `const $0=[1];const $1=[$0];export const b=$1;export default 3;`. The
  names gain a `$`, `$$0`, when an export's name begins with `$`.

  The writer does not spell most of what computes yet: it writes a property
  access and unary `-`, and refuses a call and every other operator by the
  name of the node it meets — `a () node`, `a chain step`, `a + node`,
  `a binary - node`, `a ~ node`, `a && node`, `a ?: node` and the like —
  wherever the node stands, a function body or a `const` nothing reads
  included. The binary operators and `~` are
  [`stage-a-operators.md`](../fjs/fsc/serializer/todo/stage-a-operators.md)'s
  to add. A module holding a call or such an operator compiles to
  `.edag.data.js` and `.rs` alone.
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
- An access in a FunctionalScript document is written from its constant key
  ([property access](#property-access)): a string key that is an
  [identifier](#identifiers), a reserved word included, follows a `.`, and
  any other string key is a normalized string in brackets — with the object
  named `$0`, `a["if"]` and `a['c']` are `$0.if` and `$0.c`, while
  `a["a-b"]`, `a["é"]` and `a["1"]` stay bracketed. A number key stays a
  number in brackets, in normalized spelling — `a[1e21]` is `$0[1e+21]` — so
  `a["0"]` and `a[0]` keep their own spellings. A number, a `bigint`, a
  function or a negation an access is taken on is named first rather than
  written in place: `1 .x` is `const $0=1;export default $0.x;`.
- `NaN`, `Infinity` and `-Infinity` — a literal, or a number that overflowed
  to infinity — are emitted as those words in a DataJS or FunctionalScript
  document, and `-0` as `-0` in every format.

## Comments

Comments are [trivia](#whitespace-and-line-terminators). Their text does not
become an AST value, but the parser preserves line-terminator information
needed by JavaScript's grammar. A line break inside a block comment counts at
a restricted boundary too, such as after `return` or before `=>`
([functions](#functions)).

```js
// a line comment runs to the end of the line

/** @type {number} */
export default -42.5;
```

|Form|Syntax|
|----|------|
|line comment|`// ...`|
|block comment|`/* ... */`|

A line comment runs to the next newline or to the end of the file. A block
comment runs to the first `*/`, may span lines, and is an error if the file
ends first. Their text may be any characters, non-ASCII included, except
U+2028 and U+2029, which are refused in a comment as everywhere outside a
string ([line terminators](#whitespace-and-line-terminators)): JavaScript
ends a line comment at either, so what follows one is code there and never
comment text here, and reads either inside a block comment as a line break.

Block comments carry JSDoc/TypeScript type declarations, which is why the
language has them: a `.f.js` file is type-checked as JavaScript, and JSDoc is
how it says what its types are.

A comment can separate tokens where whitespace can, which is between any two
([trivia](#whitespace-and-line-terminators)). At unrestricted boundaries, the
`;` that ends a statement may follow a comment on the same line or a later
one ([module structure](#module-structure)), as any other token may. This
does not make newlines interchangeable with spaces at restricted boundaries.

Comments belong to the module language. A `.json` input containing one is an
error, because JSON has no comments.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#comments>.

## Lexical Grammar

A module is a sequence of tokens — words, numbers, strings and punctuators —
with trivia between them: whitespace, newlines and [comments](#comments).
Trivia only separates tokens, and at a boundary JavaScript restricts it also
says whether a line break stands there. The literal tokens are specified with
their values — [numbers](#numbers), [bigints](#bigints), [strings](#strings)
— and this section gives the characters between tokens and the spelling of a
word.

### Whitespace and Line Terminators

Whitespace is a space (U+0020) or a tab (U+0009). A newline is a line feed
(LF, U+000A), a carriage return (CR, U+000D), or CR followed by LF, which is
one line break. Those are JSON's four whitespace characters, the same four
[DataJS](./datajs/README.md#whitespace) admits.

Trivia may stand between any two tokens, before the first and after the last,
and it is insignificant there, newlines included: a newline ends no statement
([module structure](#module-structure)), and inside an expression a line break
reads as a space does, exactly as JavaScript reads it: `a` followed by
`.length`, `[0]` or `+ 2` on the next line is `a.length`, `a[0]` or `a + 2`,
and `f` followed by `(1)` is the call `f(1)`. Trivia is needed only where two
tokens would otherwise read as one: `const a`, not `consta`
([module structure](#module-structure)); `1 .x`, not `1.x`
([property access](#property-access)).

The exceptions are the boundaries JavaScript restricts, before `=>` and after
`return`, where a line break is refused ([functions](#functions)). There the
trivia is a line break if a newline of any of the three forms stands in it,
inside a block comment or not ([comments](#comments)).

Nothing else is trivia. JavaScript's other whitespace — VT (U+000B), FF
(U+000C), U+FEFF, and the Unicode space separators such as NBSP (U+00A0) and
U+3000 — is refused, although JavaScript accepts it, a byte order mark at the
start of the file included ([source text](#source-text)). JavaScript's other
two line terminators, U+2028 and U+2029, may stand raw only inside a
[string](#strings), as in JSON; anywhere else, a comment included, they are
refused, since an invisible line break is no line break here. A hashbang
comment, `#!` at the start of the file, is refused too, although JavaScript
admits one ([hash comments](../fjs/fsc/todo/083-fsc-hash-comments.md)). Any
other character outside a string or a comment is part of a token or an
error, as it is in JavaScript.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#white_space>.

### Identifiers

An identifier is ASCII: a letter `A`–`Z` or `a`–`z`, `_` or `$`, then any
number of those or the digits `0`–`9`. `a`, `_x`, `$0` and `a_$1` are
identifiers, and `1a` is not. Every word is spelled this way — a `const`,
`import` or parameter name, an identifier key, the name after `.`, and the
keywords — and which words may name a binding is the reserved-word rule of
[shared values](#shared-values-constants): a reserved word may still be a key
or a property name, `{ if: 1 }` and `a.default` included.

The rest of JavaScript's identifier grammar is not recognized yet
([roadmap](./todo/README.md)), and each of its other spellings is a
compilation error: a non-ASCII character in a name, a letter
(`const é = 1;`, `{ π: 1 }`, `o.é`) or U+200C or U+200D (ZWNJ, ZWJ)
included, and a Unicode escape in a name (`const \u0061 = 1;`, `\u{61}`,
`{ \u0069f: 1 }`). Non-ASCII text is fine inside a string, so such a key is
written as one: `{ "é": 1 }`, `o["é"]`.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers>.

## Supported Value Types

An expression is a data expression, a property access, a function, a call, an
operator ([operators](#operators)) — a prefix `-` (negation) or `~` (bitwise
not), a binary operator or the conditional `?:` — or any of those in
parentheses ([grouping](#grouping)).

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

A reference is a name in scope — an `import`, a module or body `const`, or a
function parameter — and denotes the value that name holds
([shared values](#shared-values-constants), [functions](#functions)). It is
not a kind of value of its own: what a reference denotes is one of the types
above, and what makes it worth writing is that two references can denote the
*same* value.

The ❌ rows are what a module has and a JSON document does not, and every one
of them but `reference` is also what a `.json` output cannot carry
([output](#output)). A reference is not a value, so a `.json` output writes
the value it denotes: `const a = [1]; export default { p: a };` is
`{"p":[1]}`. What JSON cannot carry is the *sharing*: an object or an array
the value reaches along more than one reference, which written twice would
read back as two, is refused rather than copied ([output](#output)).

### Numbers

A number is written with JSON number syntax less its sign: an integer part, an
optional fraction, an optional exponent. A leading `-` is not part of the
literal but the [unary minus](#supported-value-types) applied to it, which is
why `- 42.5` is the same value written with a space.

```js
export default [0, -42.5, 3e2, 1E-7];
```

A literal denotes the IEEE 754 double nearest its decimal value, as it does in
JavaScript and in `JSON.parse`: digits beyond a double's precision round away,
so `9007199254740993` is `9007199254740992`; a literal too large for a double
is `Infinity` (`1e400`); and one too small is `0` (`1e-400`), which is why
`-1e-400` is `-0`. A `.json` input reads its numbers the same way. An
overflowed literal is an `Infinity` like any other, written as the word where
a format has one and refused by a `.json` output ([output](#output)).

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

**FunctionalScript has one `NaN`.** IEEE 754 gives a `NaN` a sign and a
payload, and a JavaScript program can read them — through a typed array or a
`DataView`, which FunctionalScript has none of. Nothing else tells two `NaN`s
apart: every operator, coercion and comparison treats each the same,
`Object.is` included, and each is written as the word `NaN`. So a `NaN`'s
bits are not serializable data, hence not an observation and not a
compatibility question ([principles](#principles)): every `NaN` is the one
value, and a writer may spell them all as one — the Rust writer spells each
as the quiet `NaN` with an empty payload.

The `-` is the **unary minus operator** ([operators](./todo/2340-operators.md)),
the first operator the language had; `~`, the **bitwise not operator**, is the
other prefix, Stage A of the same operators document. Neither is part of the
literal after it: `-42.5` is the negation of `42.5`, `- 42.5` is the same
value written with a space, and `-NaN` and `-Infinity` are values as
JavaScript has them. Each binds looser than a property access or a call, as
in JavaScript, so `-1 .x` is `-(1 .x)` and `-1()` is `-(1())`. What either
takes is JavaScript's `UnaryExpression`, which an arrow function is not, so
`-(...a) => 1` and `~(...a) => 1` are syntax errors in both, and neither
stands immediately before `**` — `-2 ** 2` is refused, matching JavaScript,
where `(-2) ** 2` and `-(2 ** 2)` are the parenthesized readings — though
either may stand right after it, as in JavaScript: `2 ** -2` is `2 ** (-2)`
and `2 ** ~2` is `2 ** (~2)`. Two adjacent `-` characters are the decrement
operator, which the language has no rule for, so a negation of a negation is
spaced, `- -1`, or grouped, `-(-1)`. `~` has no such token, in JavaScript or
here, so `~~1` is two bitwise nots, the same as `~ ~1`.
[Operators](#operators) has the rest of them.

A negative number is therefore an expression rather than a literal *in the
syntax*. The graph is another matter: lowering folds a negation into a leaf
when its operand lowers to a number or a `bigint`, since negating one is exact
arithmetic, so the EDAG of `-1` is the leaf `-1` and not an operation. The
operand is judged as lowered, not as written: a numeric literal, `NaN` or
`Infinity`, a `const` holding a number or a `bigint` — a captured one
included — and another folded negation all fold, so
`const a = 1; export default - -a;` is the leaf `1`, and its FunctionalScript
output is `export default 1;`. An import of a number or a `bigint` folds too
where it lowers to that value, which it does from a module that computes
nothing but its default export, as a JSON document does; from any other
module it lowers to that module's computation — its statement sequence, or
a read of its export object when the module exports more than `default` —
and stays an operation. A negation of anything else stays one too: of a string, a
boolean, `null`, `undefined` or a container, since folding it would mean
saying what that value converts to, and of an access, a parameter or a call,
whose value lowering does not compute. No other operator folds, even over
numbers: `~1` and `1 + 2` stay nodes, and `-1 * 2` multiplies the leaf `-1`.

A `.json` or DataJS output is a value, so it computes a negation that
survives, as JavaScript's unary `-` does, when the operand is a primitive: a
`bigint` stays a `bigint`, and any other primitive converts to a number —
`-"2"` is `-2`, `-true` is `-1`, `-null` and `-""` are `-0`, and `-undefined`
and `-"abc"` are `NaN`, which a `.json` output then has no spelling for. A
negation of an array or an object, written out or reached through a reference
or an access, is refused there (`no number for this value`): converting a
container is JavaScript's `ToPrimitive`, whose answer depends on what the
container holds — `-[5]` is `-5` and `-{}` is `NaN` — and a value output does
not compute it. The refusal reaches a `const` the default export never reads
as well, since a value output evaluates the whole program
([output](#output)). The EDAG and FunctionalScript outputs keep such a
negation as written.

### Bigints

A `bigint` is written as a number's integer part — `0`, or digits not
starting with `0` — followed directly by a lowercase `n`: `0n`, `34n`,
`123456789012345678901234567890n`. Like a number it is unsigned: `-34n` is
the [unary minus](#numbers) applied to `34n`, which lowering folds into the
leaf `-34n` as it folds a negated number, and `-0n` is `0n`, since a `bigint`
has no negative zero, as in JavaScript.

```js
export default [0n, 34n, -34n];
```

The syntax is that integer part and the `n`, so the JavaScript spellings it
leaves out are not recognized: no hexadecimal, octal or binary prefix
(`0x10n`, `0o7n`, `0b1n`) and no numeric separators (`1_000n`). A fraction or
an exponent (`1.5n`, `1e3n`), a leading zero (`01n`) and an uppercase `N` are
errors in both languages. JSON has no spelling for a `bigint`, so a `.json`
output refuses one ([output](#output)).

### Strings

A string is JSON's, between double quotes or between single quotes:

```js
export default ["hello!", 'hello!'];
```

Between double quotes it is exactly JSON's string: JSON's escapes — `\"`,
`\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, and `\uXXXX` — and no unescaped `"`,
`\` or C0 control character (U+0000 through U+001F). Between single quotes it
is the same with the delimiters swapped: a `"` stands for itself, and `\'` is
the one escape it adds, so `'it\'s'` and `"it's"` are one string. Every other
code point may stand raw in either quote, as in JSON: DEL (U+007F), the C1
controls (U+0080 through U+009F), U+FEFF, U+2028 and U+2029, and a code point
above U+FFFF included. The quote is a spelling, not part of the value, and
every output writes the string between double quotes.

`\'` stays refused between double quotes, where JavaScript accepts it, so a
double-quoted string is always a JSON string. JavaScript's other spellings —
the `\v`, `\0`, `\xHH` and `\u{…}` escapes, a raw TAB or other C0 control
character, a line continuation — are refused in both quotes, as is a template
literal; see [js-string-literals](./todo/2460-js-string-literals.md) and
[template-literals](./todo/3440-template-literals.md).

This holds at every string position of a module: a value, an object key,
plain or in brackets, the key of a property access in brackets (`o['k']`),
the path of an `import` statement and the value of its attribute —
`with { type: 'json' }` is the attribute `with { type: "json" }` is.

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

A member may hold any value, `undefined` included, and a member holding
`undefined` is still an own property, as in JavaScript: it keeps its key and
that key's position, so `{ x: undefined }` is not `{}`, although reading `x`
gives `undefined` from both. `{ x: 1, x: undefined }.x` is `undefined`, and
`{ x: undefined, y: 2, x: 3 }` has the keys `x` and `y`, in that order. A
DataJS or FunctionalScript output writes the member, `{"x":undefined}`; a
`.json` output refuses it rather than drop it the way `JSON.stringify` does
([output](#output)).

#### Property Keys

A key is a constant, written in one of three ways:

|Form|Example|
|----|-------|
|string literal|`{ "a": 1 }`|
|identifier|`{ a: 1 }`|
|bracketed string literal|`{ ["a"]: 1 }`|

The three spellings denote the same key and mix freely inside one object. An
identifier key is an [identifier](#identifiers) — ASCII letters, digits, `_`
and `$`, not starting with a digit — and may be a reserved word, `{ if: 1 }`,
as it may in JavaScript. A key no identifier spells is written as a string:
`{ "é": 1 }`, `{ "a-b": 1 }`.

A key may be any name, including one a built-in prototype gives a value:
`{ constructor: 1, toString: 2, push: 3 }` is an object that owns those three
properties, as in JavaScript, whichever spelling each key takes. What
[property access](#property-access) refuses is reading such a member back,
not owning it, and `__proto__` is the one key with a rule of its own
([below](#the-__proto__-key)).

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
is, and `(o.toString)(1)` the method call `o.toString(1)` is, its key judged
by the call rule and not the read rule ([property access](#property-access)):
`(a.push)(1)` is refused at the key as a prohibited member function, as
`a.push(1)` is, and `(o.toString)` alone, a read, stays refused.

What a group does change is how far an operator reaches. A group is one
operand of whatever operator stands around it, so it overrides precedence
and associativity as in JavaScript ([operators](#operators)): `(1 + 2) * 3`
multiplies the sum, `1 - (2 - 3)` and `(2 ** 3) ** 2` reverse the default
association, `(a ? b : c) + 1` adds to the chosen arm, and `(1 + 2) ** 2`
raises the sum. It bounds how far a prefix reaches too, since `-` binds
looser than a step ([unary minus](#supported-value-types)): `(-1).x` is the
access on the negation and `-1 .x` the negation of the access, as JavaScript
reads each. A group is an operand of `-` as well, and the one way a function
reaches the prefix at all: `-((...a) => 1)` is a value where `-(...a) => 1`
is a syntax error, there and here.

A parenthesized parameter list, `(a, b) => …`, is distinguished from a group
by the arrow following `)`. Each parameter must be a binding name; `(a + b)`
is a group, while `(a + b) => 1` is refused.

## Operators

```js
export default 1 + 2 * 3;
```

Beyond unary `-` ([supported value types](#supported-value-types)), the
language has arithmetic (`+ - * / % **`), comparison
(`=== !== > >= < <=`), and bitwise (`& | ^ ~ << >> >>>`) — Stage A of
[operators](./todo/2340-operators.md) — and, above them, the lazy operators
(`&& || ??`) and the conditional (`?:`), Stage B. `==`/`!=` stay refused,
since neither language reads them the same way twice. The comma operator is
not recognized yet.

Precedence and associativity follow JavaScript's own. From the tightest, the
levels are the prefixes `-` and `~`; `**`; `* / %`; `+ -`; the shifts
`<< >> >>>`; `< <= > >=`; `=== !==`; `&`; `^`; `|`; `&&`; `||`, with `??` a
chain of its own at the same level; and the conditional above them all. The
shifts therefore sit between arithmetic and comparison, unlike `& ^ |`:
`1 << 2 + 3` is `1 << (2 + 3)` and `1 << 2 < 5` is `(1 << 2) < 5`. `**` is
right-associative (`2 ** 3 ** 2` is `2 ** (3 ** 2)`), the conditional nests
to the right (`a ? b : c ? d : e` is `a ? b : (c ? d : e)`), and every other
operator here is left-associative; a group overrides both
([grouping](#grouping)). `-`/`~` immediately before `**` are refused,
matching JavaScript exactly: `-2 ** 2` and `~2 ** 2` are syntax errors here
as there, at any depth of `-`/`~` nesting, and parentheses are the only way
to write either reading — `(-2) ** 2` raises the negation, `-(2 ** 2)`
negates the power. Immediately after `**` a prefix needs no parentheses,
since JavaScript reads the right operand of `**` as another power or a
`UnaryExpression`: `2 ** -2` is `2 ** (-2)` and `2 ** ~2` is `2 ** (~2)`.
The refusal holds inside that operand too, so `2 ** -2 ** 2` is a syntax
error in both languages, as its right side `-2 ** 2` is. `??` mixes with
`&&`/`||` only under parentheses, as in JavaScript: `a ?? b || c` and
`a && b ?? c` are syntax errors in both, and `(a ?? b) || c` is the one
spelling of that reading.

Each operator means what JavaScript's means and takes any value as an
operand, converted exactly as JavaScript converts it — save a function's
string, which the
[function-source representation exception](#function-source-representation-exception)
governs. Arithmetic and bitwise operators convert each operand to a number,
a `bigint` staying one: `"5" - 2` is `3`, `true + true` is `2`, `null + 1`
is `1`, and `undefined + 1` and `[1, 2] * 1` are `NaN`. `+` alone
concatenates instead when either operand, made primitive, is a string —
`"a" + 1` is `"a1"`, `1 + "2"` is `"12"`, `"x" + null` is `"xnull"` — and
an array or an object is made primitive as JavaScript's `ToPrimitive` makes
it: an array is its elements joined by `,`, `null` and `undefined` as empty
strings (`[1] + [2]` is `"12"`, `[1, [2, 3]] + ""` is `"1,2,3"`), and an
object is `"[object Object]"` unless it owns a `valueOf` or a `toString`,
which is called as JavaScript calls it. Left associativity decides the rest:
`1 + 2 + "3"` is `"33"` and `"1" + 2 + 3` is `"123"`. `< <= > >=` compare
by UTF-16 code unit when both operands, made primitive, are strings
(`"10" < "9"` is `true`), and numerically otherwise (`"10" < 9` is `false`,
`null >= 0` is `true`, `undefined < 1` is `false`); `===`/`!==` convert
nothing.
[`fjs/edag/operations`](../fjs/edag/operations/module.f.mjs) owns each
node's meaning, and the [`fjs/nanvm`](../fjs/nanvm/module.f.mjs) corpus
checks its cases against a JavaScript engine.

A `bigint` stays exact. Over two of them the arithmetic and bitwise
operators are integer operations of any size — `2n ** 64n` and `1n << 70n`
are exact, `7n / 2n` is `3n` and `-7n / 2n` is `-3n`, truncated toward zero,
`-7n % 2n` is `-1n` and `~5n` is `-6n` — and `< <= > >=` weigh a `bigint`
against a number by value (`1n < 2`, `3 > 2n` and `1n <= 1.5` are `true`),
while `===` never equates the two (`1n === 1` is `false`). Where JavaScript
throws, so does the operation here
([failure is one outcome](#failure-is-one-outcome)): a `bigint` mixed with a
number in an arithmetic or bitwise operator (`1 + 1n`), `>>>` on a `bigint`,
`/` or `%` by `0n`, and a negative `bigint` exponent (`2n ** -1n`). A string
still concatenates: `"a" + 1n` is `"a1"`.

The lazy operators establish their right operand only when the left decides
nothing — `a && b`'s `b` when `a` is truthy, `a || b`'s when `a` is falsy,
`a ?? b`'s when `a` is `null` or `undefined` — and yield the last operand
they established, not a boolean (`0 && 2` is `0`, `1 && 2` is `2`); the
conditional establishes exactly one of its arms, as JavaScript does. A
`const` reached only through such a position is still evaluated when the
module loads, as its own statement:
`const c = null.x; export default [a && c, b && c];` throws at load in both
languages, whatever `a` and `b` are. The
[failure contract](#failure-is-one-outcome) says what an implementation may
reorder around that; being reached only through a lazy position is not what
decides whether a `const` runs.

Unparenthesized, a function is no operand of these operators, the
conditional's condition included: `(...a) => body` reads everything to its
right as `body`, exactly as in JavaScript, so `1 * (...a) => 2` is refused
where `1 * (...a)` runs out of value to read, and `(...a) => 1 ? 2 : 3` is
one function whose body is the conditional. A group makes a function an
operand, the same way it does for `-`: `1 * ((...a) => 2)` is a value, `NaN`,
however little multiplying by a function is worth. The conditional's arms
are the exception: each is a whole value, as in JavaScript, so a function
stands in either bare, its body ending where `:` cannot continue it —
`1 ? () => 2 : 3` is the function and then the else arm, and
`0 ? 2 : () => 3 ? 4 : 5` is `0 ? 2 : () => (3 ? 4 : 5)`.

The front end computes none of these — it builds the operation and passes
it on. Unary `-` alone folds, over an operand that lowers to a number or a
`bigint`, exact and total arithmetic ([numbers](#numbers)); every other
operator here reaches the EDAG as a node, over numbers too (`1 + 2`, `~1`),
the lazy ones and the conditional included. Of the other outputs
([output](#output)), the Rust one spells every operator, running a lazy
operand or an arm only where JavaScript would; its VM does not yet call an
object's own `valueOf` or `toString` in a conversion
([`member-functions.md`](../nanvm-lib/todo/member-functions.md)). A `.json`
or DataJS output — the readers that compute a value — computes a negation of
a primitive and refuses one of an array or an object ([numbers](#numbers)),
and refuses every other operator the same way it refuses a function or a
call (`an operator has no value`), until the EDAG interpreter answers for
them there ([`interpret-edag.md`](../fjs/fsc/todo/interpret-edag.md)). The
FunctionalScript writer, the `.js` output, spells unary `-` alone so far and
refuses the rest by the name of the node it meets — `a + node`,
`a binary - node`, `a ?: node` — until it can spell their precedence
([`stage-a-operators.md`](../fjs/fsc/serializer/todo/stage-a-operators.md)
tracks Stage A's). `.json`, `.data.js` and `.js` refuse such an operator
wherever it stands, an unused `const` included, so a module holding any
operator but unary `-` compiles to `.edag.data.js` and `.rs` alone.

## Property Access

```js
const cfg = { ports: [80, 443] };
export default [cfg.ports[0], cfg["ports"].length];
```

A property access reads an **own property** of a value — a member of an
object, an element or the `length` of an array, a code unit or the `length`
of a string, the `length` of a function. Any value takes one: a reference, a
group, an access, a call, or a value written out of any
[type](#supported-value-types) — `null`, `undefined`, a boolean, a number, a
`bigint`, a string, an array or an object. A property the value does not own
is `undefined` — `true.x` and `true.length` are, a boolean owning nothing —
and reading one of `null` or `undefined` is an error, as JavaScript throws.

A numeric literal takes an access like anything else: `1 .x` is `undefined`,
written with a space since `1.x` is one number and a stray word, while a
`bigint`'s `n` ends its literal, so `1n.x` needs none. The sign binds looser,
as it does in JavaScript, so `-1 .x` is `-(1 .x)`, `-1n.x` is `-(1n.x)`,
which is `NaN`, and `const n = 1;` followed by `n.x` is `undefined` in both
languages.

The key is a constant — an [identifier](#identifiers) after `.`, or a string
or a numeric literal in brackets — and `0` and `"0"` name the same element,
as in JavaScript. A numeric literal names the string JavaScript's `String`
gives its number, which is the number's
[normalized DataJS](./datajs/README.md#normalized-form) spelling: `a[1.0]`,
`a[1e0]` and `a[0.1e1]` are `a["1"]`, `o[1e21]` is `o["1e+21"]`, `o[1e-7]`
is `o["1e-7"]`, and `o[1e400]`, a literal that overflows, is
`o["Infinity"]` — a key the FunctionalScript (`.js`) output refuses to write
(`a number key no literal reads back`). A string in brackets is the key
unchanged, so `a["01"]` and `a["1.0"]` name no element and are `undefined`,
as in JavaScript. Anything else in the brackets is not recognized yet: a key
computed at run time, `a[i]`, and every other expression, `a[-1]` and
`a[NaN]` included — their keys are written as strings instead, `a["-1"]` and
`a["NaN"]`. Trivia, a line break included, may stand on either side of the
`.` or the `[` and inside the brackets, as between any two tokens
([trivia](#whitespace-and-line-terminators)): `a . b`, `a./* c */b` and `a`
with `.b` on the next line are each `a.b`, as JavaScript reads them.

FunctionalScript has no prototype chains, so a name a built-in prototype
gives a value — `push`, `toString`, `valueOf`, `constructor`, `__proto__`
and the rest, listed in [`fjs/js/prototype`](../fjs/js/prototype/module.f.mjs)
— is a **compilation error** as the key of an access, in either spelling,
`o.toString` or `o["toString"]` (`prohibited property name`): JavaScript
would find a function there and this language nothing, and a module must
mean one thing in both. The rule refuses reading such a name, not owning it:
an object literal may hold one, `{ toString: 1 }`
([property keys](#property-keys)). `length` is the exception, since an
array, a string and a function own it. The rules are
[property-accessor](./todo/2330-property-accessor.md)'s.

A method call has a rule of its own. `a.push(1)`, `a.valueOf()` and the
other member functions
[`fjs/js/prototype`](../fjs/js/prototype/module.f.mjs)'s `prohibitedCalls`
names are compilation errors (`prohibited member function`) — one row per
name, with the reason, in [its README](../fjs/js/prototype/README.md). Every
other prototype name but `length` is on its `allowedCalls`, and a call of one
— `a.toString()`, `[1, 2].at(0)`, `a.map(f)` — calls the receiver type's
built-in, as in JavaScript, an own property of the name shadowing the
built-in and a type without one throwing as JavaScript does. The read stays
refused where the call is allowed, since a detached built-in is a function
that only fails. `length` is on neither list: `a.length(1)` calls whatever
`a` owns there, as JavaScript does, so a function an object holds under
`length` is called, and anything else — an array's, a string's or a
function's `length` is a number — throws the `TypeError` JavaScript throws.

Today the Rust VM, which runs a `.rs` output, has only two of those
built-ins: `toString`, on every type, and an array's `at`. A call that
reaches any other, a string's `at` included, throws there as a call of
`undefined` does, where JavaScript answers — a failure, which is
[one outcome](#failure-is-one-outcome), not a different value — until its
entry in [member-functions](../nanvm-lib/todo/member-functions.md) lands.
Its `toString` applies no radix yet, so on a number or a `bigint` any radix
but `10` throws — `(255).toString(16)` fails there rather than answer `"255"`
([member-functions](../nanvm-lib/todo/member-functions.md)). Nor does it give
a function the text the
[function-source exception](#function-source-representation-exception)
adopts, a defect
[default function text](./todo/3120-parameters.md#default-function-text-render-or-refuse)
tracks.

## Importing Other Modules

```js
import a from "./a.f.js";
import { add, subtract as sub, } from "./math.f.js";
import { default as config } from "./config.f.js";
import d, { value as v } from "./mixed.f.js";
import {} from "./checked.f.js";
```

An `import` statement selects exports from another module's complete export
object. The exported name selects the property; an alias changes only its local
binding. Named-only modules need no default export.

The completed [named-import proposal](./named-imports.md) records the design
scope and language-designer authorization.

- The selected export must exist, even when its binding is unused. A present
  export whose value is `undefined` is valid; an absent export is an error.
- A selection reads an own property of the export object, so a built-in
  prototype's name selects an export like any other:
  `import { __proto__ as p, constructor as c } from "./dep.f.js";` binds the
  dependency's own exports of those names, and one it does not export —
  `toString`, `hasOwnProperty` — is an absent export, not a built-in.
  [Property access](#property-access) refuses these names as keys; a
  selection is not an access. The FunctionalScript output refuses such an
  importer today (`a prohibited property name`), since it writes the selection
  as an access; the other outputs accept it.
- Named lists admit aliases, trailing commas, `default as name`, and an empty
  list. A default binding may precede a named list.
- An empty list still loads and evaluates the dependency. Unused imports and
  unselected export initializers retain their required evaluation and failures.
- Namespace imports ([namespace-import](./todo/2220-namespace-import.md)),
  string-literal export names, bare side-effect imports, and re-exports remain
  unsupported.
- The module specifier is a [string literal](#strings), resolved using the
  declared host environment's module-resolution rules. Relative specifiers
  resolve against the importing module's identity; bare specifiers follow the
  host's package or import-map rules. Unsupported specifier classes are
  refused, not reinterpreted as sibling filesystem paths.
- Within one program load, imports resolving to the same module identity
  share its evaluation and exported value. Distinct module identities remain
  distinct even when they load the same file; loading paths are not cache
  keys. A circular dependency is an error.
- Local bindings are names under the [rule](#shared-values-constants) a
  `const` follows — `import { a as let }` and `import eval from "./e.f.js"`
  are errors, `import from from "./f.f.js"` is not — and cannot duplicate
  another import or module constant, both being names of the one module
  function ([a module is a function](#a-module-is-a-function)). Exported names are identifier names;
  reserved words such as `default` require a valid local alias.
- Every `import` comes before every `const`
  ([module structure](#module-structure)).

**Current supported host profile:** the Node runner resolves admitted file imports
against the importing file URL, canonicalizes symlinks, and reuses modules by the
resulting file URL identity. Imports use portable URL-path spellings beginning
with `./`, `../`, or `/`. Absolute `file:` imports and query/fragment components
are outside the supported grammar, as are bare packages and other URL schemes.
Encoded filename characters such as `%23` still work. This is the default Node
file-module profile; preserve-symlinks modes are not supported profiles.

The profile does not yet cover a module's format, only its resolution and
identity. An import without the attribute is read by the module parser
whatever the file it resolves to is called — `.f.js`, `.js`, `.mjs`,
`.data.js`, `.ts`, `.cjs`, `.txt` or no extension alike — as a root input is
([file types](#file-types)); only a `.json` file is refused without it
(below). Node takes the format from the extension instead: it refuses `.txt`
and loads `.cjs` as CommonJS, where `export` is a syntax error, so a module
importing either compiles although Node would not load it. The existing
[module-resolution TODO](../fjs/fsc/todo/module-resolution-compatibility.md)
records the host boundary, tests, and remaining support work.

A JSON document has only a `default` export. Both a default binding and
`{ default as name }` may select it; its object keys are not named exports.
The import requires the attribute JavaScript specifies and denotes the value
`JSON.parse` gives it:

```js
import a from "./a.json" with { type: "json" };
```

- The attribute is `with { type: "json" }`, spelled as JavaScript spells it:
  the key `type`, an identifier name, and the string `"json"`, in braces after
  the path. Any other key or value is an error, as it is in JavaScript. The
  value is a [string](#strings) like any other, so `type: 'json'` is the same
  attribute. JavaScript also accepts the key written as a string,
  `with { "type": "json" }`, a trailing comma after the pair, and `with {}`
  on an import that is not JSON; none of these is recognized yet. `"json"` is
  the one type ECMAScript defines; `"text"` and `"bytes"` are proposals,
  blocked on their standardization
  ([import-text-bytes](../todo/blocked/import-text-bytes.md)).
- The attribute declares the file's language and never reinterprets the file,
  so it must agree with the extension: a `.json` file imported without it, and
  any other file imported with it, are errors — JavaScript refuses both, so
  that data a program did not declare cannot stand where it expects a module.
  The extension is that of the file the import resolves to, not the
  specifier's: under the Node profile a symlink's target decides, as it does
  in Node, so `"./alias.f.js"` linking to `data.json` needs the attribute,
  and `"./mod.json"` linking to `m.f.js` must not carry it.
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

- A name is an [identifier](#identifiers), and one rule says which
  identifiers a binding may take — a `const`, a body `const`, a parameter,
  fixed or rest, and an import's local name alike. A word JavaScript reserves
  in a module is refused: `const if = 1;`, `const export = 1;`,
  `const let = 1;` and `const await = 1;` are errors here as they are there.
  So are `eval` and `arguments`, which strict code may not bind —
  `const eval = 1;` and `(arguments) => 1` are errors in both languages —
  since any broken JavaScript program is a broken FunctionalScript program.
  `undefined`, `NaN` and `Infinity` are refused as well, although a
  JavaScript module may bind them, so that each denotes its value wherever a
  value stands ([numbers](#numbers)). A word that is a keyword only in some
  position — `async`, `of`, `get`, `set`, `from`, `as` — is an ordinary name,
  as in JavaScript, and so are `type` and `then`:
  `(from, then) => [from, then]` is a function, and `then` is refused only as
  an export's name ([exporting a value](#exporting-a-value)). A key or a
  property name is not a binding, and this rule does not reach it:
  `{ if: 1 }` and `a.default` are a key and an access, as in JavaScript.
- A name must be declared before it is used. Forward references are not
  recognized yet ([forward-references](./todo/3140-forward-references.md)).
- Imported and constant names share one namespace, the module function's
  ([a module is a function](#a-module-is-a-function)): declaring the same
  name twice is an error.
- Every `const` is evaluated as its own statement, whether or not anything
  reads it — a module's when the module loads, a function body's at every
  call ([functions](#functions)) — so its failure is the module's or the
  call's, as in JavaScript: `const c = null.x; export default 1;` throws at
  load. The [failure contract](#failure-is-one-outcome) says what an
  implementation may reorder around it. The FunctionalScript and EDAG outputs
  keep what such a `const` computes, and the value outputs, which write only
  the value, still evaluate it and refuse the module when it fails
  ([output](#output)).
- Every ordinary or exported `const` comes after every `import` and before
  `export default`, when present
  ([module structure](#module-structure)).
- `let` and `var` are not part of the language ([let](./todo/3220-let.md)).

Sharing is a property of the *value*, not of the name, so what the compiler
preserves is what the graph actually shares. A DataJS document writes it in
[normalized form](./datajs/README.md#normalized-form):

- a `const` referenced once is inlined into its single use;
- an object or an array referenced more than once is emitted as a `const`,
  whether the source named it or not;
- a primitive is written inline wherever it is read, however many times,
  even when a `const` or an import names it:
  `const s = "str"; export default [s, s];` writes the string twice in every
  output, JSON included, since a primitive has no identity for a second
  reference to share;
- objects and arrays are shared by identity, so two separately written objects
  with equal contents stay two objects.

```js
const a = { "x": 1 };
const b = [a, a];
export default [b, b, a];
```

is written, as DataJS and as FunctionalScript, as

```js
const $0={"x":1};const $1=[$0,$0];export default [$1,$1,$0];
```

and JSON, a tree, refuses it (`no JSON spelling for a shared node`). A
function has identity as an object does ([functions](#functions)), so a
FunctionalScript document shares one the same way:
`const f = () => 1; export default [f, f];` is written
`const $0=(...$a)=>1;export default [$0,$0];`. Not every FunctionalScript
document is in normalized form: a module with a named export, among others,
gives what it computes more names than normalized form does
([output](#output)).

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

A function is an arrow with zero or more fixed named parameters and an
optional final rest parameter. Its body is an expression or a block:

```js
export default (a, b, c, ...x) => [a, b, c, x];
```

Bare `a => a`, `(a) => a`, and a fixed list with a trailing comma are also
accepted. No parameter or comma may follow rest. Defaults and destructuring
are not supported yet. A newline before `=>` is refused.

- Fixed names bind positional arguments; missing arguments are `undefined`.
  Extra arguments are permitted. The rest parameter is the array of arguments
  after the fixed prefix. Each invocation has its own rest array, and repeated
  reads within it return the same array. Parameters may shadow outer names,
  but must be distinct and cannot collide with body declarations. Each one,
  fixed or rest, is a name by the
  [binding rule](#shared-values-constants): `(eval) => 1` and
  `(...let) => 1` are refused, while `(from, then) => [from, then]` is a
  function.
- `f.length` is the number of fixed parameters, including unused ones. Rest
  adds zero. A function has **at most 16** fixed parameters: a 17th is a
  compile error, and an EDAG function whose `length` is above 16 is refused by
  every writer. Wider data reads better as an array or an object, and a rest
  parameter still takes any number of arguments. The JavaScript evaluators
  materialize every valid length through
  [hand-written arrow factories](../fjs/types/function/length/README.md).
- A name the body reads from a scope around it — a `const`, an import, an
  enclosing function's parameter or an enclosing body's `const` — is a
  **capture**, as a JavaScript closure's is. The function's frame is the
  array of the captured values, each value once however many bindings or
  references reach it, in the order the body first names them, built where the
  function is written; the body reads a capture as a slot of it, and a
  nested function captures through its parent. Nothing mutates, so a frame
  copied when the function is made is unobservable from a closure over the
  scope ([function-frame](./todo/3111-function-frame.md)). A captured
  primitive is written into the body instead, as a `const` holding one is
  wherever it is read, since it has nothing to share.

  Captures are JavaScript's closures, not a feature of this language's
  own: a capture was an error only while a function had no frame to
  capture with, a restriction whose reason is gone
  ([DESIGN.md §12](../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
  The frame is the one [function-frame](./todo/3111-function-frame.md) and
  the EDAG's closed-scope model
  ([`["frame"]`](../todo/edag-stage1-discussion.md)) describe.

  ```js
  const base = [10];
  const add = (...a) => (...b) => a[0] + b[0];
  export default [add(1)(2), ((...a) => base[0] + a[0])(5)];
  ```

  A function that names itself is not supported yet — in
  `const f = (n) => f(n);` the inner `f` is refused, `const not found` —
  since its `const` is not bound in its own initializer, and a function has
  no `self` to read in its place
  ([forward-references](./todo/3140-forward-references.md)). Recursion
  itself needs neither: a function is a value, so one passed to itself
  recurs as in JavaScript, and so does one reached through a fixed-point
  combinator. `const fact = (self, n) => n === 0 ? 1 : n * self(self, n - 1);`
  followed by `export default fact(fact, 5);` exports `120`, and like every
  call it compiles today to the EDAG and Rust outputs alone (below).
- An **empty parameter list** binds no name at all, so a body written under
  one cannot reach its arguments: the arguments array is named by the
  parameter and by nothing else, and a word the list does not spell is
  unbound here exactly as any other unbound word is. Nothing else
  distinguishes the two lists. `() => 1` and `(...args) => 1` denote the one
  function, the one node `['=>', 0, null, 1]` — though each arrow written is
  a function of its own (below) — and a body `const` may take the name a
  parameter would have taken, there being no parameter to collide with.
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
- A function **carries no name**. Its EDAG is `['=>', length, frame, body]`,
  name-erased, so the function in `{ make: () => 0 }.make`, in
  `const hello = () => 0` and in `export default () => 0` is the same node,
  `['=>', 0, null, 0]`, whatever JavaScript would name it (`make`, `hello`,
  `default`), and no program observes the difference: `f.name` is
  refused at the key of `.`, and `entry(f, 'name')` is `undefined`, since
  `name` is not an enumerable own property
  ([`fjs/edag/todo/entry.md`](../fjs/edag/todo/entry.md)), which is the
  decision that retired the proposals that would have exposed a name. The
  name a JavaScript engine gives a function it loads from the written
  output is the writer's spelling, not a result of the program
  ([principles](#principles)).
  Empty and rest-only parameter lists both have `length === 0`.
- A function has **identity**, as an object does, and it is JavaScript's:
  evaluating an arrow makes a new function — once for one written at module
  level, once per call for one written in a body — and a `const` holding one
  is that one function however many references reach it. Under
  `const f = () => 1;`, `f === f` is `true`; under
  `const g = (y) => () => y;`, `g(1) === g(1)` is `false`; and
  `(() => 1) === (() => 1)` is `false`, as two separately written objects are
  two ([shared values](#shared-values-constants)). Denoting the same function
  is sameness of meaning, not of identity.
- A body `const` is the body's, and binds as a module's does, a module
  being a function too ([a module is a function](#a-module-is-a-function)):
  it names a value the `return` and the statements after it may use, it may
  not be written twice, and it is not in its own initializer's scope. It is
  evaluated as a module's is, as its own statement, at every call and whether
  or not the `return` reaches it ([shared values](#shared-values-constants)):
  `() => { const x = null.x; return 1; }` loads and throws when called, as in
  JavaScript. The parameter is a name of the body too, so a `const` may not
  take it. A body `const`
  *may* take a name a scope around it binds, shadowing it as in
  JavaScript ([no-shadowing](./todo/3150-shadowing.md)) — unless the body
  has already read that name from outside, before the `const` or in its own
  initializer. That is not supported yet and is refused (`capture
  shadowed`) rather than compiled to another value: JavaScript resolves
  every reference in the body to the body's `const`, a read before its
  declaration throwing and a function written earlier reading it once
  called, where this compiler would read the capture. It is no restriction
  of the language — nothing leaks through it — but a forward reference
  inside a body, which
  [`body-const-forward-reference.md`](../fjs/fsc/parser/todo/body-const-forward-reference.md)
  tracks.

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

  A method call's property is the access's, but its key is judged by the
  call rule and not the read rule ([property access](#property-access)): a
  member function on `fjs/js/prototype`'s `prohibitedCalls` is a compilation
  error, every other prototype name but `length` is a call the VM answers by
  the receiver's type, and the read of either stays refused. No executor yet
  answers a function's `toString` with the text the
  [exception](#function-source-representation-exception) adopts, and
  nanvm-lib has only some of these built-ins
  ([default function text](./todo/3120-parameters.md#default-function-text-render-or-refuse),
  [member-functions](../nanvm-lib/todo/member-functions.md)).

  Two outputs hold a call today, the EDAG and the generated Rust module,
  which nanvm-lib runs, and the other three refuse one for two different
  reasons. `.data.js` and `.json` are values, and what a call
  *returns* is not a value the compiler computes — applying a function is the
  interpreter's work
  ([`fjs/fsc/todo/interpret-edag.md`](../fjs/fsc/todo/interpret-edag.md)) — so
  a module reaching a call has no value output (`a call has no value`), as
  one holding a function has none. The `.js` output is not a value and has
  no such excuse: the writer simply has no spelling for either call form yet,
  and refuses by the name of the node it meets, `a () node` and
  `a chain step`. Spelling them is the writer's own step, and until it lands
  a module with a call in it compiles to `.edag.data.js` and `.rs` alone.
- A function is written by the graph outputs, the FunctionalScript, EDAG
  and Rust ones ([output](#output)), and by the FunctionalScript one only
  while its body holds nothing that writer cannot spell yet: an operator in
  it other than unary `-` is refused by the name of its node, `a + node` or
  `a ?: node`, as a call is ([operators](#operators)). `fjs compile` refuses
  to write a module holding one as DataJS or as JSON
  (`a function has no value`), since a value has no function in it and the
  evaluator computing one has no function value to compute with
  ([`interpret-edag.md`](../fjs/fsc/todo/interpret-edag.md)). That evaluator
  runs the whole program, so a function anywhere in it keeps a module out of
  both value outputs, even one the `default` export never reaches:
  `const f = (a, b) => 1;` followed by `export default [f.length];` is
  refused, although its value is `[2]` ([output](#output)).

## Module Structure

A module is a sequence of statements, each terminated by a semicolon — the
last one included: `export default 5;`. The `;` lets several statements share
a line, and whitespace may precede it, newlines included: a line break before
the `;` is insignificant, exactly as it is in DataJS and JavaScript. A
newline does not terminate a statement — `export default 5` at the end of a
file is an error at the end of the file, and `const a = 1` followed by
`export default a;` on the next line is an error at `export`. One terminator
per statement: `;;` is an error, not an empty statement. Nor does a newline
end an expression: a line break between two tokens reads as a space does, as
in JavaScript, except at the two boundaries of this language where
JavaScript forbids one, before `=>` and after `return`
([line terminators](#whitespace-and-line-terminators)).

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
|named imports|`import { name, other as local, } from "./path";`|
|combined imports|`import value, { name } from "./path";`|
|JSON import|`import name from "./path.json" with { type: "json" };`|
|constant|`const name = expression;`|
|named export|`export const name = expression;`|
|default export|`export default expression;`|

```js
import base from "./base.f.js";    // imports first

const extra = { "debug": true };   // then constants

export default [base, extra];      // optional, at most one, last
```

These statement forms are the whole language. A statement begins with `import`,
`const`, or `export`, and never with a value; more forms land as the language
grows ([`spec/todo/`](./todo/README.md)).

### A Module Is a Function

A module is one function, and the compiler reads it that way. Its imports are
its parameters, in source order; its constants are the constants of its body;
and what it returns is the object of its exports
([exporting a value](#exporting-a-value)), `export default` being that
object's `default` member. So a module's imports and constants are one scope,
as a function's parameters and body constants are: one namespace, each name
bound once, and a name used only after it is declared.

The EDAG says so directly. Before linking, a module's graph reads import `i`
from its arguments: the module slot is `['.', ['args'], i]`, and a binding
selects its export from that slot, `['.', ['.', ['args'], i], name]`, where
`name` is `default` for a default import. Only an empty import list, which
binds no name, is the bare slot. Linking replaces each import with the export
it selects from the module that import resolves to — applying the module to
its imports — so the linked program has no parameter left
([`fjs/fsc/edag`](../fjs/fsc/edag/module.f.mjs)). Two imports of one module
identity are one application, shared, as
[importing](#importing-other-modules) requires.

## Roadmap

Everything else — unimplemented language features, ECMAScript proposals, I/O
effects, the content-addressable VM, object identity, mutability, and
serialization — is in [`spec/todo/`](./todo/README.md). A feature's document
moves into this one when the parser recognizes it.

For the implementation, see [`fjs/fsc/README.md`](../fjs/fsc/README.md), the
compiler.
