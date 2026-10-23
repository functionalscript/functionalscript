# UTF-8

Bytes to code points and back, lazily, over `List<U8>`. The byte-format and
error tables are in the [text README](../README.md#utf-8); this page is about
which function to call.

## Where to start

Most callers hold a string or a list of bytes and want the other one.

```js
import { stringToU8List, fromU8List, u8ListToString } from './module.f.mjs'

stringToU8List('hé€😀')          // 68 c3 a9 e2 82 ac f0 9f 98 80 (as a List)
fromU8List([0x68, 0xc3, 0xa9])    // 'hé'
fromU8List([0xc3])                // null: a lead byte with no continuation
fromU8List([0xed, 0xa0, 0x80])    // null: a surrogate is not UTF-8
u8ListToString([0xc3])            // a string anyway: unchecked
```

Pick the decoder by what a bad byte should do:

| Function | Input | Bad input |
|---|---|---|
| `fromU8List` | `List<U8>` | `null` |
| `fromVec` | a `Vec` of whole bytes | `null`, also for a `Vec` that is not whole bytes |
| `u8ListToString` | `List<U8>` | decoded anyway, as an error code point |
| `utf8ToString` | a `Vec` | decoded anyway, as an error code point |

Use a checked decoder for anything that comes from outside. The unchecked ones
are for bytes this program wrote itself.

## Code points

`toCodePointList` and `fromCodePointList` are the streaming layer the functions
above are built on. A malformed sequence decodes to a code point tagged with
`errorMask`, and `fromCodePointList` encodes such a value back to the same
bytes, so bytes to code points to bytes loses nothing.
`utf8ByteToCodePointOp`, `utf8EofToCodePointOp` and `utf8StateToError` are the
state machine itself, for a caller that drives the decode step by step.

The shared code-point predicates and the `CodePoint` type live in
[`code_point`](../code_point/README.md). Encoding a whole string as a bit
vector is `utf8` in [`text/module.f.mjs`](../module.f.mjs).

## See also

- [`demo.f.mjs`](./demo.f.mjs): type text and see each code point's bytes.
- [`todo/`](./todo/): known gaps, such as how a lone UTF-16 surrogate is
  encoded.
