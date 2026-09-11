# DataJS

The codec for [DataJS](../../../spec/datajs/README.md): JSON with sharing
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

The reader is [`parser/module.f.mjs`](./parser/module.f.mjs), the writer
[`serializer/module.f.mjs`](./serializer/module.f.mjs), and the value types
are in [`types.ts`](./types.ts). What remains of the codec is two issues:
the byte path, in
[`todo/parser-serializer.md`](./todo/parser-serializer.md), and what the
writer still owes, in
[`todo/serializer.md`](./todo/serializer.md). The codec's proofs come
from the conformance corpus, [`spec/datajs/vectors`](../../../spec/datajs/vectors/README.md);
[`vectors/`](./vectors/module.f.mjs) holds the record types the corpus is
typed with and `difference`, the sharing-aware comparison a proof over it
uses.

## The writer reads the value into a graph first

```text
unknown
   |
   v
read                      serializer/module.f.mjs, one traversal: classify, validate from
   |                      property descriptors, and read every container once
   v
link                      the host objects replaced by node indices, in post-order
   |                      a reference forwards is a cycle, which is refused here
   v
write                     the shared nodes as const statements, then export default
   |
   v
DataJS text
```

A document denotes a DAG, so the writer cannot spell a value as it walks
it: a node more than one reference reaches has to become a `const`, and a
`const` has to precede every use of it. Neither is a question the walk can
answer while it is still walking, so the value is read into a flat graph
first and both become questions about data — which node index appears more
than once, and whether every reference points backwards.

That is also what makes the rules provable. No value FunctionalScript can
build carries an accessor, a non-enumerable property, an own property on an
array besides its elements, or a cycle, so each of those refusals is a
function over the descriptors, the names or the graph such a value *would*
have — `_memberValue`, `_elementNames` and `_link`, exported and proved
against that data directly. They carry the `_` prefix because that export is
linkage rather than API: `trySerialize` and `tryStringify` are what the
module promises.

## Nothing is read before it is known to be data

Reading the caller's graph means following its edges, and following an edge
on an ordinary enumerator reads the property, which invokes an enumerable
getter — the effect the data model refuses. So a container is taken as its
own property descriptors and only the values of the descriptors that
survive validation are followed. The same mechanism answers a question no
type can: a descriptor exists exactly when the property does, so
`{a: undefined}` is an object with a member where `{}` is not, and
`definedEntries`, which [JSON's walk](../json/serializer/module.f.mjs)
reads objects through, would drop it.

Container kind is settled before the descriptors, because descriptors
cannot settle it: `new Date()`, `new Map()`, `new Set()` and `new Number(1)`
each carry zero own property descriptors and zero own symbols, exactly as
`{}` does. A writer classifying by descriptors would write any of them as
`{}` — a document denoting something else, silently, which is what this
format refuses in place of `JSON.stringify`'s `null`.

## What the writer emits is normalized form

One line, a single space after `const`, `export` and `default` and nowhere
else, and a node hoisted exactly when more than one reference occurrence
reaches it — counted by occurrence rather than by root-to-node path, which
is the specification's own rule and the one a path-counting implementation
gets wrong. The consts are named `$0`, `$1`, … in emission order, which is
post-order, so a name is declared before it is used.

Normalized form being the only layout is why there is no separate
`tryNormalize`: the two would be one function. A readable layout is the
second writer the specification's freedom is for, and
[`todo/serializer.md`](./todo/serializer.md) is where it is tracked.

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
