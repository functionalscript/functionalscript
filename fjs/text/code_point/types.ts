/**
 * The Unicode code-point type shared by the UTF-8 and UTF-16 codecs.
 *
 * @module
 */

/**
 * A Unicode code point as the codecs pass it. Not every value is a valid
 * scalar; the domain has three parts:
 *
 * - a scalar value — `0x0000`–`0x10_FFFF` minus the surrogates, which is what
 *   `isValidCodePoint` from `./module.f.mjs` accepts;
 * - an untagged value no scalar can be — a surrogate (`0xD800`–`0xDFFF`) or a
 *   value above `0x10_FFFF` (up to `0x13_FFFF`). The UTF-8 decoder assembles
 *   these from well-shaped sequences without checking them (`ED A0 80` gives
 *   `0xD800`, `F4 90 80 80` gives `0x11_0000`); a consumer that needs a scalar
 *   gates on `isValidCodePoint`, as `utf8`'s `fromVec` does;
 * - an error value — a malformed unit tagged with `errorMask`. A decoder emits
 *   it in place of a code point, and an encoder turns it back into the units
 *   it stood for. The bit layout under the tag is specified by the "utf8 error"
 *   and "utf16 error" tables in `fjs/text/README.md`; naming it in code is
 *   `fjs/text/utf8/todo/error-tag-layout-constants.md`.
 */
export type CodePoint = number
