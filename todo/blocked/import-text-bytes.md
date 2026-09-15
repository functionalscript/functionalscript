## Import attributes `type: "text"` and `type: "bytes"`

**Priority:** P5
**Status:** blocked

### Problem

```js
import license from './LICENSE' with { type: "text" };
import icon from './icon.png' with { type: "bytes" };
export default { license, icon };
```

A file that is not a module is imported with an attribute naming its type.
`"json"` is in the language
([spec: importing](../../spec/README.md#importing-other-modules)): the one
type ECMAScript defines, required of a JSON import and refused where it
disagrees with the extension. `"text"` and `"bytes"` are the other end of the
same clause, and neither is standard:

|Type|TC39|Node|
|-|-|-|
|`"json"`|ECMAScript 2025|shipped; the attribute is required|
|`"text"`|[import-text](https://github.com/tc39/proposal-import-text), Stage 3 since March 2026|`--experimental-import-text` since 26.5, July 2026; off by default|
|`"bytes"`|[import-bytes](https://github.com/tc39/proposal-import-bytes), Stage 2.7|none: it needs immutable `ArrayBuffer`s, which V8 lacks|

Deno and Bun ship `"text"`, and Bun `"bytes"`. A module using either does not
load on a stock Node, which is the principle-2 hazard the other way round from
`"json"`, where the parser was behind the engines: here it would be ahead of
them, accepting a module no engine runs.

### Trigger

The import-text or the import-bytes proposal reaches Stage 4, and Node ships
the type without a flag. Either type may land alone.

### Proposal

- A text import is the file decoded as UTF-8 into one string, a DJS leaf: the
  cheapest reader the clause selects — no tokenizer, no parser, no
  `AstModule`, and no imports to resolve. Take the proposal's decoding rule
  as it lands: Node's experimental implementation maps invalid UTF-8 to
  replacement characters, as Bun and Deno do, rather than failing, so a
  non-UTF-8 file is a string there and the reader would have to say the
  same.
- A bytes import is a `Uint8Array` over an immutable buffer, which DJS has
  no value for; the reader waits on a byte-array value.
- Whether `"text"` and `"bytes"` have to agree with the extension, as
  `"json"` must, is an open question: neither is a language claim — the file
  is not parsed at all — and the proposal's own example imports `./LICENSE`,
  a file no extension rule recognizes. Follow what the engines settle on.
- The parser reads the attribute's value as a word and knows `json`
  ([`fjs/fsc/parser`](../../fjs/fsc/parser/module.f.mjs)); the readers
  choose by the import's `json` flag
  ([`fjs/fsc/ast/types.ts`](../../fjs/fsc/ast/types.ts)). A new type is a
  new word there and a new reader in `fjs/fsc/transpiler` and
  `fjs/fsc/edag`.

### Related

- [spec: importing](../../spec/README.md#importing-other-modules) — the
  `"json"` attribute as the language has it.
- [namespace-import](../../spec/todo/2220-namespace-import.md) — `import type`
  is a separate clause on the same statement and is unaffected.
- [MDN: import attributes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_attributes),
  the TC39 [import attributes](https://github.com/tc39/proposal-import-attributes)
  proposal.
