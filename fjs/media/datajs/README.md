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

The public surface is [`module.f.mjs`](./module.f.mjs): `tryParse` and
`tryParseBytes` read a document into the value it denotes, `trySerialize` and
`tryStringify` write a value as one, and the value types are in
[`types.ts`](./types.ts). The reader lives in
[`parser/module.f.mjs`](./parser/module.f.mjs) and the writer in
[`serializer/module.f.mjs`](./serializer/module.f.mjs). Neither owes
anything further: both issues are retired into this file, which keeps what
they decided. The codec's proofs come from the conformance corpus,
[`spec/datajs/vectors`](../../../spec/datajs/vectors/README.md);
[`vectors/`](./vectors/module.f.mjs) holds the record types the corpus is
typed with and `difference`, the sharing-aware comparison a proof over it
uses.

## Every entry point is fallible, and the names say so

```text
fjs/media/datajs/
    module.f.mjs      the public surface: the four entry points below
    types.ts          Primitive, Unknown
    parser/           the reader — tryParse over code units, tryParseBytes over bytes
    serializer/       the writer — trySerialize as chunks, tryStringify as one string
    vectors/          the corpus's record types, and difference
```

A caller may legitimately hand a reader text that is no document, and a
writer a value its type cannot see the whole of, so each entry point returns
a `Result` and refuses rather than approximating — a reader says where the
parse failed or which rule the document breaks, a writer names what it could
not write:

```ts
export const tryParse:      (text: string)    => Result<Unknown, string>
export const tryParseBytes: (bytes: List<U8>) => Result<Unknown, string>
export const trySerialize:  (value: Unknown)  => Result<List<string>, string>
export const tryStringify:  (value: Unknown)  => Result<string, string>
```

**The writer takes the data model's `Unknown`, not `unknown`.** Its first
draft took `unknown`, on the ground that refusing what is outside the model is
the writer's job and a signature taking `Unknown` would assert what the writer
has to check. That left a gap nothing could close: a corpus set is a DataJS
data module, so no vector can carry a function, an accessor or a cycle, and
[`fjs/AGENTS.md`](../../AGENTS.md) §1.6 keeps host-built values out of a
`.f.mjs` proof, so the refusals only a host can reach had no proof but the one
over the data such a value would carry. Narrowing the parameter closes it. The
type is the contract at the call — a FunctionalScript caller cannot hand the
writer a value outside the model — and what the type cannot see is still
refused, a hole, a symbol key, an accessor, a non-enumerable property, an
extra own property on an array, a non-plain object, a cycle, because the
specification refuses each and a host that casts is owed a refusal rather
than a wrong document. The writer's proof hands it those values cast, as a
host boundary would.

The prefix is one decision for all four, taken when the surface landed: the
reader's two had landed bare, and renaming half of the names before the
surface existed would have been the inconsistency the surface exists to
settle. There is no `tokenizer/` — the grammar is the reader, below — and no
`tryNormalize`, because the one writer *is* the normalized one.

**The byte path is a conformance obligation, not a convenience.** Two rules of
the specification's §Encoding cannot be reached from a string at all — a
document **is UTF-8**, and it **has no BOM** — since by the time input is a
JavaScript string every byte sequence is some sequence of code units and a
leading BOM is one ordinary character among them. `tryParseBytes` decodes with
[`fjs/text/utf8`](../../text/utf8/module.f.mjs), refuses what is not correct
UTF-8, **refuses** a leading `EF BB BF` — a BOM makes the bytes invalid, it is
not something to strip on the way in, and stripping is exactly the defect the
corpus's vector catches — and then re-encodes to the code units the grammar
reads, so a four-byte scalar such as `😀` reaches the reader as the pair
`D83D DE00`. One reader over one alphabet; the bridge is the decoder's.

## One type-level trap in the value domain

`Unknown` is `Tree<Primitive>` over [JSON's tree type](../json/types.ts), with
`undefined` among the leaves, and the optional index signature of
`TreeObject<P>` makes **`{a: undefined}` and `{}` the same type** where the
specification makes them different documents:

```js
export default {"a":undefined};   // an object with one member
export default {};                // an object with none
```

Only the runtime enumerator tells them apart, which is a proof obligation on
each side rather than a note. The reader builds a member holding `undefined`
as a present property — through `Object.fromEntries`, which no type checks, so
its proof pins it. The writer reads an object through its own property
descriptors, not through `definedEntries`, which drops such a member before
any other seam runs, and not through `Object.entries`, which invokes a getter
while collecting its value — the next two sections say why that one mechanism
answers both.

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

Both passes keep the reader's depth contract, so a document the reader
accepts is one the writer writes back. The read walks an explicit stack, a
frame per container being read, as the reader's resolution does. The write
needs none: the linked graph is in post-order, so each node's chunks are
built from the chunks of nodes already built, and a reference to an inline
node is a thunk over that node's chunks, forced only as the document is read
out — which the list's iteration does without recursion.

Neither pass squares the number of containers. The set of containers entered
grows by one per container, and `new Set([...prev, value])` would copy every
container so far each time, so it is [`fjs/types/set`](../../types/set/module.f.mjs),
a persistent set whose add carries like a binary counter and costs a
logarithm amortized; and which nodes are shared is read off the sorted
reference occurrences rather than by an `indexOf` per occurrence. `fjs
compile` writes every module through this writer, which is why a document
with a hundred thousand containers has to be a second's work rather than a
minute's.

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
`tryNormalize`: the two would be one function. A readable layout — one
statement per line, indented containers, the default the specification
recommends for tooling — is the second writer that freedom is for, and it is
decided not to exist for now: normalized form is what the compiler and
hashing need, and nothing asks for another layout. When something does, it is
a new issue, and `tryNormalize` then names this writer.

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
