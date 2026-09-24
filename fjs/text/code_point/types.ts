/**
 * The Unicode code-point type shared by the UTF-8 and UTF-16 codecs.
 *
 * @module
 */

/**
 * A Unicode code point as the codecs pass it: either a valid code point
 * (`0x0000`–`0x10_FFFF`, 21 bits) or an error value — a malformed unit tagged
 * with `errorMask` from `./module.f.mjs`. The error tag is part of the domain:
 * a decoder emits it in place of a code point, and an encoder turns it back
 * into the units it stood for. The bit layout under the tag is specified by
 * the "utf8 error" and "utf16 error" tables in `fjs/text/README.md`; naming it
 * in code is
 * `fjs/text/utf8/todo/error-tag-layout-constants.md`.
 */
export type CodePoint = number
