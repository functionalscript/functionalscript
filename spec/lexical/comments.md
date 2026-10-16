# Comments

**Status:** implemented

Comments are [trivia](./whitespace.md). Their text does not
become an AST value, but the parser preserves line-terminator information
needed by JavaScript's grammar. A line break inside a block comment counts at
a restricted boundary too, such as after `return` or `throw`, or before `=>`
([functions](../functions/README.md)).

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
string ([line terminators](./whitespace.md)): JavaScript
ends a line comment at either, so what follows one is code there and never
comment text here, and reads either inside a block comment as a line break.

Block comments carry JSDoc/TypeScript type declarations, which is why the
language has them: a `.f.js` file is type-checked as JavaScript, and JSDoc is
how it says what its types are.

A comment can separate tokens where whitespace can, which is between any two
([trivia](./whitespace.md)). At unrestricted boundaries, the
`;` that ends a statement may follow a comment on the same line or a later
one ([module structure](../modules/README.md)), as any other token may. This
does not make newlines interchangeable with spaces at restricted boundaries,
nor a comment with a newline: where a statement omits its `;`, the next one
begins a new line only if a newline stands between them — inside a block
comment, or ending a line comment — as JavaScript counts it.

Comments belong to the module language. A `.json` input containing one is an
error, because JSON has no comments.

## Examples

The compiler demo offers the programs `comments` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Comments](https://tc39.es/ecma262/#sec-comments)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#comments>
