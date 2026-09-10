# The byte alphabet

The `ebnf/byte/` piece of [ebnf-migration](../../todo/ebnf-migration.md): the
adapter a grammar over bytes is written against, and the input such a
grammar reads. It is the byte half of
[unicode-rules](../../bnf/todo/unicode-rules.md), landed for its first
consumer, [git-objects](../../../todo/git-objects.md).

- `module.f.mjs` — `byte`, `not`, `bytes`, `symbols`, `meta`, `byteParser`,
  and `isByte`, the alphabet's membership for a consumer holding a `number`;
- `types.ts` — `Byte`, the metadata of a byte.

## What it is

The LL(1) backend already fits bytes: its symbols are non-negative safe
integers with EOF at `-1`, so a byte is an ordinary symbol and no byte has
to stand in for the end of input. What a byte grammar lacks is a spelling
for its terminals, because the front end spells a terminal as a code point
— a string lowers to one symbol per code point, and `set` and `range` read
their argument as text. Below `0x80` a code point and its byte coincide, so
`'tree '` and `set(' \n')` spell the bytes they look like and a byte grammar
uses them as they are. Above it the two part ways: `'é'` is one code point
and two UTF-8 bytes, and a rule spelled that way matches the byte `0xE9`
where its author may have meant `0xC3 0xA9` — a rule that matches and
means nothing.

So this module gives a byte grammar terminals of its own — `byte`, the
universe; `not`, its complement; `bytes(...)`, one of the bytes given, the
spelling for a byte above `0x7F` — and one reading of the input, `symbols`,
one `Meta<Byte>` per byte with one shared metadata record, in the shape of
[`../utf16`](../utf16/module.f.mjs).

## What `byteParser` refuses, and what it cannot

`byteParser(rule, set)` is `parser` from [`../ll1`](../ll1/README.md) behind
a check of the grammar against the alphabet, run before any input over the
identity map `toData` returns — the map is keyed by every rule the lowering
met, a string literal included, so the literal is checked as the text it is;
the one rule it does not key, a `const` thunk's payload, the check reaches
through the thunk:

- a **string** that is not ASCII;
- a **symbol** that is not a byte — negative, fractional, `-0`, or `256`
  and above;
- a **set** with a boundary outside `0..256`, or with an open tail — an odd
  number of boundaries runs to infinity from the last, so `['set', 256]`
  holds every symbol above the bytes and no byte. A boundary below `0` is
  refused because the lowering would clip it, so `['set', -1, 2]` would
  read as `[0, 2)`, a rule its author did not write; EOF is `null` in the
  front end and never reaches this check as a set.

What it cannot refuse is a text argument to `set` or `range` above `0x7F`.
Both constructors lower it eagerly, so `set('é')` reaches the map as the set
`[233, 234]`, which is `bytes(0xE9)` spelled another way and is accepted as
that. The rule for a byte grammar is therefore a convention this module
states and review holds: **a byte above `0x7F` is spelled through `bytes`
or as a number, never through the front end's text helpers.** The `Set`
type's phantom spelling still carries the constructor argument at the type
level, so a type-level refusal of a non-ASCII spelling is the next step if
the convention proves too weak.
