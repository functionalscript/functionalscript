# Lexical Grammar

A module is a sequence of tokens — words, numbers, strings and punctuators —
with trivia between them: whitespace, newlines and [comments](./comments.md).
Trivia only separates tokens, and at a boundary JavaScript restricts it also
says whether a line break stands there. The literal tokens are specified with
their values — [numbers](../README.md#numbers), [bigints](../README.md#bigints), [strings](../README.md#strings)
— and this section gives the characters between tokens and the spelling of a
word.

## Pages

- [Whitespace and line terminators](./whitespace.md)
- [Comments](./comments.md)
- [Identifiers](./identifiers.md)
- [String escapes and quotes](./string-escapes.md)
- [Numbers](../README.md#numbers) and [bigints](../README.md#bigints), by value

## Reference

- ECMA-262: [ECMAScript language: lexical grammar](https://tc39.es/ecma262/#sec-ecmascript-language-lexical-grammar)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar>
