# Token Symbols

Symbols for the parser layer of a [layered parser](../todo/layered-parser.md):
the tokenizer consumes code points and emits tokens, and the parser above it
consumes one input symbol per token. Token categories map to single ASCII
symbols (`i` for identifier, `0` for number) and single-character operators map
to themselves, but multi-character operators (`>>>=`) and keywords
(`instanceof`) have no such symbol. `encoding()` hands them one.

## Symbol range

`0x110000`–`0xFFFFFE`, about 15.6M symbols: above the last Unicode scalar value
(`0x10FFFF`) and up to the last ordinary symbol (`0xFFFFFE`, the top of
`fullRange`). `eof` is `-1` and needs no symbol out of this space.
Token symbols are numerically disjoint from code points even though the two
alphabets belong to different parser layers — the layers meet in error messages
and debugging output, where one number space is worth more than 1.1M extra
symbols nobody needs.

## Why a registered alphabet

The alternative was an *intrinsic* encoding: derive the symbol from the string
alone by packing its characters positionally, so no alphabet has to be
registered and decoding needs no table. It was rejected because 24 bits hold
only four characters even over a 6-bit alphabet, and keywords are longer than
that — `instanceof` cannot be packed under any base. An intrinsic encoding for
operators plus a registered one for keywords would mean two mechanisms and two
ways for a symbol to be wrong, for no gain over the one that covers both.

This also settles a question the parser design left open: keywords **can** be
distinct terminal symbols, because a registered name has no length limit. Only
the number of names is bounded.

## Why positional assignment

Symbols come from a name's index in the list. The alternative was hashing the
name with a seed and rejecting the encoding on a collision, which makes symbols
independent of list order — appending or reordering names preserves them.

Positional assignment won on simplicity: construction always succeeds for a
valid list, there is no seed to manage and no collision to retry, and decoding
is an array index rather than a registered reverse table. The cost is that the
list is append-only — inserting or reordering names shifts every symbol after
the edit. That is acceptable because nothing persists a token symbol: symbols
are built with the grammar, live as long as a parse, and are never serialized.
Should they ever be written to a file, order independence would matter and the
hash strategy is the way back.
