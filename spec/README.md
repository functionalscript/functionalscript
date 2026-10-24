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
operator (`+`) and type annotations in comments — and the
design documents for the VM, I/O, serialization, and the rest of the roadmap
live in [`spec/todo/`](./todo/README.md). Loose equality (`== !=`) is not
waiting: it stays refused ([operators](./operators/README.md)).

The compiler accepts values ([supported value types](./values/README.md)),
the [constants](./bindings/constants/README.md) and
[imports](./modules/imports.md) that share them,
[property access](./property-access/README.md), [operators](./operators/README.md), the
[`Number` conversion](./conversions/number/README.md),
[`String` conversion](./conversions/string/README.md),
[template literals](./values/template-literals/README.md), and
[functions](./functions/README.md) with their calls, and this document specifies all of
them. The outputs differ in what they can write, so one module may compile to
one output and be refused by another ([output](./command-line/output.md)).

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
or JSON ([output](./command-line/output.md)).

## Contents

The specification is a tree of small pages, one per feature. Each page says
what is accepted and what is refused and cites the ECMAScript section it
narrows. Pages that have example programs show them with the compiler's real
output; the others say under *Examples* that theirs are still to come
([the plan](./todo/spec-tree.md)).

- [Principles](./principles/README.md): compatibility, purity, failure
- [Lexical grammar](./lexical/README.md): [whitespace](./lexical/whitespace/README.md),
  [comments](./lexical/comments/README.md), [identifiers](./lexical/identifiers/README.md),
  [string escapes](./lexical/string-escapes/README.md)
- [Values](./values/README.md): [numbers](./values/numbers/README.md),
  [bigints](./values/bigints/README.md), [strings](./values/strings/README.md),
  [template literals](./values/template-literals/README.md),
  [arrays](./values/arrays/README.md), [objects](./values/objects/README.md)
- [Modules](./modules/README.md): [exports](./modules/exports/README.md),
  [imports](./modules/imports.md)
- [Bindings](./bindings/README.md): [constants](./bindings/constants/README.md),
  [variables](./bindings/variables/README.md),
  [destructuring](./bindings/destructuring/README.md)
- [Operators](./operators/README.md): [grouping](./operators/grouping/README.md),
  [`instanceof`](./operators/instanceof/README.md), [`in`](./operators/in/README.md)
- [Conversions](./conversions/README.md): [`Number`](./conversions/number/README.md),
  [`String`](./conversions/string/README.md)
- [Property access](./property-access/README.md):
  [optional chaining](./property-access/optional-chaining/README.md),
  [entries](./property-access/entries/README.md)
- [Functions](./functions/README.md): [parameters](./functions/parameters/README.md),
  [captures](./functions/captures/README.md), [calls](./functions/calls/README.md),
  [names and identity](./functions/names-and-identity/README.md),
  [outputs](./functions/function-outputs/README.md)
- [Control flow](./control-flow/README.md): [guards](./control-flow/guards/README.md),
  [loops](./control-flow/loops/README.md), [switch](./control-flow/switch/README.md)
- [Built-ins](./built-ins/README.md): [member functions](./built-ins/member-functions/README.md),
  [static functions](./built-ins/static-functions/README.md)
- [Undecided constructs](./undecided/README.md): the valid JavaScript
  refused today while its decision is still owed
- [Command line](./command-line/README.md): [checking](./command-line/checking.md),
  [source text](./command-line/source-text.md), [file types](./command-line/file-types.md),
  [JSON input](./command-line/json-input.md), [output](./command-line/output.md)
- [Roadmap](#roadmap)

## Implemented Features

| Area | Supported today |
| --- | --- |
| Modules | Default, named and combined imports; JSON import attributes; local and exported `const`, local `let` and assignments; named and default exports; terminal `throw` |
| Literals | JSON values, `undefined`, `NaN`, infinities and arbitrary-width bigints; decimal, hexadecimal and binary integers; numeric separators; single- and double-quoted strings; untagged template literals |
| Containers | Dense arrays, object literals, shorthand members, constant and computed keys, trailing commas, array/call spread and object spread |
| Expressions | Grouping; arithmetic, strict comparison, bitwise and lazy operators; `?:`, `!`, `typeof`, `instanceof Array`, `Number(...)` and `String(...)` |
| Properties | Own-property reads, numeric computed keys through `Number(...)`, optional reads/calls and the enumerable `entry` helper |
| Functions | Arrow functions, 0–16 fixed parameters, optional rest, closures, self recursion, body constants, `let` variables and assignments, terminating `if` guards, `while` loops over one variable, the terminating `switch`, `return`, `throw`, ordinary and method calls |
| Built-ins | Pure array, string and numeric member functions, including callbacks and function text ([member functions](./built-ins/member-functions/README.md)); `Object.is`, `Object.entries` and the `Number` predicates `isInteger`, `isSafeInteger`, `isNaN`, `isFinite` ([static functions](./built-ins/static-functions/README.md)) |
| Compiler | JSON/DataJS evaluation; FunctionalScript, EDAG and Rust graph output; import linking and the authored `.f.js` check |

The sections below give the restrictions and executor-specific limits for
each feature. This overview records compiler support; optional chaining's
required [language-design approval record](./todo/2335-optional-chaining.md#authorization-and-approval)
remains open. TypeScript-only syntax, mutation of a value's contents,
loops beyond the one-variable `while` ([loops](./control-flow/loops/README.md)), classes, numeric
key literals and general forward references remain outside the implemented
language.

## Roadmap

Unimplemented language features and remaining design work — ECMAScript
proposals and the like — are tracked in [`spec/todo/`](./todo/README.md). The
designs for I/O effects, the content-addressable VM, object identity,
mutability and serialization are in [`spec/design/`](./design/README.md).
Implemented behavior belongs in this document; a design record may remain
open for approval, proofs or follow-up work after its syntax has landed.

For the implementation, see [`fjs/compiler/README.md`](../fjs/compiler/README.md), the
compiler.
