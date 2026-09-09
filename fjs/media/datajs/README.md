# DataJS

The reader for [DataJS](../../../spec/datajs/README.md): JSON with sharing
and the leaves JSON cannot carry, written as a JavaScript module of `const`
statements and one `export default`.

```text
DataJS text
   |
   v
grammar                   fjs/ebnf/lib/datajs, over JSON's rules, read over UTF-16 code units
   |
   v
fold                      parser/mappings, one rewrite set folded into the parse by fjs/ebnf/ll1
   |                      a node per value: a leaf, a container, a reference by name
   v
resolution                parser/parse: the statements in order, each const bound to its value
   |
   v
Unknown                   the graph the document denotes, sharing included
```

The reader is [`parser/module.f.mjs`](./parser/module.f.mjs); the value
types are in [`types.ts`](./types.ts). What remains of the codec — the byte
path, the serializer and normalized form — is
[`todo/parser-serializer.md`](./todo/parser-serializer.md).

## The grammar is the reader

There is no tokenizer and no container machine: the grammar in
[`fjs/ebnf/lib/datajs`](../../ebnf/lib/datajs/module.f.mjs) is parsed by the
LL(1) backend with a mapping per rule folded into the parse, the way
[JSON's reader](../json/README.md) is. What DataJS reuses of JSON's is
therefore rules and their mappings rather than functions: the `string` rule
and its mapping are JSON's own, so a DataJS string is a JSON string with the
same escapes decoded the same way, and the integer core of a number is
JSON's, with the bigint suffix and the `Infinity` word beside it.

## Where each rule of processing lives

The specification names three things a reader does after grammar
recognition — refuse a plain string key decoding to `__proto__`, bind a name
at most once, and resolve a reference against the names declared before it.
A mapping sees one value and no environment, which splits them:

- the key rule needs no environment, so the fold applies it: a member whose
  string key decodes to `__proto__` gets a refusal in its value's place,
  where the resolution meets it in document order;
- the other two need one, so the resolution applies them, reading the
  statements the fold left in the document's tree in order — a `const`
  binds its name after its value is resolved, so a name is not in scope in
  its own value.

Whichever rule a document breaks first in document order is its error.

## Sharing is reference identity

A reference resolves to the very value its `const` was bound to, so
`const $0=[];export default [$0,$0];` reads back as one array in two slots,
and every container written out is a node of its own:
`export default [[],[]];` is two arrays. Nothing is interned.

## Resolution walks an explicit stack

The fold applies a mapping in the machine's own loop, so nesting costs it
no call stack; the resolution walks the fold's nodes the same way, a frame
per container being built, so 5,000 levels of brackets resolve with a
reference at the bottom as they parse with a leaf there.
