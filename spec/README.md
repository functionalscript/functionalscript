# FunctionalScript Language

This is the specification of the language that the compiler accepts **today**.
A FunctionalScript module is exactly a module that

```sh
fjs compile <input> <output>
```

compiles to a supported output. Source admission, program evaluation and output
serialization are separate steps: the parser may accept a program whose
evaluation fails, or whose result a particular output cannot represent.

Features the parser does not recognize yet — among them the remaining unary
operator (`+`), the comma operator and type annotations in comments — and the
design documents for the VM, I/O, serialization, and the rest of the roadmap
live in [`spec/todo/`](./todo/README.md). Loose equality (`== !=`) is not
waiting: it stays refused ([operators](#operators)).

The compiler accepts values ([supported value types](#supported-value-types)),
the [constants](#shared-values-constants) and
[imports](#importing-other-modules) that share them,
[property access](#property-access), [operators](#operators), the
[`Number` conversion](#number-conversion),
[`String` conversion](#string-conversion),
[template literals](#template-literals), and
[functions](#functions) with their calls, and this document specifies all of
them. The outputs differ in what they can write, so one module may compile to
one output and be refused by another ([output](#output)).

[`spec/datajs/`](./datajs/README.md) specifies **DataJS**, a much narrower
interchange format this language contains: JSON with two extensions —
values may be shared, so a document denotes a DAG rather than a tree, and the
leaf set gains `undefined`, `bigint`, `NaN` and the infinities — and with a
`;` **required** after every statement, `export default` included (where a
module here may omit one JavaScript inserts), no `import`, no comments, no
identifier keys and no trailing commas. The language this document describes is wider, and holds
functions besides. The compiler bridges the two: to a `.data.js` output,
`fjs compile` evaluates the module and writes its default export through
DataJS's own writer. Functions, calls and operators may compute that data;
a function remaining in the selected result cannot be written as DataJS
or JSON ([output](#output)).

## Contents

- [Principles](#principles)
- [Lexical grammar](./lexical/README.md) and [comments](./lexical/comments.md)
- [Module structure](#module-structure), [exports](#exporting-a-value),
  [imports](#importing-other-modules), [constants](#shared-values-constants)
  and [destructuring](#destructuring)
- [Values and literals](#supported-value-types), including
  [template literals](#template-literals)
- [Grouping](#grouping), [operators](#operators),
  [number conversion](#number-conversion) and [string conversion](#string-conversion)
- [Property access](#property-access), [built-in static functions](#built-in-static-functions),
  [optional chaining](#optional-chaining) and [computed entries](#reading-an-entry-at-run-time)
- [Functions](#functions)
- [Command line](#command-line), [file types](#file-types) and [output](#output)
- [Roadmap](#roadmap)

## Implemented Features

| Area | Supported today |
| --- | --- |
| Modules | Default, named and combined imports; JSON import attributes; local and exported `const`; named and default exports; terminal `throw` |
| Literals | JSON values, `undefined`, `NaN`, infinities and arbitrary-width bigints; decimal, hexadecimal and binary integers; numeric separators; single- and double-quoted strings; untagged template literals |
| Containers | Dense arrays, object literals, shorthand members, constant and computed keys, trailing commas, array/call spread and object spread |
| Expressions | Grouping; arithmetic, strict comparison, bitwise and lazy operators; `?:`, `!`, `typeof`, `instanceof Array`, `Number(...)` and `String(...)` |
| Properties | Own-property reads, numeric computed keys through `Number(...)`, optional reads/calls and the enumerable `entry` helper |
| Functions | Arrow functions, 0–16 fixed parameters, optional rest, closures, self recursion, body constants, terminating `if` guards, `let`/`while` loops over one variable, `return`, `throw`, ordinary and method calls |
| Built-ins | Pure array, string and numeric member functions, including callbacks and function text ([member functions](#built-in-member-functions)); `Object.is` and the `Number` predicates `isInteger`, `isSafeInteger`, `isNaN`, `isFinite` ([static functions](#built-in-static-functions)) |
| Compiler | JSON/DataJS evaluation; FunctionalScript, EDAG and Rust graph output; import linking and the authored `.f.js` check |

The sections below give the restrictions and executor-specific limits for
each feature. This overview records compiler support; optional chaining's
required [language-design approval record](./todo/2335-optional-chaining.md#authorization-and-approval)
remains open. TypeScript-only syntax, mutation beyond a loop's variable,
loops beyond the one `let`/`while` form ([loops](#loops)), classes, numeric
key literals and general forward references remain outside the implemented
language.

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
function's `name` or its text after the compiler has serialized a module — is the
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
more convenient meaning. The valid JavaScript the compiler refuses is
catalogued in [refused constructs](./todo/refused-constructs.md), each marked
as refused by design, planned or undecided.

### Function-source representation exception

**Adopted:** in FunctionalScript VM execution, the default string representation
of a function is source reconstructed from its associated EDAG, not the original
source text. Original comments, formatting and identifier spellings need not
survive. This applies to `String(f)` and every admitted indirect conversion
that reaches the same default function representation, including conversions
inside complete instruction patterns. It applies to exported functions too.

Running source directly on a JavaScript engine retains that host's function
representation. Its text can differ from the FunctionalScript VM's, including
when a JavaScript consumer reflects on an exported function. The
ordinary runtime callables produced by runtime compilation are the same case:
they expose their host's function text after EDAG reflection has been erased.
The Memo and Amnesia EDAG interpreters, including compiler module
initialization, retain represented functions and use the shared EDAG-derived
renderer ([`fjs/edag/function-text.md`](../fjs/edag/function-text.md)). Differences
caused by using that text as a key, comparing it or branching on it are
consequences of this exception, not a blanket waiver for unrelated results.
Non-function conversion, other admitted function observations and source
syntax retain their existing contracts. The exception alone admits no new
syntax or API.

Function text renders code with captured values represented by slot names;
it does not serialize those values or instantiate their frames. Instances
of the same function template have the same text even when their captures differ.
A body reading `self` is rendered as a named function expression — unless
the function is a loop, `r => c ? self(next) : r`, which is rendered as the
loop it is, `let` and `while` over a `let` of its parameter ([loops](#loops),
[function text](../fjs/edag/function-text.md)). This text
need not be accepted by the FunctionalScript source parser: the total text
renderer and the structural source serializer have separate contracts
([function text](../fjs/edag/function-text.md)). The Rust VM also answers
`String(f)`, `f.toString()`, `'' + f` and `[f].toString()` with the compiled
function's EDAG-derived text, and refuses a native function without associated text.
[Function text and serialization](./todo/serialization.md#function-text-and-serialization)
tracks the broader serialization design.

### Failure is one outcome

All execution failures are one indistinguishable semantic outcome:

```text
throw A ≡ throw B ≡ memory failure ≡ time failure
```

`throw value;` is the statement that reaches this outcome on purpose
([functions](#functions)); an operation that fails, `null.x` or `1n / 0n`,
reaches it by accident, and the two are not distinguished.
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

## Lexical Grammar

The characters between tokens, comments, the spelling of a word and of a string
are specified in [lexical grammar](./lexical/README.md): [whitespace and line
terminators](./lexical/whitespace.md), [comments](./lexical/comments.md),
[identifiers](./lexical/identifiers.md) and [string escapes](./lexical/string-escapes.md).

## Module Structure

A module is a sequence of statements, each terminated by a semicolon —
`export default 5;` — or by nothing, where JavaScript's automatic semicolon
insertion supplies one: at the end of the input, before a `}`, and before a
statement that begins on a new line. `export default 5` at the end of a file
is that module, and so is `const a = 1` followed by `export default a` on the
next line. A newline is what ends such a statement, so two statements on one
line need the `;` between them: `const a = 1 export default a;` is a syntax
error in JavaScript and an error here, at `export`, exactly as it was when
the `;` was required. A comment counts by the line it ends on: a line comment
ends at a newline, and a block comment that holds one breaks the line as
JavaScript's `LineTerminator` rule has it, while one that holds none does
not. The `;` lets several statements share a line, and whitespace may precede
it, newlines included: a line break before the `;` is insignificant, exactly
as it is in DataJS and JavaScript. One terminator per statement: `;;` is an
error, not an empty statement. Nor does a newline end an expression: a line
break between two tokens reads as a space does, as in JavaScript, so `f`
followed by `(7)` on the next line is the call `f(7)`, and `[1]` followed by
`[0]` is an index — a `;` is inserted only where the parser cannot continue
the statement, never at a newline as such — except at the two boundaries of
this language where JavaScript forbids one, before `=>` and after `return`
or `throw` ([line terminators](./lexical/whitespace.md)).

[DataJS](./datajs/README.md) *requires* the `;` after every statement, and
every DataJS document must be a valid FunctionalScript module —
`const $0=[1];export default [$0,$0];` is normalized DataJS, one line, and it
parses here. JavaScript accepts the same module with the same meaning, so the
subset law holds; what FunctionalScript refuses from JavaScript is the empty
statement. The `;` is the rule of the compiler-formatted `.f.js` output
language: the compiler writes the `;` after every statement it emits. The
grammar admits the omission by making the `;` optional and looking no
further, which one symbol of lookahead still decides, since `;` begins no
statement and no statement's continuation; whether the token after an
omitted `;` begins a line is a fact the token carries, and the reader checks
it there ([`fjs/compiler/parser`](../fjs/compiler/parser/README.md)). Trivia
between tokens — whitespace
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
|throw|`throw expression;`|

```js
import base from "./base.f.js";    // imports first

const extra = { "debug": true };   // then constants

export default [base, extra];      // optional, at most one, last
```

These are the module-level statement forms. A statement begins with `import`,
`const`, `export`, or `throw`, and never with a value; more forms land as the
language grows ([`spec/todo/`](./todo/README.md)).

JavaScript accepts `throw` at the top level of a module, and
[a module is a function](#a-module-is-a-function), so a block's rule
([functions](#functions)) is the module's: after its imports and every
`const`, exported or not, `throw expression;` may stand where
`export default` would, in place of it and not beside it, and nothing
follows it. Such a module fails at every load and exports nothing: a module
that imports it fails to load too, as one importing a module that reads
`null.x` at load does, and a name imported from it is refused at link as
an export the module does not have. The graph outputs write it, as they
write a module holding `const c = null.x;`, since they evaluate none of it,
and the value outputs, which evaluate, refuse it as they refuse that module
([output](#output)).

### A Module Is a Function

A module is one function, and the compiler reads it that way. Its imports are
its parameters, in source order; its constants are the constants of its body;
and what it returns is the object of its exports
([exporting a value](#exporting-a-value)), `export default` being that
object's `default` member — or, where the module ends in `throw`, it
returns nothing and fails, as a function whose body ends in `throw` does. So a module's imports and constants are one scope,
as a function's parameters and body constants are: one namespace, each name
bound once, and a name used only after it is declared.

The EDAG says so directly. Before linking, a module's graph reads import `i`
from its arguments: the module slot is `['.', ['args'], i]`, and a binding
selects its export from that slot, `['.', ['.', ['args'], i], name]`, where
`name` is `default` for a default import. Only an empty import list, which
binds no name, is the bare slot. Linking replaces each import with the export
it selects from the module that import resolves to — applying the module to
its imports — so the linked program has no parameter left
([`fjs/compiler/edag`](../fjs/compiler/edag/module.f.mjs)). Two imports of one module
identity are one application, shared, as
[importing](#importing-other-modules) requires.

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

Unless a module ends in `throw`, at least one export is required
(`module exports nothing`): a `const` of a name exports it, and an exported
pattern exports each name it binds ([destructuring](#destructuring)), so a
module whose only exports bind no name is refused at its last `export`.
A named-only module needs no default:
`export const a = 5;` returns `{ a: 5 }`. When present, `export default` is
**last**; only [trivia](./lexical/whitespace.md) — whitespace,
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
[module-resolution TODO](../fjs/compiler/todo/module-resolution-compatibility.md)
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

- A name is an [identifier](./lexical/identifiers.md), and one rule says which
  identifiers a binding may take — a `const`, a body `const`, a parameter,
  fixed or rest, and an import's local name alike. A word JavaScript reserves
  in a module is refused: `const if = 1;`, `const export = 1;`,
  `const let = 1;` and `const await = 1;` are errors here as they are there.
  So are `eval` and `arguments`, which strict code may not bind —
  `const eval = 1;` and `(arguments) => 1` are errors in both languages —
  since any broken JavaScript program is a broken FunctionalScript program.
  `undefined`, `NaN` and `Infinity` are refused as well, although a
  JavaScript module may bind them, so that each denotes its value wherever a
  value stands ([numbers](#numbers)). `Array`, `Number`, `Object` and `String`
  are also reserved under [global names](./todo/2365-global-names.md), with no
  standalone values: `Array` stands in [instance checks](#instanceof), `Number`
  and `String` stand as [number](#number-conversion) and
  [string](#string-conversion) conversions, and `Object` and `Number` as the
  namespaces of the [static functions](#built-in-static-functions). A word
  that is a keyword only in some
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
- `let` is part of the language only as the first statement of a loop,
  `let x = init;` followed by `while` ([loops](#loops)), and `var` not at
  all ([let](./todo/3220-let.md)).

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

and as JSON, a tree, with the node written where each reference reaches it,
`[[{"x":1},{"x":1}],[{"x":1},{"x":1}],{"x":1}]`. A
function has identity as an object does ([functions](#functions)), so a
FunctionalScript document shares one the same way:
`const f = () => 1; export default [f, f];` is written
`const $0=()=>1;export default [$0,$0];`. Not every FunctionalScript
document is in normalized form: a module with a named export, among others,
gives what it computes more names than normalized form does
([output](#output)).

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const>.

### Destructuring

```js
const { a, "%": [c, d], length } = { a: null, "%": [true, false] };
export const { x, y } = { x: 1, y: [2] };
const f = ([first, { second }], ...r) => [first, second, r];
export default [a, c, d, length, f];
```

A `const`, a module's or a body's, exported or not, and a fixed
[parameter](#parameters) may bind a **pattern** in place of a name: an
object pattern, `{ p, … }`, each property a shorthand name or a key and a
target, `a: t`, `"a": t`, `["a"]: t`, `[3]: t`; or an array pattern,
`[t, …]`, each item a target; a target a name or a pattern again, and a
trailing comma allowed as the literals allow one. Each name is a binding
by the rule above — reserved, refused twice, exported as `then`, or
shadowing a capture, it is refused as a name alone is — and it names the
part of the value its path reads, as in JavaScript. The initializer is
evaluated once, however many names read it.

A pattern is sugar over reads the language has, and that is its whole
semantics: the graph outputs write the reads, `const [c, d] = v;` as
`const $0=[...v];const c=$0[0];const d=$0[1];`, as a guard is written as
its conditional ([functions](#functions)).

- An object pattern's property is the [property access](#property-access)
  its key spells, with every rule of one: a `null` or `undefined` source
  throws, as JavaScript's `RequireObjectCoercible` throws; a primitive
  source binds what it owns — a string its code units by index, `const { [0]: first } = "ab";` binding `"a"`, and its `length`;
  a number, a boolean or a `bigint` nothing — and `undefined` for a
  property it does not own, as `GetV` reads through `ToObject`;
  `length` reads an array's, a string's or a function's; and a key a
  built-in prototype gives a value, `toString`, `constructor` or
  `__proto__`, is the compilation error the access is (`prohibited
  property name`), since JavaScript would read a function there and this
  language nothing.
- An array pattern is the [spread](#spread) of its source and reads of the
  array the spread made, which is JavaScript's own reading: array
  destructuring runs through `GetIterator` as a spread does, so a source
  that is not iterable throws the same `TypeError` — `const [a] = {};`
  fails here as it fails there — and a string yields its code points,
  `const [a] = '😀';` binding the two-unit string. The spread reads every
  element where JavaScript's destructuring stops at the last target; no
  program here can observe the difference, there being no generator, no
  side effect and no infinite iterable.
- Every read is established whether or not a name reads it, as every
  `const` is ([shared values](#shared-values-constants)):
  `const { a: { b } } = {};` throws at load, as it throws in JavaScript.
  Which of a pattern's reads fails first is no observation
  ([failure is one outcome](#failure-is-one-outcome)).
- An **empty pattern** binds nothing and keeps its failure, the check
  JavaScript gives a caller through it: `const [] = v;` is the spread of
  `v` alone and fails where `v` is not iterable, and `const {} = v;` reads
  one property of `v`, its `length`, which every kind of value may own,
  binding nothing — the read that fails where `v` is `null` or
  `undefined`, as `RequireObjectCoercible` fails, and whose value is no
  observation. The graph outputs write the two reads, `const $0=[...v];`
  and `const $0=v.length;`. An exported pattern exports each name it binds,
  so `export const {} = o;` exports nothing, and a module whose exports all
  bind no name is refused, as one with no export is
  ([exports](#exporting-a-value)): `module exports nothing`, at its last
  `export`.
- A pattern names no function as its whole value, so no name in it is a
  function's own ([captures and self recursion](#captures-and-self-recursion)):
  `const { f } = { f: () => f };` is `const not found`.
- An object pattern over a **namespace**, `Object` or `Number`, reads its
  members ([built-in static functions](#built-in-static-functions)), there
  being no value to read them from: `const { is } = Object;` is
  `const is = Object.is;`, one entry, `const { isInteger } = Number;` is
  `const isInteger = Number.isInteger;`, and `const {} = Object;` reads
  nothing, the namespace being never nullish. An array pattern over it,
  and a key it does not admit, are refused at the word (`reserved word`) —
  but a key that is a prototype name, `keys` or `toString`, is refused
  first, at the key, as in any pattern (`prohibited property name`).
- A **parameter pattern** is one fixed parameter, its source the argument
  in its position: `([a, { b }], c) => …` binds `a` and `b` from the first
  argument as `const [a, { b }] = arg;` would, its reads the first entries
  of the function's body, so `(([]) => 0)({})` and `(({}) => 0)(null)`
  fail as they fail in JavaScript, whether the body is a block or an
  expression. It counts as one toward `length` and toward the limit of 16,
  as JavaScript counts it: `(({ a, b }) => 0).length` is `1`. Its names
  are parameters by every rule of one — refused twice across the list,
  `({ a }, a) => 1`, and against a body declaration — and a nested
  function captures them as it captures any parameter. The rest parameter
  keeps a plain name: `(...[a]) => 1`, harmless JavaScript, is not read
  yet and stops at its `[`. The head of a list is read as a value, one
  symbol telling no list from a group before the `)`, so a head that is
  no name and no pattern is refused for the list (`malformed parameter
  list`, at its `(`) — `(1) => 2`, `(a.b) => 1`, `((a)) => 1` — where a
  value inside the head's pattern is refused where it stands, as in a
  `const`.

Refused, each by name, and open in
[destructuring](./todo/2450-destructuring.md): a **rest element**,
`[a, ...r]` or `{ a, ...r }` (`rest element not supported`); a
**default**, `{ a = 1 }` or `[a = 1]`, which is no literal and stops at
its `=`; and a **computed key**
beyond a constant — a string or a number literal alone in the brackets,
`{ ["a"]: t }` or `{ [3]: t }`, is the constant key an access admits in
brackets ([property access](#property-access)), read by the literal's
spelling as `"a": t` is, while `{ [k]: a }`, `{ [Number(i)]: a }` and a
grouped literal, `{ [(3)]: a }`, are refused (`computed key in a binding
pattern not supported`). A value in a binding position —
a literal, an access, a call, an operator, or a group, `[(a)]`, which
JavaScript admits in an assignment and refuses in a binding — is the error
JavaScript names (`invalid destructuring target`), at the token it begins
with. An elision, `[, b]`, is not read yet and stops at its second
comma, as it does in an array literal; it is a follow-up in the record,
not a rule.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment>.

## Supported Value Types

An expression is a data expression, a property access, a function, a call, an
operator ([operators](#operators)) — a prefix `-` (negation), `~` (bitwise
not), `!` (logical not) or `typeof`, a binary operator, `instanceof Array`
or the conditional `?:` — the conversions `Number(exp)`
([number conversion](#number-conversion)) and `String(exp)`
([string conversion](#string-conversion)), or any of those in parentheses
([grouping](#grouping)).

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
|function|`(x) => x + 1`|❌|
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
the value reaches along more than one reference is written where each
reference reaches it, as `JSON.stringify` writes it ([output](#output)).

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

A number may also be written in binary, as JavaScript writes it: `0b` or
`0B` followed by one or more `0` or `1` digits. `0b101010` is `42`;
conversion rounds to the nearest double, as for decimal and hexadecimal
literals. A binary literal has no fraction or exponent. Missing digits,
other digits or a word directly after the literal are errors. The `n`
suffix gives an exact bigint at any width: `0B101n` is `5n`. Outputs write
the value in decimal; unary negation also preserves `-0b0` as `-0`.
A single `_` may separate digits in decimal integer parts, fractions and
exponents, and in binary or hexadecimal digits: `1_000`, `1.2_5e1_0`,
`0b1010_0011`, `0xFF_FF`, and `1_000n`. Separators do not change the
value. Leading, trailing or repeated separators, separators next to a
radix prefix, decimal point, exponent marker or sign, or bigint suffix,
and separators after a leading decimal zero are errors.

A number may also be written in hexadecimal, as JavaScript writes it: `0x`
or `0X`, then one or more digits `0`–`9`, `a`–`f` or `A`–`F`. It denotes the
double nearest the integer its digits spell, as a decimal literal does, so
`0xFF` is `255` and `0x20000000000001` is `9007199254740992`. It has no
fraction and no exponent: after `0x`, `e` is a digit, so `0x10e1` is `4321`,
and a `.` after the digits is the next token, so `0x10.length` is an access,
as in JavaScript. `0x` with no digit, and a word or a digit standing directly
after the literal (`0xg`, `0x1g`), are errors in both languages. The spelling
is the source's and not the value's: every output writes `0xFF` exactly as
it writes `255` — `255` in the `.js`, DataJS, JSON and EDAG outputs, and
the double's bits in `.rs` — as it writes a single-quoted string between
double quotes, and two modules that differ only in it are one graph.

```js
export default [0xFF, 0XfF, 0x10e1];
```

Otherwise the syntax is JSON's, so the other JavaScript spellings JSON
leaves out are not recognized: no octal (`0o7`) prefix, no
leading `+`, no leading decimal point (`.5`), and no trailing decimal point
without a fractional digit (`1.`). The three numbers JSON cannot spell
are written as the words JavaScript gives them — `NaN`, `Infinity` and
`-Infinity` — exactly as [DataJS](./datajs/README.md) writes them:

```js
export default [NaN, Infinity, -Infinity];
```

`NaN` and `Infinity` are reserved words, like `undefined`: a module cannot
bind or shadow them, so each denotes its value wherever a value stands.
`Array` is reserved the same way, for a different reason: it denotes no
value here, and is the one word the right side of `instanceof` may be
([operators](#operators)), so a module that could bind it would mean
something else by it.

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
the first operator the language had; `~`, the **bitwise not operator**, `!`,
the **logical not operator**, and `typeof` are the other prefixes — `~`
Stage A of the same operators document, `!` and `typeof` the rows admitted
after both stages. None is part of the literal after it: `-42.5` is the
negation of `42.5`, `- 42.5` is the same value written with a space, and
`-NaN` and `-Infinity` are values as JavaScript has them. Each binds looser
than a property access or a call, as in JavaScript, so `-1 .x` is `-(1 .x)`
and `-1()` is `-(1())`. What any of them takes is JavaScript's
`UnaryExpression`, which an arrow function is not, so `-(...a) => 1`,
`~(...a) => 1`, `!(...a) => 1` and `typeof (...a) => 1` are syntax errors in
both, and none stands immediately before `**` — `-2 ** 2` is refused,
matching JavaScript, where `(-2) ** 2` and `-(2 ** 2)` are the parenthesized
readings — though
either may stand right after it, as in JavaScript: `2 ** -2` is `2 ** (-2)`
and `2 ** ~2` is `2 ** (~2)`. Two adjacent `-` characters are the decrement
operator, which the language has no rule for, so a negation of a negation is
spaced, `- -1`, or grouped, `-(-1)`. `~` and `!` have no such token, in
JavaScript or here, so `~~1` is two bitwise nots, the same as `~ ~1`, and
`!!1` two logical nots.
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

A `.json` or DataJS output computes a negation that survives lowering,
using JavaScript's coercion rules. For a primitive, a
`bigint` stays a `bigint`, and any other primitive converts to a number —
`-"2"` is `-2`, `-true` is `-1`, `-null` and `-""` are `-0`, and `-undefined`
and `-"abc"` are `NaN`, which a `.json` output then has no spelling for. A
negation of an array or an object first uses `ToPrimitive`: `-[5]` is `-5`
and `-{}` is `NaN`. Own `valueOf` or `toString` functions participate in that
conversion and can fail. JSON then refuses a result such as `NaN` that it
cannot represent; DataJS writes it. The EDAG and FunctionalScript outputs
keep an unfolded negation as code ([output](#output)).

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

A hexadecimal integer part, as a [number](#numbers) writes it, takes the
`n` too: `0x10n` is `16n` and `0XFFn` is `255n`, exact at any width, and
`-0x8000000000000000n` folds into the leaf `-9223372036854775808n`. An
output writes `0x10n` exactly as it writes `16n`, and one that refuses a
`bigint` refuses it whatever its spelling: `.json` refuses every one.

```js
export default [0x10n, 0XFFn, -0x8000000000000000n];
```

A binary integer part also takes `n`: `0b101n` and `0B101n` are `5n`.
Numeric separators may occur between digits in every admitted base,
`1_000n`, `0xFF_FFn` and `0b1010_0011n`, under the same separator rules as
[numbers](#numbers). Values remain exact at any width and outputs use decimal.

The syntax is those integer parts and the `n`, so the JavaScript spellings
it leaves out are not recognized: no octal prefix (`0o7n`). A fraction or
an exponent (`1.5n`, `1e3n`), a leading zero (`01n`) and an uppercase `N` are
errors in both languages. JSON has no spelling for a `bigint`, so a `.json`
output refuses one ([output](#output)).

### Strings

A string is JSON's, between double quotes or between single quotes:

```js
export default ["hello!", 'hello!'];
```

The escapes, the quotes and where a string may stand are specified in
[string escapes and quotes](./lexical/string-escapes.md).

### Template Literals

`sergey-shandar` approved the untagged-template design in
[#2822](https://github.com/functionalscript/functionalscript/pull/2822#issuecomment-6106236760),
as [DESIGN.md §12](../doc/DESIGN.md#new-language-features-start-with-a-todo) requires.

An untagged template is a backtick-delimited primary expression, with cooked
text chunks separated by `${expression}` substitutions:

```js
const name = "world";
export default `Hello, ${name}!`;
// "Hello, world!"
```

Each substitution uses the ordinary full expression grammar, including object
literals, function bodies and nested templates. A template can be an operand,
call argument or property-access base, as in `` `abc`.length ``. Empty templates
and adjacent substitutions are admitted too.

Text chunks accept JSON's escapes (`\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`,
`\t`, `\uXXXX`), escaped backticks and the escaped substitution opener `\${`.
Quotes stand raw. Only an unescaped `${` opens a substitution. Literal LF, CR
and CRLF are admitted; raw CR and CRLF cook to LF, while escaped `\r` or
`\u000D` stays CR. Raw U+2028 and U+2029 keep their values. Additional JavaScript
template escapes, other raw C0 controls and line continuations remain deferred
here and are refused. The quoted-string counterparts are tracked separately in
[js-string-literals](./todo/2460-js-string-literals.md), which excludes templates.
Malformed or unterminated templates and tagged templates such as `` tag`a${b}c` ``
are compilation errors.

The common escape set is uniform across single-quoted strings, double-quoted
strings and templates: changing the delimiter does not admit additional common
spellings such as `\0`, `\v`, `\xHH` or `\u{...}`. The template-specific
exceptions serve its syntax: escaped backticks and `${`, and literal line
terminators for multiline text. Any future widening of the common escape set
must be coordinated across quoted strings and templates.

| Refused template spelling | Admitted spelling with the same value |
| --- | --- |
| `` `\0${"key"}\0` `` | `` `\u0000${"key"}\u0000` `` |
| `` `\v` `` | `` `\u000b` `` |
| `` `\x41` `` | `` `A` `` or `` `\u0041` `` |
| `` `\u{1f600}` `` | `` `\ud83d\ude00` `` |

For a refused line continuation, join the lines without the continuation
sequence to preserve the value. Before marking a module compiler-compatible
with the `.f.js` extension, normalize any deferred spellings it uses. For
example, [`serializer/names`'s `_name`](../fjs/compiler/serializer/names/module.f.mjs)
uses `` `\0${key}\0` ``; its supported equivalent is
`` `\u0000${key}\u0000` ``. Template support alone does not admit every existing
template spelling.

Every substitution is converted with [String](#string-conversion), and its
result is concatenated with the cooked chunks using left-associated binary
`+`. For example, `` `hello ${a}!` `` has the same meaning and EDAG as
`"hello " + String(a) + "!"`:

```js
['+', ['+', 'hello ', ['String', A]], '!']
```

Here `A` is the lowered expression for `a`. For chunks `s0` through `sn` and
substitutions `e1` through `en`, lowering starts with `r = s0`. In source order,
each substitution adds `r = ['+', r, ['String', lower(ei)]]`, then
`r = ['+', r, si]`. Every chunk, including an empty one, is retained, and
conversion is never folded away. Thus `` `${1}${2}` `` expands to
`"" + String(1) + "" + String(2) + ""`, producing `"12"`.

The result of a successful template evaluation is always a string. Evaluation
or conversion failure propagates under [failure is one outcome](#failure-is-one-outcome):
the graph construction order does not impose evaluation-count or source-order
barriers on failing computations. Function conversion follows the existing
[function-source representation exception](#function-source-representation-exception).

Explicit string conversion matters for objects: `String` tries `toString`
before `valueOf`, whereas raw `+` coercion tries them in the opposite order.

```js
const a = { valueOf: () => 7, toString: () => "a" };
export default ["hello " + a + "!", `hello ${a}!`];
// ["hello 7!", "hello a!"]
```

Some further examples:

```js
``;                      // ""
`abc`;                   // "abc"
`${1n}:${undefined}`;    // "1:undefined"
`sum: ${1 + 2}`;         // "sum: 3"
`${{ x: 1 }.x}`;         // "1"
`${`${1}`}!`;            // "1!"
`literal \${a}`;         // "literal ${a}"
`\``;                    // "`"
`\u0000${"key"}\u0000`;  // "\u0000key\u0000"
`line
break`;                  // "line\nbreak"
```

A template without substitutions lowers directly to its cooked string leaf,
so `` `abc` `` and `"abc"` have the same EDAG. Every template is FJS source
syntax, including this case; cooking does not classify it as JSON or DataJS.
FunctionalScript output writes a string or the explicit `String`/`+` expansion
instead of reconstructing template spelling. EDAG and Rust outputs use those
existing operations, and JSON and DataJS outputs evaluate them.

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

#### Spread

An item may be a **spread**, `...` and any value, at any position and any
number of times:

```js
const a = [1, 2];
export default [[0, ...a, 3], [...a, ...a], [...'a😀']];
// [[0, 1, 2, 3], [1, 2, 1, 2], ['a', '😀']]
```

The operand is evaluated in its place among the items, left to right, and
then iterated, each value it yields becoming one item, as JavaScript's
`SpreadElement` does. An array yields its elements in index order, and a
string its code points, each a string of its own: `[...'😀']` is one item
of two code units. Every other value — `null`, `undefined`, a boolean, a
number, a `bigint`, an object, a function — is not iterable, and the spread
fails, as JavaScript's `GetIterator` throws its `TypeError` (`a spread of a
value that is not iterable`): a FunctionalScript object cannot define
`Symbol.iterator`, so no object is iterable here, and none is in JavaScript
either. A call's arguments take a spread the same way
([functions](#functions)).

The value outputs write the array the spread made, and the graph outputs
the spread itself: `.js` and `.f.js` write it back, `[0, ...a]`, the EDAG
keeps its `['...', exp]` item, and `.rs` prints it through `nanvm-lib`'s
`get_iterator`. A constant spread is not folded, so `[...[1, 2]]` is a
different graph from `[1, 2]`, as `1 + 1` is from `2`. A spread puts its
operand's elements in the array and not the operand, so it shares what an
element shares: `const a = [{}]; export default [[...a], a];` holds the
object once, a `const` in DataJS and written where each reference reaches
it in JSON ([Output](#output)), where `const a = [1]` in its place shares
nothing. An object literal takes a spread too, with a different reading
([objects](#objects)).

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

A member may be a name alone, the **shorthand** JavaScript reads as the name
twice, `{ a }` for `{ a: a }`: the name is the key, and a reference to the
name — a `const`, an import, a parameter — is the value, resolved and refused
as any reference is, so `{ b }` with nothing binding `b` is an error, as is
`{ typeof }` — and `{ NaN }`, since `NaN`, `Infinity` and `undefined` are
[reserved words](#numbers) that denote a value and name no binding. Only the
identifier spelling has the shorthand: `{ "a" }` and `{ ["a"] }` are errors,
the key alone being no reference.

```js
const a = 1;
const b = [a];
export default { a, b, c: 3 };   // { a: 1, b: [1], c: 3 }
```

#### Object Spread

A member may be a **spread**, `...` and any value, at any position and any
number of times:

```js
const o = { a: 1, b: 2 };
export default [{ ...o, c: 3 }, { a: 0, ...o }, { ...o, a: 0 }, { ...'ab' }, { ...null }];
// [{ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, { a: 0, b: 2 }, { 0: 'a', 1: 'b' }, {}]
```

The operand is evaluated in its place among the members, left to right, and
its own enumerable string-keyed properties are copied in, in its own
property order, as JavaScript's `CopyDataProperties` copies them. A copied
key behaves as a written one: when it is already present, the later value
wins and the key keeps its first position. What each value contributes
agrees with JavaScript:

- **An object:** its own properties, array-index keys first in ascending
  order, then the others in the order they were made.
- **An array:** its elements, keyed `'0'`, `'1'`, ….
- **A string:** one property per UTF-16 code unit, not per code point:
  `{ ...'😀' }` is `{ 0: '\ud83d', 1: '\ude00' }`, where `[...'😀']` is
  `['😀']`. The two spreads read a string differently in JavaScript, and so
  here.
- **Anything else** — `null`, `undefined`, a boolean, a number, a `bigint`,
  a function — contributes nothing: `{ ...null }` is `{}`.

So, unlike an [array's spread](#spread), copying these properties never
throws; evaluating the operand still may. A function contributes nothing:
`export default { ...(() => 1) };` writes `{}` as JSON and
`export default {};` as DataJS. Graph outputs preserve the spread
([output](#output)). A
copied `__proto__` key is an ordinary own property, as JavaScript's
`CreateDataProperty` makes it: `{ ...{ ['__proto__']: 1 } }` owns a
property named `__proto__` and has no new prototype
([the `__proto__` key](#the-__proto__-key)).

The value outputs write the object the spread made, and the graph outputs
the spread itself: `.js` and `.f.js` write it back, `{ ...o, c: 3 }`, the
EDAG keeps its `['...', exp]` entry, and `.rs` prints it through
`nanvm-lib`'s `object_spread`. A constant spread is not folded, so
`{ ...{ a: 1 } }` is a different graph from `{ a: 1 }`. With a spread among
the members, which keys the literal has is known only once the operand is:
no key selects inside such a literal during source reconstruction, and no
member before a spread is dropped as overwritten. Value outputs instead
evaluate the members and spreads before selecting and serializing the result.

A member may hold any value, `undefined` included, and a member holding
`undefined` is still an own property, as in JavaScript: it keeps its key and
that key's position, so `{ x: undefined }` is not `{}`, although reading `x`
gives `undefined` from both. `{ x: 1, x: undefined }.x` is `undefined`, and
`{ x: undefined, y: 2, x: 3 }` has the keys `x` and `y`, in that order. A
DataJS or FunctionalScript output writes the member, `{"x":undefined}`; a
`.json` output refuses it rather than drop it the way `JSON.stringify` does
([output](#output)).

#### Property Keys

A key is written in one of three ways:

|Form|Example|
|----|-------|
|string literal|`{ "a": 1 }`|
|identifier|`{ a: 1 }`|
|computed|`{ ["a"]: 1 }`, `{ [k]: 1 }`|

The first two spell a constant key. The brackets of a computed key hold any
value, as an index's do: a string literal there is the same constant key by
a third spelling, and the three spellings mix freely inside one object. An
identifier key is an [identifier](./lexical/identifiers.md) — ASCII letters, digits, `_`
and `$`, not starting with a digit — and may be a reserved word, `{ if: 1 }`,
as it may in JavaScript. A key no identifier spells is written as a string:
`{ "é": 1 }`, `{ "a-b": 1 }`.

Any other value in the brackets is a **computed key**. `sergey-shandar`
approved the design in
[#2828](https://github.com/functionalscript/functionalscript/pull/2828#issuecomment-6111260970),
as [DESIGN.md §12](../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires. The key is evaluated where the object is built — after the
members before it and before its own value, as JavaScript evaluates a
literal — and converted to a property key as JavaScript's `ToPropertyKey`
converts it: a string is the key, and every other value is the string it
converts to, `[1]` the key `"1"`, `[null]` the key `"null"`, `[[1, 2]]` the
key `"1,2"`:

```js
const k = 'a';
export default (i) => ({ [k]: 1, [k + 'b']: 2, [i]: 3 });
// ({ a: 1, ab: 2, [i]: 3 }); called with 0, { a: 1, ab: 2, 0: 3 }
```

A computed key that is a constant is that constant: `{ ["a"]: 1 }` and
`{ a: 1 }` are the same literal, and so is
`const k = 'a'; export default { [k]: 1 };`, `k` being the literal it is
bound to. The graph outputs write a key that is no constant string in
brackets, as it was read, `{ [i]: 3 }` and `{ [0]: 1 }`; the value outputs
write the key the value has, `{ "0": 1 }` ([output](#output)).

A key may be any name, including one a built-in prototype gives a value:
`{ constructor: 1, toString: 2, push: 3 }` is an object that owns those three
properties, as in JavaScript, whichever spelling each key takes. What
[property access](#property-access) refuses is reading such a member back,
not owning it, and `__proto__` is the one key with a rule of its own
([below](#the-__proto__-key)).

A numeric key literal such as `{ 3e7: true }` is not recognized yet — see
the [roadmap](./todo/README.md); `{ [3e7]: true }` is the same object.

#### The `__proto__` Key

JavaScript gives the three spellings of a `__proto__` key two different
meanings:

```js
{ __proto__: v }      // sets [[Prototype]]; no own property
{ "__proto__": v }    // sets [[Prototype]]; no own property
{ ["__proto__"]: v }  // an ordinary own property named "__proto__"
```

Only the bracketed spelling denotes a property, so it is the only keyed one
FunctionalScript accepts. The other two are compilation errors:

```js
export default { __proto__: 1 };    // error
export default { "__proto__": 1 };  // error
export default { ["__proto__"]: 1 }; // ok
```

**The bracketed form is the workaround**: it is how a module holds a property
actually named `__proto__`. The [shorthand](#objects) `{ __proto__ }` is the
other way, and denotes the same own property, as it does in JavaScript, where
the prototype rule names the keyed spellings alone.

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
of the keyed spellings it is the only one whose evaluation reproduces the
property, and the writer has no other, since the [shorthand](#objects) needs
a binding named `__proto__` to refer to and an output binds none. In JSON
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

Once admitted, parentheses leave no node behind, except for the boundary an
[optional chain](#optional-chaining) makes of them: they end the region a
`?.` opened. Admission can still depend on source form, as it does for a
literal bracket key ([property access](#property-access)). They keep
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
(`&& || ??`) and the conditional (`?:`), Stage B — and `!` and `typeof`, the
logical not and the type tag, the prefixes neither stage had — and
`instanceof Array`, the one instance check ([below](#instanceof)).
`==`/`!=` stay refused, since neither language reads them the same way
twice, and so does `in` ([below](#in-is-refused)). The comma operator is not
recognized yet.

Precedence and associativity follow JavaScript's own. From the tightest, the
levels are the prefixes `-`, `~`, `!` and `typeof`; `**`; `* / %`; `+ -`;
the shifts `<< >> >>>`; `< <= > >=` and `instanceof`; `=== !==`; `&`; `^`;
`|`; `&&`; `||`,
with `??` a chain of its own at the same level; and the conditional above
them all. The shifts therefore sit between arithmetic and comparison, unlike
`& ^ |`:
`1 << 2 + 3` is `1 << (2 + 3)` and `1 << 2 < 5` is `(1 << 2) < 5`. `**` is
right-associative (`2 ** 3 ** 2` is `2 ** (3 ** 2)`), the conditional nests
to the right (`a ? b : c ? d : e` is `a ? b : (c ? d : e)`), and every other
operator here is left-associative; a group overrides both
([grouping](#grouping)). A prefix immediately before `**` is refused,
matching JavaScript exactly: `-2 ** 2`, `~2 ** 2`, `!2 ** 2` and
`typeof 2 ** 2` are syntax errors here as there, at any depth of prefix
nesting, and parentheses are the only way to write either reading —
`(-2) ** 2` raises the negation, `-(2 ** 2)` negates the power. Immediately
after `**` a prefix needs no parentheses, since JavaScript reads the right
operand of `**` as another power or a
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
nothing. `!` converts its operand as JavaScript's `ToBoolean` does and
negates it: `!0`, `!""`, `!null`, `!undefined` and `!NaN` are `true`, and
`![]` and `!{}` are `false`, an array or an object being truthy however
empty. `typeof` is the type tag of its operand, the string JavaScript gives:
`"undefined"`, `"boolean"`, `"number"`, `"bigint"`, `"string"`, `"object"`
for `null`, an array and an object alike, and `"function"`. `typeof` is a
reserved word, so it names no `const` and no parameter, while `{ typeof: 1 }`
and `a.typeof` are a key and a property name as in JavaScript; the
FunctionalScript writer spells it with a space after the word, `typeof 1`
and `typeof (1+2)`.
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
operand or an arm only where JavaScript would, and calls an object's own
`valueOf` or `toString` when conversion requires it. JSON and DataJS output
evaluate these operators through the represented EDAG interpreter, then
check whether the selected result belongs to their data format. The
FunctionalScript writer, the `.js` output, spells every operator here, with
the parentheses its precedence and associativity ask for and no more —
`1 + 2 * 3` and `(1 + 2) * 3` come back as written, less the spaces, and
`(1 + 2) + 3` as `1+2+3`; `??` is never bare beside `&&` or `||`; a prefix
or a negative number on the left of `**` is grouped, `(-2)**2`; a `-`
before a text opening with `-` takes a space, `1- -2`; a function under an
operator, and an operator's text under an access, stand in a group,
`-(()=>1)` and `(1+2).x`; and a value shared under one lazy operand
alone is written in a block of the operand's own ([functions](#functions)).
Read back, that text is the graph it was written from. Graph output retains
the operation, while value output retains its result: `export default 1 + 2 * 3;`
is `export default 1+2*3;` as FunctionalScript, `export default 7;` as DataJS
and `7` as JSON.

### `instanceof`

```js
export default (...a) => a[0] instanceof Array;
```

`x instanceof Array` is `true` when `x` is an array and `false` of every
other value — `null`, `undefined`, every primitive, an object and a
function included. It never throws and converts nothing. It is the one
`instanceof` the language has: the right operand must be the word `Array`,
bare or in parentheses, since a group vanishes (`a instanceof (Array)` is
`a instanceof Array`); any other right operand — `Map`, an access, a
literal, a function — is refused at the operator. `Object` and `Function`
are not admitted and never will be: `typeof x === "object"` and
`typeof x === "function"` are the spellings for those. If we add more
types, like `Set` or `RegExp`, each is one more name on the right, once the
language can build one.

`instanceof` is a relational operator, one level with `< <= > >=` and
left-associative as they are: `a instanceof Array === b` is
`(a instanceof Array) === b`, `a < b instanceof Array` is
`(a < b) instanceof Array`, and `!a instanceof Array` is
`(!a) instanceof Array` — JavaScript's own trap, kept rather than repaired;
`!(a instanceof Array)` is the negation. `instanceof` is a reserved word,
as `typeof` is: it names no `const` and no parameter, while
`{ instanceof: 1 }` and `a.instanceof` are a key and a property name as in
JavaScript. `Array` is a reserved word too ([numbers](#numbers)), so no
scope binds it and the operator always means the global — before and after
any `const`, where JavaScript would read a later `const Array` as a binding
in its temporal dead zone and throw.

The EDAG's node is `['instanceof', exp, 'Array']`: the constructor is a
*name* from a closed list, not an operand, since no global is a value there
([`fjs/edag`](../fjs/edag/README.md)); `nanvm-lib` answers it with
`Any::instanceof_(x, Constructor::Array)`. The writer spells it with
spaces around the word, `a instanceof Array`.

### `in` Is Refused

`"a" in o` is a compilation error, and stays one by design. JavaScript's `in`
asks whether a property exists anywhere on the prototype chain, so
`"toString" in {}` and `"length" in []` are `true`; FunctionalScript has no
prototype chain to consult, and answering for own entries only would give
accepted text a different successful result than JavaScript gives it. Neither
is acceptable, so the operator is refused rather than approximated. To read an
entry, use [`entry`](#reading-an-entry-at-run-time), which answers `undefined`
for an absent key. An explicit presence pattern,
`Object.getOwnPropertyDescriptor(a, b)?.enumerable`, is only proposed
([2345](./todo/2345-has-own-property.md)): the compiler does not recognize it
yet. The reasons, the alternatives
rejected and what a migration does are in
[the `in` decision](./todo/2346-in-operator.md).

## Number Conversion

```js
export default (...a) => [Number(a[0]), Number("0x10"), Number(1n)];
```

`Number(exp)` converts its operand to a number, exactly as JavaScript's
`Number` does when called. A number is itself. A string is read as a numeric
literal, the whitespace around it ignored: `Number("0x10")` is `16`,
`Number(" 4 ")` is `4`, `Number("")` is `0`, and `Number("x")` is `NaN`.
`null` is `0`, `undefined` is `NaN`, and a boolean is `1` or `0`. A `bigint`
is the nearest number — `Number(1n)` is `1`, and `Number(2n ** 64n)` is
`18446744073709552000`, rounded as JavaScript rounds it. An array and an
object are made primitive as the [operators](#operators) make them: an array
by joining its elements, so `Number([7])` is `7` and `Number([1, 2])` is
`NaN`; an object through its own `valueOf` or `toString`, called as
JavaScript calls them, and `"[object Object]"` otherwise, so `Number({})` is
`NaN`. A function converts to its text, which is no number. Where a
`valueOf` or a `toString` throws, so does the conversion
([failure is one outcome](#failure-is-one-outcome)).

It is the language's conversion to a number: unary `+` is not FunctionalScript
syntax, and where the EDAG has it the two differ, `+` throwing on a `bigint`
([operators](./todo/2340-operators.md)). It is the EDAG's own
`['Number', exp]`, which graph outputs preserve and every executor answers; the
front end folds nothing, `Number("1")` reaching the graph as a node, as `~1`
does. The conversion is a value like any other: an operand, `-Number("1")`
and `Number(a) * 2`; a base, `Number(a).x`; and a callee, however little
calling a number is worth. The FunctionalScript writer spells it back as it
is written, the operand an argument, `Number(1+2)`.

**`Number` is a reserved word**, one of the names
[global names](./todo/2365-global-names.md) reserves, with `Array`, `Object`
([built-in static functions](#built-in-static-functions)) and `String`
([string conversion](#string-conversion)) —
[`fjs/js/keywords`](../fjs/js/keywords/module.f.js)' `reservedGlobals`, a
list beside the keywords rather than among them, since JavaScript has no
such keyword. A module cannot bind it, as a `const`, a parameter or an
import's local name ([shared values](#shared-values-constants)), and it is
no value: it stands as the callee of a call and as the namespace of the
four predicates the language admits, `Number.isInteger`,
`Number.isSafeInteger`, `Number.isNaN` and `Number.isFinite`
([built-in static functions](#built-in-static-functions)), and is a
compilation error (`reserved word`) anywhere else — bare,
`const f = Number;`, or as the namespace of any other member,
`Number.MAX_SAFE_INTEGER` or `Number.parseFloat(x)`, each an admission of
its own ([built-ins](./todo/2360-built-in.md)).
A key or a property name is not a reference, so `{ Number: 1 }` and
`o.Number` mean what they mean in JavaScript. `Number()` is `0`, as in
JavaScript, and reaches the graph as the literal, folded as `-1` is. Two
call shapes are not recognized yet, and refused by name
(`Number takes one argument`) rather than answered wrongly: `Number(a, b)`,
which establishes `a`, then `b`, then converts `a` — the comma operator's
`(a, b, Number(a))`, which lands with it
([operators](./todo/2340-operators.md)) — and `Number(...a)`, which converts
the first value the spread yields after yielding them all, or is `0` where it
yields none, as `Number()` is, a call of a runtime arity no node expresses
yet ([number-spread](./todo/2363-number-spread.md)). Nor is the guarded call `Number?.(x)`,
which is `Number(x)` in JavaScript, the word never being nullish: it is
refused at the word (`reserved word`) as every other spelling of `Number`
is but the call and the four predicates' reads, until a pull request reads
the guard away, a spelling no module writes.

The word is reserved for the guarantee `undefined`, `NaN` and `Infinity`
already have ([numbers](#numbers)): a global word means one thing wherever
it stands. `Number(x)` is the conversion in every module, so a reader, an
agent or a tool reads it without resolving a scope, where a JavaScript module
that binds the word — `const Number = x => x;`, the shadowing JavaScript's
linters flag — makes every `Number(…)` after it something else. And it keeps
the language free to grow: a member of the namespace admitted later,
`Number.parseFloat` say ([built-ins](./todo/2360-built-in.md)), cannot
change what an existing module means, since no module could have bound the word
([global names](./todo/2365-global-names.md)). The one JavaScript spelling it
costs, a module rebinding a standard global, is refused at compile time
rather than read another way.

It is also the one key computed at run time, `a[Number(i)]`
([property access](#property-access)).

## String Conversion

```js
export default (...a) => [String(a[0]), String(42n), String([1, 2])];
```

`String(exp)` converts its operand to a string, as JavaScript's `String`
does when called. A string is itself. `null` and `undefined` become
`"null"` and `"undefined"`, booleans become `"true"` or `"false"`, and numbers
and `bigint`s become their decimal text: `String(-0)` is `"0"`,
`String(NaN)` is `"NaN"`, and `String(42n)` is `"42"`. An array joins its
elements with commas, with `null` and `undefined` contributing empty text,
so `String([1, [2, 3], null])` is `"1,2,3,"`.

An object uses the string hint for primitive conversion: its `toString`
is tried before its `valueOf`, with no arguments. A noncallable method or
a nonprimitive result falls through to the next method. An object with no
own `toString` uses the ordinary `"[object Object]"` text, so
`String({ valueOf: () => 7 })` is `"[object Object]"`. If neither method
produces a primitive, or a method throws, conversion fails
([failure is one outcome](#failure-is-one-outcome)). A function becomes
its [EDAG-derived text](#function-source-representation-exception), which
describes its code without embedding captured values.

The one-argument conversion reaches the graph as `['String', exp]`, with
no front-end folding. The FunctionalScript writer spells it as `String(exp)`;
the EDAG and Rust outputs retain the operation, and the JSON and DataJS
outputs evaluate it. It is an expression wherever a value may stand,
including an operand, `String(x) + "!"`, or a base, `String(x).length`.
`String()` is the empty-string literal, as in JavaScript.

**`String` is a reserved word**, under the same
[global-name rule](./todo/2365-global-names.md) as `Number`. A module cannot
bind it as a `const`, parameter or import, and it has no standalone value:
`const f = String;` and `String.fromCharCode(65)` are compilation errors
(`reserved word`). A key or property name remains ordinary,
`{ String: 1 }.String` being `1`. Reserving the word lets every `String(x)`
denote the conversion without resolving a scope, and keeps future namespace
members from changing the meaning of existing bindings.

Multiple arguments and spreads remain unrecognized and are refused at the
word (`String takes one argument`): JavaScript evaluates all arguments before
converting the first, while a one-operand node cannot express those call
shapes. The guarded call `String?.(x)` is also refused (`reserved word`).
A property key computed at run time still requires `Number(...)`
([property access](#property-access)); `a[String(x)]` is refused as every
other unrecognized computed key is.

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

The key is a constant — an [identifier](./lexical/identifiers.md) after `.`, or a directly
written string or unsigned numeric literal in brackets — and `0` and `"0"` name the same element,
as in JavaScript. A numeric literal names the string JavaScript's `String`
gives its number, which is the number's
[normalized DataJS](./datajs/README.md#normalized-form) spelling: `a[1.0]`,
`a[1e0]` and `a[0.1e1]` are `a["1"]`, `o[1e21]` is `o["1e+21"]`, `o[1e-7]`
is `o["1e-7"]`, and `o[1e400]`, a literal that overflows, is
`o["Infinity"]` — a key the FunctionalScript (`.js`) output refuses to write
(`a number key no literal reads back`). A string in brackets is the key
unchanged, so `a["01"]` and `a["1.0"]` name no element and are `undefined`,
as in JavaScript.

A key computed at run time is the conversion,
`a[Number(i)]` ([number conversion](#number-conversion)): the property the
number names, its string as JavaScript gives it, so `xs[Number("1")]` and
`xs[1]` read one element, `"abc"[Number(true)]` is `"b"`, and
`xs[Number("x")]`, whose key is `"NaN"`, is `undefined`. It reads an own
property as every access does, and no prototype name is a number's string,
so nothing is refused at a converted key; `a[Number(i)](x)` calls what it
reads with `a` as the receiver, as `a[0](x)` does. Its base and its key are
both evaluated, as in JavaScript, though not in a promised order: where both
fail, which fails first is no observation
([failure is one outcome](#failure-is-one-outcome)). `a?.[Number(i)]`
evaluates the key only where `a` is neither `null` nor `undefined`
([optional chaining](#optional-chaining)).
Anything else in the brackets is a compilation error
(`computed key is not Number(...)`), at the token it begins with: `a[i]`,
whose type the compiler does not know — a key of any type is the `entry`
helper's to read ([reading an entry at run time](#reading-an-entry-at-run-time))
— and every other expression, `a[-1]` and `a[NaN]` included, whose keys
are written as strings instead, `a["-1"]` and `a["NaN"]`. A grouped literal
key, `a[(0)]` or `a[("x")]`, is also refused; a grouped conversion,
`a[(Number(i))]`, is accepted. Trivia, a line break included, may stand on either side of the
`.` or the `[` and inside the brackets, as between any two tokens
([trivia](./lexical/whitespace.md)): `a . b`, `a./* c */b` and `a`
with `.b` on the next line are each `a.b`, as JavaScript reads them.

FunctionalScript has no prototype chains, so a name a built-in prototype
gives a value — `push`, `toString`, `valueOf`, `constructor`, `__proto__`
and the rest, listed in [`fjs/js/prototype`](../fjs/js/prototype/module.f.js)
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
[`fjs/js/prototype`](../fjs/js/prototype/module.f.js)'s `prohibitedCalls`
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

### Built-in Member Functions

The represented EDAG interpreters and the Rust VM implement the admitted
member functions. The native completeness table checks every allowed
receiver-type/name pair against the compiler's list
([member-functions](../nanvm/lib/todo/member-functions.md)).

| Receiver | Admitted methods |
| --- | --- |
| Array | `at`, `concat`, `every`, `filter`, `find`, `findIndex`, `findLast`, `findLastIndex`, `flat`, `flatMap`, `includes`, `indexOf`, `join`, `lastIndexOf`, `map`, `reduce`, `reduceRight`, `slice`, `some`, `toReversed`, `toSorted`, `toSpliced`, `with` |
| String | `at`, `charAt`, `charCodeAt`, `codePointAt`, `concat`, `endsWith`, `includes`, `indexOf`, `isWellFormed`, `lastIndexOf`, `padEnd`, `padStart`, `repeat`, `replace`, `replaceAll`, `slice`, `split`, `startsWith`, `substring`, `toLowerCase`, `toUpperCase`, `toWellFormed`, `trim`, `trimEnd`, `trimStart` |
| Number | `toExponential`, `toFixed`, `toPrecision` |
| Object, Array, String, Number, Boolean, BigInt, Function | `toString` |

Methods follow JavaScript's argument, callback and coercion rules. Array
callbacks can be closures, missing arguments differ from explicitly passed
`undefined` where the method specifies that distinction, and string positions
count UTF-16 code units. Each is defined once, in
[`fjs/js/runtime`](../fjs/js/runtime/README.md): as a FunctionalScript body
every executor answers it from — `startsWith` the first — or, until its body
is written, as a name each executor implements natively. Mutation methods, iterator-producing methods,
locale-sensitive operations, regular-expression methods and namespace APIs
such as `Array.isArray` remain outside this set. The complete name-by-name
admission rationale is in [prototype names](../fjs/js/prototype/README.md).

Native execution has these limits:

- Number and bigint `toString` accept radices 2–36. Bigints and integral
  numbers convert exactly; a fractional number with a nondecimal radix is
  refused. Exact large-integer radix digits can differ from a host engine's
  implementation-defined formatting.
- `toSorted` with an inconsistent comparator has the order the executor's
  sorting algorithm gives it, as ECMAScript permits.
- `toLowerCase` and `toUpperCase` are the Unicode Default Case Conversion at
  **Unicode 17.0.0**, the version the pinned Rust standard library carries
  and `nanvm-lib` asserts at compile time
  ([prototype names](../fjs/js/prototype/README.md#unicode-version)). A host
  engine on another Unicode version may case a character assigned since
  then differently. A lone surrogate, which has no case, is kept.
- Native strings hold at most 2³² − 1 UTF-16 code units; a host engine may
  exhaust its resources sooner.
- Compiled functions carry EDAG-derived text. A native function without
  associated text is refused when conversion requests it
  ([function-source exception](#function-source-representation-exception)).

The native [array](../nanvm/lib/src/vm/array/README.md) and
[string/number](../nanvm/lib/src/vm/string/README.md) documentation gives the
method-specific details and implementation-defined cases.

### Built-in Static Functions

```js
const { is } = Object;
const { isInteger } = Number;
export default [Object.is(0, -0), is(NaN, NaN), [1, 1.5].map(isInteger), Number.isFinite("1")];
```

The language admits five static functions. `Object.is` is JavaScript's
SameValue, which tells `0` from `-0` and holds `NaN` equal to itself, where
`===` says the opposite of both. The four `Number` predicates are
JavaScript's, none converting its argument: `Number.isInteger`,
`Number.isSafeInteger` — an integer within `2^53 - 1` of `0` —
`Number.isNaN` and `Number.isFinite`, so `Number.isFinite("1")` is `false`
where the global `isFinite("1")`, which converts and is not admitted, is
`true`. Each is a value, as in JavaScript — passed,
compared, read as `Object.is.length` — and one function however often it is
read, so `Object.is === Object.is`. Every spelling of the read is that value:
`Object.is` and `Object["is"]`, and the guarded `Object?.is` and
`Object?.["is"]`, since a namespace is never nullish; a call of it, guarded
or not, is a call of that value, and steps after a guarded read go on as
they would after the plain one. Destructuring is sugar
([destructuring](#destructuring)): `const { is } = Object;` is
`const is = Object.is;`, and an object pattern over a namespace reads each
of its keys as that access does, a nested pattern reading through the
function as through any value. The sugar holds because no admitted static
reads `this`: JavaScript runs `const { is } = Object; is(a, b)` with
`this` undefined, and each admitted function answers alike detached and on
its namespace, which the runtime's proof checks on every engine the suite
runs on ([`fjs/js/static`](../fjs/js/static/module.f.js)). A built-in that
builds with `this` as its constructor — `Promise.resolve`,
`Uint8Array.from` — throws detached, and is not admissible.

**`Object` is a reserved word**, under the same
[global-name rule](./todo/2365-global-names.md) as `Number` and `String`,
reserved together with the member it admits. A module cannot bind it as a
`const`, parameter or import, and it is no value: the word alone,
`const o = Object;`, an array pattern over it, a member the namespace does
not admit — `Object.keys(o)` — and a computed key, `Object[k]`, are
compilation errors (`reserved word`), a namespace being closed at compile
time. It stands in one other place, the
[`entry` helper](#reading-an-entry-at-run-time)'s
`Object.getOwnPropertyDescriptor`. A key or a property name remains
ordinary, `{ Object: 1 }.Object` being `1`. `Number`, reserved for its
conversion already, is a namespace the same way, beside the call
`Number(x)` ([number conversion](#number-conversion)). Each later member is
an admission of its own ([built-ins](./todo/2360-built-in.md)).

Each read reaches the graph as the node of its name, `['Object.is']` or
`['Number.isInteger']`, and a call of it as the ordinary call,
`['()', ['Object.is'], [a, b]]` ([`fjs/edag`](../fjs/edag/README.md)). Each
body is written once, in the `static` section of
[`fjs/js/runtime`](../fjs/js/runtime/README.md), a VM's and no module's —
a module calls the built-in — and checked there against the host's own;
every executor answers the node from it, and an executor with no binding
for it fails, naming it, rather than answer. The graph outputs write the
node back: the FunctionalScript one as its name, `Object.is`,
the Rust one as the binding the VM answers, which NaNVM reads from the one
runtime object it holds, so every read there is one function too.

## Optional Chaining

The behavior below was added to the compiler and specification in
[#2660](https://github.com/functionalscript/functionalscript/pull/2660).
Its required explicit language-design approval is not recorded; the
[approval-process follow-up](./todo/2335-optional-chaining.md#authorization-and-approval)
remains open.

```js
const o = { a: { b: 1 }, f: (...x) => x };
const n = null;
export default [o?.a.b, n?.a.b, o.f?.(2), n?.(3), (o?.a).b];
```

An optional chain is JavaScript's: `v?.k` and `v?.[k]` read the property
`v.k` and `v[k]` read, with the key the same constant either takes
([property access](#property-access)), and `v?.(…)` calls `v` as `v(…)`
does — unless `v` is `null` or `undefined`, when the whole chain is
`undefined` and nothing after the `?.` is evaluated: not the key, not the
arguments, and not the steps written after it. `n?.a.b` is `undefined` under
a nullish `n`, where `n.a.b` throws, and `n?.f(g())` never calls `g`. The
steps after a `?.` are the chain's own until a parenthesis ends it, so
`(n?.a).b` reads `b` of `undefined` and throws — the one thing a group is
observable through ([grouping](#grouping)) — and the value is JavaScript's
in every spelling: `a?.b.c` and `(a?.b).c` are two programs, `a?.b?.(c)` and
`(a?.b)?.(c)` one, since a region closed before a guard is unobservable.

A call keeps its receiver through a `?.` as it keeps it through a `.`:
`a?.b(c)` and `a.b?.(c)` call `b` with `a` as `this`, so a built-in member
function is called through either, and `(a?.b)(c)` keeps it too, as
`(a.b)(c)` does. The key is judged as an access's is — a prototype name
refused as a read, `a?.at`, and allowed as a call, `a?.at(0)`; a member
function a module may not call refused at its key, `a?.push(1)`; `length`
read from any value — and a key computed at run time is the conversion,
`a?.[Number(i)]`, as it is after `.`
([property access](#property-access)), established only where the guard
lets the chain go on.

The graph is `fjs/edag/README.md`'s Chains, where every spelling has one
shape and the host engine agrees with it: `a?.b` is `['?.', a, 'b']`, the
steps after it the node's continuation, `['?.', a, 'b', ['|.', 'c']]` for
`a?.b.c`, and a group an access over the node, `['.', ['?.', a, 'b'], 'c']`.
`a.b?.(c)` is the access's own step, `['.', a, 'b', ['|?.()', [c]]]`, and
`a?.(c)` the call node `['?.()', a, [c]]`. The graph outputs write them: the
FunctionalScript one as above, a group where the region closed; the EDAG
one as the nodes; the Rust one as the method chain `nanvm-lib` runs. Value
outputs evaluate the chain and serialize its selected result. A
`?.` directly before a decimal digit is the token `?.` here, as the
tokenizer reads it
([`?.` before a digit](../fjs/js/tokenizer/todo/optional-chain-before-digit.md)):
`a?.5:1` is refused at the `5`, and will be the conditional it is in
JavaScript when `.5` is a number.

## Reading an Entry at Run Time

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
const escapes = { n: "\n", t: "\t" };
export default (...c) => entry(escapes, c[0]);
```

A key computed at run time is read by the **`entry` helper**: the function
above, written in a module under any three names, or imported from
[`fjs/types/object/entry`](../fjs/types/object/entry/module.f.js), which spells it once.
`entry(a, b)` is the enumerable own property `b` names of `a` — a member of
an object, an element of an array or of a string — and `undefined` where
there is none: a `length`, which an array, a string and a function own
without enumerating it; a function's `name`, which the language keeps
unobservable ([functions](#functions)); anything of a number, a boolean or
a `bigint`; and a name a prototype would give the value in JavaScript, since
the descriptor is the value's own. The key is converted as
`Object.getOwnPropertyDescriptor` converts it, so `entry(a, 0)` and
`entry(a, "0")` read one element and an object key converts through its own
`toString`; a `null` or `undefined` `a` is an error, as reading a property
of one is, and so is a key whose conversion fails.

The helper is exactly what it spells. The compiler recognizes the function
whole — its two parameters, the `const` the descriptor binds and the
`return`, under any three distinct names a module may bind, so no keyword
and no reserved global, the keys in either spelling, the
semicolons where JavaScript inserts them — where `Object` is the reserved
global no scope binds ([built-in static functions](#built-in-static-functions));
a function that departs from it by a step is an ordinary function, in which
`Object` is refused at the word as everywhere but `Object.is`. It is a
function like any other once recognized: a value, of
`length` `2`, capturing nothing, a fresh identity wherever it is written as
every arrow is, passed as a value — `[a, b].map(entry)` — and converting
to its text as any function does
([function source](#function-source-representation-exception)). Its EDAG
is the node `['entry']`, the helper as a value, and a read of a computed
key is a call of it, `['()', ['entry'], [a, b]]`
([`fjs/edag`](../fjs/edag/README.md)); the graph outputs write the node back
as the helper, the FunctionalScript one under names of its own, the Rust
one as a function the VM answers natively. Value outputs can evaluate calls
to the helper; selecting the helper itself is refused as a function value.

The node is the language's one read of a property by a name it computes:
`Object` is no value a module can name, and its namespace admits `is` alone
([built-in static functions](#built-in-static-functions)), and `a[i]` stays unread
([property access](#property-access)). Where a program knows its index to
be a number, the spelling is `a[Number(i)]`
([property access](#property-access)); `a[+i]`, where no `bigint` can reach
it, is [property-accessor](./todo/2330-property-accessor.md)'s still, and
`entry` is the read for a key of any type.

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
accepted. No parameter or comma may follow rest. A fixed parameter takes a
pattern, `({ a }, [b]) => [a, b]`, as a `const` does
([destructuring](#destructuring)); a default is not supported yet. A
newline before `=>` is refused.

### Parameters

- Fixed names bind positional arguments; missing arguments are `undefined`.
  Extra arguments are permitted. The rest parameter is the array of arguments
  after the fixed prefix. Each invocation has its own rest array, and repeated
  reads within it return the same array. Parameters may shadow outer names,
  but must be distinct and cannot collide with body declarations. Each one,
  fixed or rest, is a name by the
  [binding rule](#shared-values-constants): `(eval) => 1` and
  `(...let) => 1` are refused, while `(from, then) => [from, then]` is a
  function.
- `f.length` is the number of fixed parameters, including unused ones and
  counting a pattern as one. Rest
  adds zero. A function has **at most 16** fixed parameters: a 17th is a
  compile error, and an EDAG function whose `length` is above 16 is refused by
  every writer. Wider data reads better as an array or an object, and a rest
  parameter still takes any number of arguments. The EDAG interpreters retain
  the function's length, body and evaluated captures as represented values;
  conversion to ordinary runtime callables happens at an explicit target
  compile/load boundary ([EDAG values](../fjs/edag/values.md#runtime-compilation)).
- An **empty parameter list** binds no name at all, so a body written under
  one cannot reach its arguments: the arguments array is named by the
  parameter and by nothing else, and a word the list does not spell is
  unbound here exactly as any other unbound word is. Nothing else
  distinguishes the two lists. `() => 1` and `(...args) => 1` denote the one
  function, the one node `['=>', 0, [], 1]` — though each arrow written is
  a function of its own (below) — and a body `const` may take the name a
  parameter would have taken, there being no parameter to collide with.

### Captures and Self Recursion

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
  ([`["frame", N]`](../todo/edag-stage1-discussion.md)) describe.

  ```js
  const base = [10];
  const add = (...a) => (...b) => a[0] + b[0];
  export default [add(1)(2), ((...a) => base[0] + a[0])(5)];
  ```

  A function that names itself reaches itself: in
  `const fact = n => n < 2 ? 1 : n * fact(n - 1);` the inner `fact` is the
  function itself, the EDAG's `["self"]`, and `export default fact(5);`
  exports `120`. The name is the function's own only where the function is
  the whole value of the `const`, a module's or a body's: `const f = [() => f];`
  and `const f = (() => f)();` are `const not found`, since neither value is
  a function with a self to read. The function's own name comes after the
  names its body binds, as in JavaScript: a parameter or a body `const` of
  the same word shadows it — unless the body has already read the function
  by that word, which is refused as a capture shadowed is
  ([functions](#functions)). A function nested in it captures the name as
  it captures any other value around it, so `const f = x => () => f(x);`
  recurs through the inner function. Reading a *later* `const`, and so two
  functions calling each other, is still refused
  ([forward-references](./todo/3140-forward-references.md)).

### Bodies and Guards

- A body `const` is the body's, and binds as a module's does, a module
  being a function too ([a module is a function](#a-module-is-a-function)):
  it names a value the `return` and the statements after it may use, it may
  not be written twice, and it is not in its own initializer's scope — except
  that a function that is the whole initializer has the name as its own, as
  a module `const`'s does (above). It is evaluated as a module's is, as its own statement, at every call and whether
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
  [`body-const-forward-reference.md`](../fjs/compiler/parser/todo/body-const-forward-reference.md)
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
- The body is an expression or a block, and `value` and `{ return value; }`
  denote the same function. As an expression the body is any value except a
  bare object literal: after `=>` JavaScript reads `{` as a block, never as
  an object, so the spelling is refused rather than read another way, and the
  object is written in parentheses instead ([grouping](#grouping)) —
  `(...args) => ({ a: 1 })`, as in JavaScript. The block
  is any number of statements — `const`s, and guards, `if` (below) — and
  then one terminating statement, a `return` or a `throw` (below), each
  ended as every statement is — by its `;`, or by the newline before the
  next statement, a guard's by its `}`, and the last one's by the `}`
  ([module structure](#module-structure)) — and an object literal is an
  ordinary value again, since after `return` JavaScript expects an
  expression. `return` and the value share a line: a newline between them
  ends the statement in JavaScript, which would return `undefined`, so it is
  refused here rather than read another way, exactly as a newline before
  `=>` is. Nothing follows the terminating statement: a statement after it
  is unreachable, and JavaScript's admitting the text does not make it
  anything but a mistake.
- A parameterless function **called where it is written**, with no
  arguments, denotes its body where the call stands:
  `a ? (() => { const x = f(); return [x, x]; })() : 4` is the idiom for a
  `const` inside an expression, an arm of a conditional say, where no
  statement can stand, and it lowers to the arm holding `[x, x]` with `x`
  one shared node, no function and no call. Nothing observes the function:
  it is called once and compared with nothing, so it mints no identity the
  program could see, and its body evaluates exactly once, where the call
  stands — a slot of its frame is the enclosing scope's own node, so what
  the body shares stays shared and nothing else is. A body `const` the
  returned value does not reach is evaluated where the call stands, as in
  JavaScript; in the graph it is anchored at the nearest position that
  opens a block, the scope's root or a lazy operand
  ([operators](#operators)), which is where JavaScript's own semantics can
  tell no difference under the [failure contract](#failure-is-one-outcome).
  `(() => [1, 2])()` is `[1, 2]`, and a module holding either hashes the
  same. A capture a body names only through an unused alias, `const x =
  c;` and nothing more, is no slot of its frame, in a body or in a call
  inlined into one: the alias is dropped, so nothing reads it, and the
  scope's `const` is anchored as one nothing reaches. A call with an
  argument, `(() => 1)(null.x)`, has an argument to evaluate; a function
  with a parameter binds a name; and a body reading its own rest array
  names what the enclosing scope does not hold — each stays a call. The FunctionalScript writer uses the same idiom in reverse:
  a value shared under one lazy operand alone, which no `const` of the
  scope could hold without evaluating it whatever the operator decides, is
  written in a block opened at the operand,
  `a ? (() => { const $0 = [1]; return [$0, $0]; })() : 4`, which reads
  back as the operand. Round-tripping through that writer keeps the graph,
  not the text: the function written in the source is gone from both.
- **`throw value;`** terminates a block as `return value;` does, and a
  function whose body ends in it fails at every call — the one failure
  outcome the language has ([failure is one outcome](#failure-is-one-outcome)),
  reached on purpose, as a panic on a broken invariant rather than an
  expected error, which travels as a value
  ([`fjs/AGENTS.md` §1.5](../fjs/AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key)).
  Everything else about it is JavaScript's, read as `return` is: the value
  is any expression and is evaluated first, so `throw f(x)` calls `f` before
  failing; `throw` and its value share a line, since JavaScript's restricted
  production forbids a line terminator between them, and `throw;` with no
  value is not JavaScript; and nothing in the language catches the value,
  so the language promises the failure and not the payload, which an
  executor carries out of band for a human or a test runner to read.

  ```js
  export const todo = () => { throw "not implemented"; };
  export const checked = (n) => {
      const half = n / 2;
      throw ["not yet", half];
  };
  ```

  The body lowers to the node `['throw', v]`, an operation of one operand
  that always fails, and it follows the positional laziness every operator
  has: in an eager position it is evaluated and fails, and in a lazy one —
  an arm of `?:`, the right operand of `&&`, `||` or `??` — it is not
  established unless JavaScript would establish it, so
  `c ? 1 : (() => { throw 0; })()` is `1` under a true `c`. The
  FunctionalScript writer spells the node in a terminating position, a
  block's or [the module's](#module-structure), as the statement it came
  from, and anywhere else — wherever a graph puts one, and an arm of `?:`
  once `if` lowers there — as the call of a function that throws,
  `(() => { throw v; })()`: JavaScript's one spelling of an expression that
  fails, and FunctionalScript itself — the call of a parameterless function
  written where it is called, which the front end inlines (above), so the
  text reads back as the node it was written from and fails at the same
  point. That is the writer's spelling, not a second source form:
  `throw` is a statement only, and an expression that must fail goes
  through a function that throws, as in JavaScript. The EDAG output carries
  the node, and the Rust output fails as the VM fails
  ([output](#output)).
- **`if (condition) block`** is a guard: a statement of a block body,
  standing where a `const` may, any number of times before the body's
  terminating statement. Its block is a block as above — any number of
  statements and then a `return` or a `throw` — so the branch always
  terminates, and the statements after the guard, up to and including the
  body's own terminator, are what runs when the condition is falsy. The
  condition is any expression, evaluated where the statement stands and
  tested as `?:` tests its condition. This is the one form: the braces are
  required, there is no `else`, and the statement stands in a function
  body only — each a scoping decision of a step-by-step plan rather than a
  guarantee, the bare consequent `if (c) return v;`, a branch that does
  not terminate and with it `else`, and a guard at module level being
  follow-ups, each additive on top of this one. No `;` follows the `}`, as
  in JavaScript: one there is the empty statement the language refuses
  ([module structure](#module-structure)), and the next statement may
  share the guard's line.

  ```js
  export const unwrap = r => {
      if (r[0] === 'error') { throw r[1]; }
      return r[1];
  };
  export const sign = n => {
      if (n < 0) { return -1; }
      if (n > 0) { return 1; }
      return 0;
  };
  ```

  The guard is syntactic sugar over the conditional and adds no node: a
  body `s… if (c) B rest` denotes `c ? (() => B)() : (() => rest)()`, the
  guard's block and the statements after it each the body of a
  parameterless function called where it stands (above), and the compiler
  reads it as exactly that, so `if (a) { const x = [1]; return [x, x]; }
  return 0;` and `a ? (() => { const x = [1]; return [x, x]; })() : 0`
  are one graph and one hash — `['?:', a, ['[]', [x, x]], 0]` with `x`
  one shared node — and a second guard nests as the alternate of the
  first. Where a `const` lives is which edges reach it: one before the
  guard is the scope's, evaluated eagerly as JavaScript evaluates it before
  the condition, so `const a = [1]; if (m) { return a; } return 0;` is
  `[',', [a, ['?:', m, a, 0]]]`, the anchoring rule of
  [operators](#operators) — and `m ? a : a` is not folded to `a`, the
  condition being an evaluation of its own that may fail; one in the
  guard's block, or after the guard, is reached from its arm alone, and
  evaluated only when JavaScript would evaluate it, so `if (a) { throw 1;
  } const y = [2]; return y;` is `['?:', a, ['throw', 1], ['[]', [2]]]`
  and an unused `const z = [2]` in its place is anchored at the
  alternate's comma, `[',', [z, 1]]`, never at the function's root. The
  statements after a guard are JavaScript's one block with the ones before
  it, so a name that block has bound — a parameter, a `const` before the
  guard, or one after an earlier guard — may not be bound again there
  (`duplicate id`), and neither may a word that block has already read
  from an enclosing scope, in a statement before the guard, in the
  condition or in the guard's block (`capture shadowed`), since in
  JavaScript every such read would have named the later `const` before
  its declaration; the guard's block is a block of its own and may shadow
  either. The FunctionalScript writer never
  writes `if`: it spells the conditional, and an arm that holds a `const`
  or a `throw` as the block opened at the operand (above), so the guarded
  body reads back as the same graph; the EDAG output carries the `?:`,
  and the Rust output prints it as it prints any conditional.

### Loops

```js
export default n => {
    let r = 1;
    while (r < n) { r = r * 2; }
    return r;
};
```

- **`let x = init;` followed by `while (condition) { … }`** is a loop: two
  statements of a block body, standing where a `const` may, that the
  compiler reads as one. The `let` declares the loop's variable with its
  initial value; the `while` runs its block while the condition is truthy,
  tested as `?:` tests its condition, before each round; and from the loop
  on the variable is a `const` of the body holding the value the last round
  left. The block holds `const`s and assignments to the variable,
  `x = value;`, each ended as every statement is; an assignment rebinds the
  variable for the statements after it, in order, as JavaScript reads them,
  and the block's end continues the loop with the variable's last binding
  — a block assigning nothing continues with it unchanged. A value nothing
  after it reads, a `const` the block never uses or an assignment
  overwritten before any read, `r = null.x; r = 1;`, is established all the
  same, for what it does, as an unused `const` is anywhere
  ([bodies and guards](#bodies-and-guards)): the throw JavaScript throws
  there is thrown here, and the writer writes the value back as a `const`
  of the block, the same graph. This is the one
  form: one variable per loop, the `while` right after its `let`, no
  `break`, `continue`, guard, `return`, `throw` or nested loop in the block,
  no `let` anywhere else, and no loop at the module level — each a step of
  a plan rather than a guarantee, additive on this one
  ([`spec/todo/3220-let.md`](./todo/3220-let.md)). No `;` follows the
  `}`, as none follows a guard's.

- The loop is syntactic sugar and adds no node: `let r = init; while (c)
  { s…; r = next; } rest` denotes `rest` with `r` the value of
  `loop(init)`, where `loop` is the function `r => c ? (() => { s…;
  return loop(next); })() : r` — the recursive spelling, its one parameter
  the variable, the block the body of a parameterless function called
  where it stands, as a guard's is, so that a `const` in it is the block's
  alone and runs only when the condition holds. The graph is the template
  `['=>', 1, slots, ['?:', c, ['()', ['self'], [next]], ['arg', 0]]]`
  called with `init`, a comma around the call where the block holds a
  `const` the next value does not reach — the same graph and hash a
  function written that way has, and what the block reads from the body
  around it is the function's frame, as any nested function's captures
  are ([captures](#captures-and-self-recursion)).

- **A loop runs in constant stack** in the FunctionalScript output, in
  function text and in the Rust output: each writer recognizes the template
  and spells it as the one loop, `while (c) { …; r = next; }` — the source
  writer as these two statements, the code-only text as the same two over a
  `let` of the function's parameter
  ([function text](../fjs/edag/function-text.md)), and the Rust output as
  Rust's `loop` over a `let mut` of the initial value where the function
  is called where it is written, and as the function's closure whose body
  is that loop over its argument where it is held as a value, no round a
  call either way — where a function calling itself last is
  otherwise recursion, which V8 runs out of stack on after some thousands
  of rounds, having no tail calls, and Rust likewise. A hand-written
  function of the template's shape, `const loop = r => c ? loop(next) :
  r;`, is the same graph and gets the same loop; one of a shape no `while`
  writes — a `const` before the condition running every round, a condition
  sharing a value with the block that mints identity, a container, a
  function or a call, a read of the rest array — keeps the recursion in
  every writer, which ask one recognizer; a read the condition
  and the block repeat, `r[0]`, one value of the graph, is written where
  each read stands and loops. A condition sharing a value of its own, the
  `const` of a function called where written, is the FunctionalScript
  output's loop still, the condition written as that function again, so
  that the value is established afresh at every test, and the Rust
  output's, whose `loop` rebinds it; the function text keeps the recursion
  for it. The FunctionalScript output alone keeps the recursion for a
  nested function that reads the variable, `self(() => r)`, since its
  nested function captures by name where the recursion's holds the value
  of its round — the function text's captures by value, through the
  wrapper it applies, and the Rust output's frame is a value. The EDAG
  interpreters still run the call
  ([tail-call-loop](../fjs/edag/todo/tail-call-loop.md)).

- Three programs JavaScript admits are refused rather than read another
  way, each because this reading and JavaScript's would differ:
  - a function nested in the loop, in its condition or its block, that
    reads the variable and is held as a value — a `const`, an item, an
    argument, a value returned — rather than called where it is written
    (`loop variable captured`): JavaScript's closure sees the variable's
    last value, where the function's capture would hold the value of the
    round it was made in. A function called where it is written, `r = (()
    => r + 1)();`, reads the round's value in both, and is admitted; so
    is a read from any depth of such functions, since each closure is
    made and called in the round, where a function held as a value is
    refused for a read a function it calls where written makes, `r = ()
    => (() => r)();`, its closure outliving the round all the same;
  - a `const` of the variable's name in the block (`loop variable
    shadowed`): a block may shadow any other name, as a guard's block
    may ([bodies and guards](#bodies-and-guards)), but the loop's block
    has one job, to assign the variable, and a `const` of its name
    declares that it cannot — JavaScript throws on an assignment after
    it and refuses a read before it. The round leaves the state as it
    was, and the state being all the condition reads, every round after
    it is the same round: a loop that never ends, or throws at once.
    This compiler names the slip, a `const` written for the step, rather
    than compile a loop that cannot advance;
  - an assignment to any other name (`not the loop variable`), the one
    name a block may rebind.

  A `let` not followed by its `while`, or a `while` no `let` stands
  before, is refused (`let without while`, `while without let`): the two
  are one loop. The variable is a name of the body as a `const` is — bound
  twice is `duplicate id`, read in its own initializer `const not found`,
  by a nested function there too, `let r = () => r;`, whose closure
  JavaScript lets see the variable's last value — and a function written
  after the loop reads it as the value it holds, as it reads any `const`.

### Names and Identity

- A function **carries no name**. Its EDAG is `['=>', length, slots, body]`,
  name-erased, so the function in `{ make: () => 0 }.make`, in
  `const hello = () => 0` and in `export default () => 0` is the same node,
  `['=>', 0, [], 0]`, whatever JavaScript would name it (`make`, `hello`,
  `default`), and no program observes the difference: `f.name` is
  refused at the key of `.`, and `entry(f, 'name')` is `undefined`, since
  `name` is not an enumerable own property
  ([reading an entry at run time](#reading-an-entry-at-run-time)), which is
  the decision that retired the proposals that would have exposed a name. The
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

### Calls

- A function is **called** as JavaScript calls one: `f(a, b)` with no
  receiver, and `o.m(a)` with `o` as the receiver. A call is a step after a
  value, as a property access is, and what a step applies to is everything
  written before it — so `f(1)(2)` calls what `f(1)` returns, and
  `o.m(1).n(2)` calls `n` on what `o.m(1)` returned. The arguments are the
  list an array holds, a trailing comma and a [spread](#spread) included:
  `f(...a, 4)` passes `a`'s elements and then `4`, and
  `(...r) => f(...r)` forwards the values and never the array, since every
  callee builds its own rest array from the arguments.

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
  the receiver's type, and the read of either stays refused. The represented
  interpreters and the native VM implement the admitted
  [member functions](#built-in-member-functions), including the function
  text the [exception](#function-source-representation-exception) adopts.

  The graph outputs preserve a call: the EDAG carries its node, generated
  Rust runs it through nanvm-lib, and FunctionalScript writes `f(a)` or
  `a.b(c)`. JSON and DataJS output evaluate it and serialize its result,
  provided the selected data contains no function ([output](#output)).

### Function Outputs

- A function is written by the graph outputs, the FunctionalScript, EDAG
  and Rust ones ([output](#output)). JSON and DataJS have no function value,
  so they refuse a function in the selected result, even inside an array or
  object. A function used only during initialization or exported under an
  unselected name does not block data output:
  `const f = (a, b) => 1; export default [f.length];` writes `[2]` as JSON.

## Command Line

```sh
fjs compile <input> <output>
fjs compile
```

`fjs compile` reads the input and resolves every module it imports into one
program. The value outputs, `.json` and `.data.js`, evaluate that program and
write the exported value; the graph outputs — FunctionalScript, EDAG and
Rust — write the program itself and evaluate nothing ([output](#output)). So a
module whose evaluation fails, such as `const c = null.x; export default 1;`
or one that imports it, compiles to no value output — the error is
`module initialization failed`, naming the failing module — while a graph
output never sees the failure: it writes the program, which fails when it runs, as the module does
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
these two names, or none ([the check](#checking-every-fjs)); any other count
fails, naming no file: one with `Error: Requires 2 arguments`, and more than
two with the first one it does not read, `Error: unexpected argument --tree`,
rather than succeed without it.

On success the command creates the output's parent directories recursively,
writes the output and exits `0`. On failure it writes
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
output reports an initialization failure as `module initialization failed`.
The interpreter retains the evaluated thrown payload for API consumers;
the CLI diagnostic does not expose it as a language-level observation.
A refusal of the output names the output as given instead,
since the module itself is sound: an extension naming no format, a value JSON
cannot spell, a callable in the selected data, or a node the FunctionalScript
or Rust writer has no spelling for. A failure to create a directory or write
the output — a parent that is a file, a name that is a directory — is reported
in the host's own words, which name the affected path too:
`EISDIR: illegal operation on a directory, open 'out/config.json'`.

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
ends one: at a newline ([whitespace](./lexical/whitespace.md)), and
at a U+2028 or U+2029 inside a string. A CRLF ends one line, not two.

The JSON reader tracks no lines. A malformed `.json` document, the input or an
import, gives in its message the UTF-16 code-unit offset reading failed at,
counted from 0 — `/project/e.json - error: unexpected symbol at 19` — or
`unexpected end` when the text runs out
([parse-error-location-format](../fjs/media/json/todo/parse-error-location-format.md)).

`fjs compile` is one of several `fjs` commands; see
[`fjs/README.md`](../fjs/README.md) for the rest.

### Checking Every `.f.js`

```sh
fjs compile
```

With no arguments `fjs compile` checks rather than compiles. An authored
`.f.js` promises that the compiler of the same revision accepts it
([file types](#file-types)), and `tsc` cannot keep that promise for it — it
accepts source the compiler refuses, `let a = 1; export default a;` for one,
which the compiler rejects at its first token, `1:1 - error: unexpected token`
— so this is the check that does. Every `.f.js` under the current directory
(`INIT_CWD` under `npm run`, so `npm start compile` from a subdirectory
checks that subtree), hidden entries and `node_modules` skipped as the test
runner skips them, is read and linked into its program exactly as every
output begins, its imports included, and nothing is written. An `.f.mjs`
states the intent and makes no such promise, so it is not checked, though
one an `.f.js` imports is linked with it and refuses it when refused.

Every refused file is reported on `stderr` as a compile of it would report
it, and the check goes on to the next, so one run names every file that
fails. The last line counts what the walk found: `.f.js: 3 checked, 2 refused`
on `stderr` with exit `1`, or `.f.js: 3 checked` on `stdout` with exit `0`.
A tree holding no `.f.js` passes as `.f.js: 0 checked` — the count is there
so that a walk from the wrong directory is visible. A tree that cannot be
listed fails in the host's words.

### Source Text

Every file `fjs compile` reads — the input and every module or document it
imports, directly or not — is UTF-8 text, as a JavaScript host reads a module
or a JSON import, and every output is written in UTF-8. Any character beyond
ASCII, one beyond U+FFFF included, may stand raw in a string, and any but
U+2028 and U+2029 in a comment ([comments](./lexical/comments.md)); it is the code point
its bytes encode, exactly as JavaScript reads it: `export default "é中😀";`
is a string of three code points, four UTF-16 code units. Everywhere else the
text is ASCII ([identifiers](./lexical/identifiers.md),
[whitespace](./lexical/whitespace.md)).

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
[`fjs/compiler/README.md`](../fjs/compiler/README.md).

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
generated Rust module under `.rs`, which [nanvm-lib](../nanvm/lib/README.md)
runs. They are compiler artifacts, and [`fjs/compiler`](../fjs/compiler/README.md)'s to
describe. A name ending in none of the eight suffixes — `.json`, `.data.js`,
`.data.mjs`, `.js`, `.mjs`, `.edag.data.js`, `.edag.data.mjs` and `.rs` —
declares none of the five, and is refused before the input is read, rather
than written in a language the name does not declare: `.ts`, `.JSON` and a
name with no extension alike.

#### Evaluation and Projection

`.json` and `.data.js` are the **value outputs**: they evaluate the program
and write the value it computes. `.js`, `.edag.data.js` and `.rs` are the
**graph outputs**: they write the program's graph and evaluate none of it.
Value outputs can evaluate every implemented expression form, including
functions, calls, closures, methods, operators, spreads and optional chains.
Their representability check applies to the resulting selected data, after
the entire module has initialized:

|Program or selected result|`.json`|`.data.js`|`.js`|`.edag.data.js`|`.rs`|
|----------------|-------|----------|-----|---------------|-----|
|a function in selected data|refused|refused|written|written|written|
|a function used to compute data|computed|computed|written|written|written|
|a reached initialization failure|refused|refused|written|written|written|
|a call or any admitted operator|computed|computed|written|written|written|
|an object or array reached twice|written twice|a `const`|a `const`|a shared node|a shared value|
|a `bigint`|refused|written|written|written|written|

A value output evaluates the program through the Memo EDAG interpreter
([EDAG values](../fjs/edag/values.md#module-initialization)). It computes
calls and coercions: `const f = x => x + 2; export default f(3);` writes
`5` as JSON and `export default 5;` as DataJS; `export default [1, 2].map(x => x + 1);`
writes `[2,3]` as JSON. An evaluated function, including one nested in a
selected array or object, is refused by both data formats with
`callable materialization requires a target compile/load boundary`.
An initialization failure is reported against its source module instead.

Graph outputs preserve the unevaluated program. The FunctionalScript writer
spells calls and every admitted operator; the EDAG output preserves their
nodes, folding unary `-` where its operand lowers to a number or a `bigint`
([numbers](#numbers)). The Rust output emits the native implementation of
those nodes. All executors evaluate a lazy operand or conditional arm only
where JavaScript does, so an unreached `1n / 0n` never throws. Source and
Rust writers can still refuse a graph they cannot reconstruct within their
output profile; recognizing a node does not guarantee every sharing or
capture arrangement has a source spelling
([source and runtime compilation](../fjs/edag/values.md#runtime-compilation)).
Deep container, function and conversion nesting can also exhaust the host
call stack during compilation. In particular, parsing and lowering a long
`Number`/`String` conversion chain can succeed before source serialization
overflows. These are compiler resource limits, not fixed language depth limits
([tracked inputs and remaining work](../fjs/compiler/todo/deep-nesting-recursion.md)).

The Rust writer
spells a `bigint` of any size, a literal within `i64` as one number and a
larger one as its sign and `u64` words. A string holding a lone surrogate,
which no Rust `&str` can hold, is written as its UTF-16 code units. A literal
Rust has no spelling for is refused, naming the output and writing nothing;
none is left among the primitives.

For a FunctionalScript input, JSON and DataJS output serialize the module
result's `default` property.
Selecting the `default` does not narrow what they evaluate: a value output
evaluates the whole program — every `const`, exported or not, of the input and
of every module it loads, one an `import {}` loads included — and a required
failure anywhere prevents output. Only after initialization succeeds is the
default export selected and converted to data. Unselected function exports
and local functions are allowed:
`export const g = () => 1; export default 5;` writes `5` as JSON, and
`const f = (a, b) => 1; export default [f.length];` writes `[2]`.
A named-only root projects to `undefined`: DataJS writes
`export default undefined;`, while JSON refuses `undefined`. FunctionalScript
output preserves each named export as `export const` and writes `export default`
last when present. Dependencies and shared values are declared before use;
recompilation does not add another wrapper. EDAG and Rust
output write the complete export object. A direct `.json` input remains a
document: its value is used without projection, even when it contains a property
named `default`. Imported JSON instead exposes `{ default: document }` at the
module boundary, from which a default import selects the document.

#### Serialization Rules

- A DataJS document is written in
  [normalized form](./datajs/README.md#normalized-form): one line, and an
  object or array referenced more than once hoisted into a `const` named `$0`,
  `$1`, … in post-order, so it stays shared
  ([shared values](#shared-values-constants)); a primitive is written inline
  wherever it is read, however often, since sharing one is not observable.
  Every function-free selected value has a DataJS document, shared nodes, `bigint`,
  `undefined`, `NaN` and the infinities included.
- JSON is a tree, and a JSON document carries no identity: every object and
  array in it is a fresh one when it is read. So an object or array the value
  reaches along more than one reference — through a `const`, an import or a
  property access — is written where each reference reaches it, as
  `JSON.stringify` writes it: `const o = {}; export default [o, o];` is
  `[{},{}]`, the one tree the value has. The compiler refuses what JSON
  cannot spell rather than write a file that reads back as a different
  value: `bigint`, `undefined`, `NaN`, `Infinity` and `-Infinity`, which JSON
  has no word for. A `bigint` is refused even though its digits are JSON,
  since `1` reads back as the *number* `1`. The refusal names the output
  file and writes nothing.

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
  generated names use one `$n` counter across constants and parameters in
  every scope, allocated in declaration order. An export named `$n` reserves
  that number, which the counter skips; the prefix always stays `$`.

  The writer spells a property access, every operator the language has
  ([operators](#operators)) and every call. A number or a function that is
  an access's base or a callee takes a `const`, and so does a callee that
  is an access: `a.b(c)` and `(a.b)(c)` are both the method call. The front
  end inlines a function written at the call only when the call has no
  arguments, the function has zero fixed parameters, and its body does not
  read its own rest array ([bodies and guards](#bodies-and-guards)). The
  writer hoists function callees when retaining a call node, so reading its
  output does not inline that call away.
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
  ([the `__proto__` key](#the-__proto__-key)).
- An access in a FunctionalScript document is written from its constant key
  ([property access](#property-access)): a string key that is an
  [identifier](./lexical/identifiers.md), a reserved word included, follows a `.`, and
  any other string key is a normalized string in brackets — with the object
  named `$0`, `a["if"]` and `a['c']` are `$0.if` and `$0.c`, while
  `a["a-b"]`, `a["é"]` and `a["1"]` stay bracketed. A number key stays a
  number in brackets, in normalized spelling — `a[1e21]` is `$0[1e+21]` — so
  `a["0"]` and `a[0]` keep their own spellings. A number, a `bigint` or a
  function an access is taken on is named first rather than written in
  place: `1 .x` is `const $0=1;export default $0.x;`, and so is `(-1).x`,
  whose `-1` folds to a number. An operator's text under an access stands
  in a group: `(-[1])[0]` and `(1 + 2).x` come back as `(-[1])[0]` and
  `(1+2).x`.
- `NaN`, `Infinity` and `-Infinity` — a literal, or a number that overflowed
  to infinity — are emitted as those words in a DataJS or FunctionalScript
  document, and `-0` as `-0` in every format.

## Roadmap

Unimplemented language features and remaining design work — ECMAScript
proposals, I/O effects, the content-addressable VM, object identity,
mutability and serialization — are tracked in [`spec/todo/`](./todo/README.md).
Implemented behavior belongs in this document; a design record may remain
open for approval, proofs or follow-up work after its syntax has landed.

For the implementation, see [`fjs/compiler/README.md`](../fjs/compiler/README.md), the
compiler.
