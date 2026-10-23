# JavaScript

`fjs/js` holds JavaScript's own facts, each written once: which words are
keywords, what an identifier is, how a string is escaped, which built-in
functions and prototype members exist, and how JavaScript text is cut into
tokens. They cover the part of JavaScript the repository reads and writes,
not all of it: `identifier` admits ASCII names only, and the tokenizer does
not read every string escape, such as `\x41`. FunctionalScript is a subset of
JavaScript, so every part of the repository that reads, checks or writes
JavaScript asks these modules instead of keeping its own copy. A list kept in two places drifts, and then the
compiler and the RTTI printer disagree about whether `enum` is a keyword.

None of this is the FunctionalScript language itself. The rules of the subset
live in [`fjs/compiler`](../compiler/README.md) and the language reference in
[`spec`](../../spec/README.md); this directory is the JavaScript those are a
subset of.

## How text becomes a program

```text
JavaScript text
  --tokenizer-->            JsToken stream                 (js/tokenizer)
  --compiler/tokenizer-->   the compiler's tokens          (compiler)
  --compiler/parser-->      a resolved source module       (compiler)
  --js/ast/sugar-->         Foundation AST                 (js/ast)
  --edag/from_fast-->       the expression graph           (edag)
```

The first and fourth stages are here, and `compiler/edag` runs the last two.
The token stream is shared: the compiler folds it once more into its own
tokens, and the website's demos read it as it is to colour source text.

## The modules

|Module                                      |Holds                                                                       |Used by                                      |
|--------------------------------------------|----------------------------------------------------------------------------|---------------------------------------------|
|[`tokenizer`](./tokenizer/README.md)        |`tokenize`: text to a stream of `JsToken`s, or the first lexical error      |compiler, website demos                      |
|[`keywords`](./keywords/README.md)          |the reserved words, literal words and reserved globals, and `isKeyword`     |compiler, ebnf, rtti, website                |
|[`identifier`](./identifier/README.md)      |`isIdentifier` and its start and part classes                               |compiler, rtti, emergent_testing, text/marked|
|[`string_escape`](./string_escape/README.md)|the escape sequences, and `stringLiteral`, the one writer of a quoted string|compiler, media/json, types/ts, ci           |
|[`array_index`](./array_index/module.f.js)  |`arrayIndex`: whether a property key names an array element                 |rtti, edag                                   |
|[`prototype`](./prototype/README.md)        |the own property names of the seven built-in prototypes                     |compiler, edag, nanvm                        |
|[`static`](./static/README.md)              |the static functions a module may call, such as `Object.is`                 |compiler, edag, nanvm                        |
|[`members`](./members/module.f.js)          |the member functions of the built-in types, as one table                    |none yet; executors will be generated from it|
|[`intrinsic`](./intrinsic/module.f.js)      |the primitives no function body can define: `slice`, `charCodeAt`           |compiler, edag                               |
|[`runtime`](./runtime/README.md)            |the built-in functions, defined once for every executor                     |compiler, edag, nanvm, effects/node          |
|[`ast`](./ast/README.md)                    |the Foundation AST, the compiler's intermediate representation              |compiler, edag, nanvm, rust                  |

## Related

- [`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs) is the token grammar the
  tokenizer reads with.
- [`doc/DESIGN.md` §13](../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)
  is the principle behind "each written once".
