# Token Symbols

Symbols for the layer above a tokenizer: the tokenizer consumes code points
and emits tokens, and the parser above it consumes one input symbol per
token ([`../ll1`](../ll1/README.md), "A token layer resumes the parser").
Token categories may map to single ASCII symbols and single-character
operators to themselves, but a multi-character operator (`>>>=`) and a
keyword (`instanceof`) have no such symbol. `encoding()` hands them one.

The `token_symbol/` layer of [`fjs/ebnf`](../README.md), moved from the
classical `fjs/bnf/token_symbol` with two things rethought on the way:

- **A symbol is a rule.** A number is a rule of one symbol in the EBNF
  front end, so the value `encode` returns is at once what a tokenizer
  emits and the terminal a grammar names the token by. The classical
  module returned a bare symbol that had to be wrapped as a range before a
  rule could name it, and a symbol and a range were both plain numbers, so
  passing one where the other belonged was no type error.
- **No capacity.** The classical range ran to the last symbol of a packed
  codec, and a list longer than that was refused. The EBNF domain is the
  non-negative safe integers, and no array is long enough to carry an
  alphabet past that ceiling, so there is nothing to check.

## Symbol range

From `0x110000`, one past the last Unicode scalar value, upward: a token
symbol is numerically disjoint from a code point even though the two
alphabets belong to different layers — the layers meet in error messages
and debugging output, where one number space is worth more than 1.1M extra
symbols nobody needs. The end of input is not a symbol of either alphabet
and needs none from this space.

## Why a registered alphabet

The alternative was an *intrinsic* encoding: derive the symbol from the
string alone by packing its characters positionally, so no alphabet has to
be registered and decoding needs no table. It was rejected because packing
bounds a name's length — `instanceof` does not fit any base a symbol can
hold — and an intrinsic encoding for operators plus a registered one for
keywords would mean two mechanisms and two ways for a symbol to be wrong,
for no gain over the one that covers both.

This also settles a question the parser design left open: keywords **can**
be distinct terminal symbols, because a registered name has no length
limit. Only the number of names is bounded, and by the array, not by this
module.

## Why positional assignment

Symbols come from a name's index in the list. The alternative was hashing
the name with a seed and rejecting the encoding on a collision, which makes
symbols independent of list order — appending or reordering names preserves
them.

Positional assignment won on simplicity: construction always succeeds for a
valid list, there is no seed to manage and no collision to retry, and
decoding is an array index rather than a registered reverse table. The cost
is that the list is append-only — inserting or reordering names shifts every
symbol after the edit. That is acceptable because nothing persists a token
symbol: symbols are built with the grammar, live as long as a parse, and are
never serialized. Should they ever be written to a file, order independence
would matter and the hash strategy is the way back.
