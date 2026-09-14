# Import Attributes: `type: "text"`

```js
import license from './LICENSE' with { type: "text" }
export default { license }
```

A file that is not a module is imported with an attribute naming its type.
`"json"` is in the language
([importing](../README.md#importing-other-modules)): the attribute JavaScript
requires of a JSON import, read by the JSON reader, and refused where it
disagrees with the extension. `"text"` is the other end of the same clause,
and arrives on another schedule: it is Stage 3 and no engine has it yet, so
the parser must not get ahead of it.

## `type: "text"`

A text import is a file read as a string, and a string is a DJS value — so
this is the second reader the clause selects, next to JSON, and the cheapest
one: no tokenizer, no parser, no `AstModule`. The file's bytes decode as UTF-8
into one leaf value.

It is [TC39's import-text proposal](https://github.com/tc39/proposal-import-text),
Stage 3 as of March 2026, and its rules are the ones to take: the decoding is
UTF-8 with no way to ask for another encoding, so a file that is not UTF-8 is
an error rather than a mojibake string. The sibling
[import-bytes](https://github.com/tc39/proposal-import-bytes) proposal
(`type: "bytes"`, a `Uint8Array`) is what a non-UTF-8 file would go through,
and is a separate question here — DJS has no byte-array value.

`type: "text"` is not a language claim — it says the file is not parsed at
all — so whether it has to agree with an extension, as `type: "json"` does, is
an open question. Taking the bytes of `./LICENSE`, of a `.txt`, or of a
`.f.js` is the same operation, and the proposal's own example imports a file
no extension rule would recognize; whatever JavaScript settles on is what to
follow.

**Not implemented by engines yet.** Node 22 answers
`ERR_IMPORT_ATTRIBUTE_UNSUPPORTED` for `type: "text"`, so a module using it
does not load today. That is the reverse of the `"json"` case, where the
parser was behind the engines: here the parser would be ahead of them, which
is a principle-2 hazard of its own — a module the compiler accepts that no
engine runs. Landing `"text"` therefore waits on Stage 4 and shipping
implementations.

## Notes

- The serializer never emits an `import`, so this is a parser-side feature
  only: the parser reads the attribute's value as a word and knows `json`
  ([`fjs/fsc/parser`](../../fjs/fsc/parser/module.f.mjs)), and the readers
  choose by the import's `json` flag
  ([`ast/types.ts`](../../fjs/fsc/ast/types.ts)). A `"text"` import needs a
  third reader, which is no reader at all: the file is not parsed, so it has
  no imports to resolve.
- `import type` ([namespace-import](./2220-namespace-import.md)) is a separate
  clause on the same statement and is unaffected.

Depends on [import](../README.md#importing-other-modules).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_attributes
and the TC39 [import attributes](https://github.com/tc39/proposal-import-attributes)
proposal.
