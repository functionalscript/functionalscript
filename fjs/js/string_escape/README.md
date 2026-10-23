# String escapes

JavaScript's escape sequences, and the one function that writes a quoted
string. [`module.f.mjs`](./module.f.mjs) holds them, so the tokenizer that
reads `"\n"` and every printer that writes one agree on what it means.

|Export             |Holds                                                                                            |
|-------------------|-------------------------------------------------------------------------------------------------|
|`simpleEscapes`    |the escapes whose meaning is one fixed code point: `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`|
|`escapeToCodePoint`|the code point a simple escape's letter stands for                                               |
|`codePointToEscape`|the reverse: the escape letter for a code point, where it has one                                |
|`optionalEscape`   |`/`, the one escape a reader must accept and a writer never produces                             |
|`stringLiteral(s)` |`s` as a double-quoted JavaScript (and JSON) string literal                                      |

```js
import { stringLiteral } from './module.f.mjs'

stringLiteral('a"\n') // '"a\\"\\n"', the text "a\"\n" with its quotes
```

`\uXXXX` is not a simple escape: its meaning is computed from its digits, so
the tokenizer decodes it rather than looking it up. `stringLiteral` writes
JSON-compatible output, which is why [`media/json`](../../media/json/serializer/module.f.mjs)
and the generated `package.json` in [`ci`](../../ci/README.md) use it too.
