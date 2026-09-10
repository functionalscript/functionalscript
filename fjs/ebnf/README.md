# EBNF

A grammar is a value, and a parser is derived from it by a function. This
module holds the front end a grammar is written in, the serializable form it
lowers to, the LL(1) backend that reads that form, and the alphabets and
grammars built on them:

- [`module.f.mjs`](./module.f.mjs) — the functional front end: the `Rule`
  union and its constructors;
- [`data/`](./data/README.md) — the serializable `RuleSet`, the lowering
  `toData`, and what `validate` refuses;
- [`ast/`](./ast/README.md) — the typed tree a match produces, `Ast<R, I, O>`,
  and the metadata channel;
- [`ll1/`](./ll1/README.md) — the one backend: a predictive LL(1) machine on
  an explicit stack, folding a rewrite set into the parse;
- [`token_symbol/`](./token_symbol/README.md), [`byte/`](./byte/README.md),
  [`utf16/`](./utf16/) — the alphabets: token names as symbols above Unicode,
  bytes, UTF-16 code units;
- [`lib/`](./lib/) — grammars: JSON, DataJS, the JavaScript tokens.

A module belongs here iff it defines, transforms or executes grammars over a
symbol alphabet. `fsc` is a compiler, `js/tokenizer` a hand-written scanner
and `djs` a language front end: all three are consumers and stay out. The
alphabet adapters are dependencies of the front end, not parts of it.

It replaced the classical `fjs/bnf` — a functional front end without a
repetition primitive, a packed 24-bit terminal, and two backends, one of
them backtracking — by the migration
[DESIGN.md §11](../../doc/DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces) records as its
worked example, whose last stage deleted it. The design decisions below were
made along the way and in the issues it triaged; this file is their record.

## The rule union follows RTTI

Plain values are rules directly; a thunk always returns a tagged tuple.
Tagged tuples never appear in `Rule`, so a plain array is always a sequence.
In the names [`types.ts`](./types.ts) exports, abridged:

```ts
type Rule     = DataRule | Thunk
type DataRule = null | number | string | Tuple | Variant
type Tuple    = readonly Rule[]
type Variant  = { readonly [k in string]: Rule }
type Thunk    = Const<DataRule> | Set | Repeat<number, number, Rule>
type Const<R>             = () => readonly ['const', R]           // a plain rule behind a thunk
type Set                  = () => readonly ['set', ...number[]]   // one symbol from the set
type Repeat<Min, Max, R>  = () => readonly ['repeat', Min, Max, R] // min..max copies
```

Three word tags, the RTTI vocabulary; discrimination is by JavaScript type at
every level.

- **`number`** is one ordinary symbol: `0x61` is the letter. A rule typed
  `number` is never the end of input, which is what keeps `Ast<R>` monotonic
  in `R`.
- **`null`** is EOF, exported as `eof`. The *input* carries the end as `-1`,
  the alphabet's convention; the grammar spells it as its own value.
- **`string`** is the text it spells, one terminal per code point, whatever
  the alphabet: `'Hello'` matches `Hello`. An alphabet whose symbols are not
  code points names them with a constructor, as `fjs/djs/parser` does with
  `sym()`.
- **`['const', c]`** is RTTI's escape under RTTI's name, for a plain rule
  behind a thunk. Every recursive rule pays it; RTTI pays the same.
- **`['set', …]`** is a range set of ordinary symbols — a strictly increasing
  list of boundaries, half-open, canonical by construction
  ([`fjs/types/range_set`](../types/range_set/module.f.mjs)) — and the row a
  terminal lowers to. `range`, `set`, `union` and `remove` return one.
- **`['repeat', min, max, r]`** carries its bounds, so the optional, star,
  plus and exact count are values of `min`/`max` rather than separate forms.
  Both bounds are plain `number`, `Infinity` the unbounded value, and
  `min <= max`.

A tagged tuple written without its thunk is a legal rule with another
meaning, and `tsc` accepts it. That is accepted: the API never asks anyone
to write a tuple, and a lost thunk fails loudly, since the tag becomes text
the parser expects to consume. Making the representations disjoint with a
marker would cost the property the design rests on, that a rule is plain
data.

## Constructors are the API

`Info` tuples are what a lowering reads, not what an author writes. Every
repetition constructor builds the one `['repeat', min, max, rule]` tuple,
and each spells its bounds itself:

```js
export const repeat     = (a, b) => rule => () => ['repeat', a, b, rule]
export const repeatFrom = n => rule => () => ['repeat', n, Infinity, rule]
export const times      = n => rule => () => ['repeat', n, n, rule]
export const option     = rule => () => ['repeat', 0, 1, rule]

export const repeatFrom0 = repeatFrom(0)
export const repeatFrom1 = repeatFrom(1)
```

`repeatFrom` cannot be `repeat(n, Infinity)`: `repeat` refuses a bound that
is not a literal, so that a repetition's type carries its bounds, and
`Infinity` has no literal type — it is `number`, which is what marks a
repetition unbounded to `BoundedArray` and to a map keyed by rule types
([`types.ts`](./types.ts), `Infinity`). `times` and `option` are spelled the
same way rather than as partial applications of `repeat`, each with its own
named type, `Times<N, R>` and `Option<R>`; `repeatFrom0` and `repeatFrom1`
are the partial applications.

`join(separator)(item)` spells a separated list, taking its separator as a
rule; `literals(words)` builds the prefix tree of a word list, so a
punctuator set is one LL(1) rule; `range`, `set`, `union` and `remove` build
terminals, and `unicodeMax` names the top code point for a complement over
the whole range.

## The AST is a function of the form

What matching a rule produces depends on the rule's form alone, one row per
form, and [`ast/types.ts`](./ast/types.ts) is the type-level statement of
the table. `I` is the input's metadata, `O` the output alphabet's, and
`Ast<r>` here abbreviates `Ast<r, I, O>`:

| form | AST |
|---|---|
| `['const', c]` | `Ast<c>` — the thunk and its payload are one rule |
| `['set', …]` | `Meta<I>` — one symbol leaf |
| `['repeat', min, max, r]` | `BoundedArray<min, max, Ast<r>>` — every length from `min` to `max`, one flat array whatever the bounds |
| `n`, a number | `Meta<I, n>` — one symbol leaf, the literal kept |
| `null` | `readonly []` — EOF consumes no source element and contributes no leaf |
| `string` | `readonly Ast<number>[]` — one leaf per code point, `''` being `readonly []` |
| `Tuple` | a tuple, one node per element |
| `Variant` | `[tag, node]` of the branch taken |

A leaf is a `Meta<I>`, an object holding the symbol and what the grammar
ignored about it, carried through from the input — a string's leaves
included, which are never bare numbers. A mapping of the rewrite set
replaces any subtree with one `Meta<O>` — a symbol of the next alphabet,
its value in the metadata — as the node comes into existence, so a layered
parser is a grammar per layer and a mapping into the next alphabet
([`ll1/`](./ll1/README.md)). The rows in full, with what each admits once
mapped, are [`ast/`](./ast/README.md)'s table.

## Terminals and EOF

A terminal is a semantic symbol, and the domain is

```text
EOF              = -1
ordinary symbols = 0 .. 2^53 - 1
```

`-1` is outside the non-negative domain, so EOF does not depend on how wide
a symbol is, and no alphabet — code points, bytes, token symbols — gives up
one of its own values for it. A set holds ordinary symbols only; the
lowering intersects every set with the domain, so no set terminal matches
EOF, and "newline or end of input" is the variant `{ nl, eof }`, a choice
with a tag rather than a set. The boundaries are safe integers because the
closed range `a..b` is the half-open `[a, b + 1]`, and `b + 1` is exact only
below `2^53`; a larger domain is [bigint-symbols](./terminal/todo/bigint-symbols.md)'s.

### Logical EOF in parser input

Callers and alphabet adapters supply ordinary symbols only and never append
`-1`. The backend synthesizes one logical EOF after the last symbol, so a
grammar that ends in `eof` is matched against the whole input and a grammar
that does not stops where its rule does. The indices a match reports are the
input's: consuming EOF is progress, but it has no element, so it does not
move an index past the length. Whether the caller should supply EOF instead
is [eof-as-ordinary-symbol](./terminal/todo/eof-as-ordinary-symbol.md).

## What a lowering does

[`data/`](./data/README.md) validates at the front end, while the author
still has a rule to point at: bounds in their domain; a set validated as a
range set, clipped to the domain and non-empty; a nullable body under an
unbounded repeat refused, since it never terminates, where a bounded one is
the item's ambiguity to resolve as any variant's is. Rule identity survives
the lowering — the name map it returns is keyed by the rule the author holds
— which is what lets a rewrite set be keyed by rule rather than by a name
nobody wrote.

## Left for later

- A separated repeat as a primitive — a flat item list, separators dropped —
  would remove `join`'s option-and-repeat scaffolding; comma lists dominate
  the JSON and DJS grammars. It needs a data form that can represent it.
- What the backend leaves for later is in [`ll1/`](./ll1/README.md#left-for-later),
  and the issues under [`todo/`](./todo/) and the alphabets' `todo/`
  directories hold the rest.
