## utf16-error-tag. `fromCodePointList` encodes a UTF-16 error tag as bytes that are not UTF-8

**Priority:** P3
**Status:** open

### Problem

`fromCodePointList` answers an unpaired surrogate with bytes no UTF-8 decoder
accepts, and reports nothing:

```js
import { stringToCodePointList } from '../utf16/module.f.mjs'
toArray(fromCodePointList(stringToCodePointList('\uD800')))
// [0xf5, 0xa0, 0x80]
```

`stringToCodePointList('\uD800')` tags the surrogate with `errorMask`
(`0x8000_D800`), as its contract says. `codePointToUtf8` reads any
`errorMask`-tagged value as one of the UTF-8 *decoder's* own error tags and
re-emits the partial sequence it names. `0xD800` has bit `0x8000` set, which is
`errorLead4Cont2Flag`, so the surrogate comes out as the three bytes of a broken
four-byte sequence, led by `F5`, a byte that never begins UTF-8. A lone low
surrogate `\uDC00` gives `f5 b0 80` the same way.

The two codecs share one `errorMask`, but the payload under it means different
things: bytes read so far for UTF-8, a 16-bit code unit for UTF-16. The encoder
cannot tell them apart. That is the silent wrong value
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids.

The [demo](../demo.f.mjs) found it, and works around it by checking
`isValidCodePoint` before encoding.

### Proposal

Decide what the UTF-8 encoder does with a code point it cannot encode that is
not one of its own decoder's tags: refuse it, or emit `U+FFFD` (`ef bf bd`),
which Unicode recommends for ill-formed input. Either way, the tag has to say
which codec produced it, or the UTF-8 re-emit path has to be limited to the tags
its own decoder makes.

### Tasks

- [ ] decide refuse vs. `U+FFFD`, and document it where `errorMask` is defined
- [ ] make `codePointToUtf8` stop re-emitting a UTF-16 tag as UTF-8 bytes
- [ ] add the inputs above to `proof.f.mjs`
- [ ] drop the demo's `isValidCodePoint` check if the encoder now refuses

### Related

- [666-utf16-encode-errormask](../../todo/666-utf16-encode-errormask.md): the
  same shared `errorMask` contract, seen from the UTF-16 encoder
