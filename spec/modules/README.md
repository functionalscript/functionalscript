# Module Structure

**Status:** implemented

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
or `throw` ([line terminators](../lexical/whitespace/README.md)).

[DataJS](../datajs/README.md) *requires* the `;` after every statement, and
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
it there ([`fjs/compiler/parser`](../../fjs/compiler/parser/README.md)). Trivia
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
|variable|`let name = expression;`, `let name;`|
|assignment|`name = expression;`|
|call statement|`name(expression);`|
|named export|`export const name = expression;`|
|default export|`export default expression;`|
|throw|`throw expression;`|

```js
import base from "./base.f.js";    // imports first

const extra = { "debug": true };   // then constants

export default [base, extra];      // optional, at most one, last
```

These are the module-level statement forms. A statement begins with `import`,
`const`, `let`, `export`, or `throw`, or with the name of an assignment or
a call statement, each of which stands wherever a `const` does
([variables](../bindings/variables/README.md),
[call statements](../functions/call-statements/README.md)); more forms land as the
language grows ([`spec/todo/`](../todo/README.md)).

JavaScript accepts `throw` at the top level of a module, and
[a module is a function](#a-module-is-a-function), so a block's rule
([functions](../functions/README.md)) is the module's: after its imports and every
`const`, exported or not, `throw expression;` may stand where
`export default` would, in place of it and not beside it, and nothing
follows it. Such a module fails at every load and exports nothing: a module
that imports it fails to load too, as one importing a module that reads
`null.x` at load does, and a name imported from it is refused at link as
an export the module does not have. The graph outputs write it, as they
write a module holding `const c = null.x;`, since they evaluate none of it,
and the value outputs, which evaluate, refuse it as they refuse that module
([output](../command-line/output.md)).

## A Module Is a Function

A module is one function, and the compiler reads it that way. Its imports are
its parameters, in source order; its constants are the constants of its body;
and what it returns is the object of its exports
([exporting a value](exports/README.md)), `export default` being that
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
([`fjs/compiler/edag`](../../fjs/compiler/edag/module.f.mjs)). Two imports of one module
identity are one application, shared, as
[importing](imports.md) requires.

## Pages

- [Exporting a Value](./exports/README.md)
- [Importing Other Modules](./imports.md)

Refused by design, each page showing what `fjs compile` prints and what to write instead:

- [An Export That Binds Nothing Is Refused](./empty-pattern-export/README.md)
- [An Empty Statement Is Refused](./empty-statements/README.md)
- [An Export After `export default` Is Refused](./export-after-default/README.md)
- [`export let` Is Refused](./export-let/README.md)
- [Exporting `then` Is Refused](./exports/then/README.md)
- [An Import After an Export Is Refused](./import-after-export/README.md)
- [A Module With No Export Is Refused](./no-export/README.md)
- [A `throw` Beside an Export Is Refused](./throw-position/README.md)

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Modules](https://tc39.es/ecma262/#sec-modules)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export>
