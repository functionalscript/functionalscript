# Source Text

**Status:** implemented

Every file `fjs compile` reads — the input and every module or document it
imports, directly or not — is UTF-8 text, as a JavaScript host reads a module
or a JSON import, and every output is written in UTF-8. Any character beyond
ASCII, one beyond U+FFFF included, may stand raw in a string, and any but
U+2028 and U+2029 in a comment ([comments](../lexical/comments/README.md)); it is the code point
its bytes encode, exactly as JavaScript reads it: `export default "é中😀";`
is a string of three code points, four UTF-16 code units. Everywhere else the
text is ASCII ([identifiers](../lexical/identifiers/README.md),
[whitespace](../lexical/whitespace/README.md)).

A byte order mark is refused, although a JavaScript host strips it:
`EF BB BF` decodes to U+FEFF, which is not whitespace here, so a module or a
`.json` document beginning with one is an error, as a
[DataJS](../datajs/README.md#encoding) document with one is.

Bytes that are not correct UTF-8 are not text, and a file holding them —
anywhere, a string or a comment included — is refused, naming the file:
`a.f.js - error: not UTF-8 text`. Decoding them anyway would give a raw `FF`
in a string U+00FF where a JavaScript host reads U+FFFD, a different value.

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Source text](https://tc39.es/ecma262/#sec-source-text)
