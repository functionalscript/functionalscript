# Closed containers by default, then `option` as omission

**Priority:** P2
**Status:** open

Two stages, in this order:

1. a bare `Const` is **closed**; `open(c)` / `rest(c, r)` state otherwise;
2. `option` becomes a **nullary schema denoting absence**, so a member that may
   be omitted is `or(option, t)` rather than `or(t, undefined)`.

One issue rather than two, because stage 2 reads the acceptance tables stage 1
rewrites. In the other order every table, proof and consumer schema is rewritten
twice, and the intermediate state — omission already distinct while a bare
container is still open — has no consumer asking for it.

## Problem

### A bare `Const` is open, and nothing in the value model wants that

`../README.md` spends a section — "This is deliberate; please do not 'fix' it" —
defending open tuples against a check that was added in #1622 and removed again,
and `../validate/module.f.mjs`'s JSDoc repeats the defence as "**Do not add a
length check for tuples here.**" A default that has to be defended twice in prose,
against a contributor who keeps arriving at the opposite, is the wrong default.

The defence also understates its own cost. `../common/types.ts` types a success as
`CommonResult<Ts<T>, ValidationError>`, so the open tuple makes `validate`'s
success cast **unsound**:

```js
validate([42])([42, 'extra'])   // ['ok', [42, 'extra']]  statically readonly[42]
```

The caller is handed a two-element array whose static type says `.length` is `1`.
That is not "`Ts<T>` is incomplete" — that is a lie in a cast this module hands
out. `parse` escapes it only because it rebuilds; `validate` cannot.

The consumers already vote, and they vote by kind:

| module | bare `Const` schemas | `close(...)` | `option(...)` |
| --- | --- | --- | --- |
| [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) (tuple ADT) | — | 21 | — |
| [`../../../protocol/mcp/module.f.mjs`](../../../protocol/mcp/module.f.mjs) | all | 0 | 10 |
| [`../../../protocol/json_rpc/module.f.mjs`](../../../protocol/json_rpc/module.f.mjs) | all | 0 | 3 |

`edag` writes `close` on every node of its ADT; the protocol modules never write
it. Closed is the form the tuple consumer states 21 times and the form `Ts<>`
already renders.

### `option(t)` is `or(t, undefined)`, so absence is not describable

`option` is not a concept today — `../module.f.mjs` defines it as
`or(t, undefined)`, and absence is read as the value `undefined`. Three
consequences:

**A set the form cannot express.** `undefined` is a DJS value, so `{}` and
`{ a: undefined }` are two distinct DJS values. No schema separates them: a
declared key constrains the value *read* at it, an absent key reads `undefined`,
so every schema admitting one admits the other. For a module whose premise is
that a `Type` denotes a set of values, that is a completeness gap.

**The rule is already not uniform.** [`../data/README.md`](../data/README.md)
states the asymmetry itself: a *declared* key is checked as a value read, but an
*undeclared* key is checked as an **entry** — `{ props: { a: number }, rest: string }`
rejects `{ a: 1, b: undefined }` and accepts `{ a: 1 }`. The form can already tell
present-`undefined` from absent; it just cannot do so at a declared position.
Stage 2 does not introduce the distinction, it finishes it.

**Construction has no forced answer.** Given `{ a: number, b: option(string) }`
and `{ a: 1 }`, both `{ a: 1 }` and `{ a: 1, b: undefined }` are correct outputs
and `parse` picks one by fiat — with a real defect on the array kind, where the
pick does not survive JSON (`[42, undefined]` → `'[42,null]'` → rejected). That is
[parse-omits-undefined-members](./parse-omits-undefined-members.md), which stage 2
dissolves rather than decides.

TypeScript is on the other side of this already: this repo sets
`exactOptionalPropertyTypes: true` ([`../../../../tsconfig.json`](../../../../tsconfig.json)),
so `x?: string` and `x: string | undefined` are distinct there while RTTI conflates
them and renders the hybrid `{readonly "x"?: undefined|string}`.

## Proposal

### Stage 1 — a bare `Const` is closed

A bare `Struct` or `Tuple` admits **the members it declares and no others**. The
open form is stated, exactly as closedness is stated today, and by the same
mechanism: one primitive carrying the set every undeclared member belongs to.

```js
export const rest = (c, r) => () => ['rest', c, r]   // the primitive
export const open = c => rest(c, unknown)            // any undeclared member
```

`close` disappears: a bare `c` is `rest(c, never)` and needs no spelling. `never`
already exists as `or()`, which removes today's wart — `close(c, rest?)` uses
`undefined` as the sentinel for "no undeclared member", colliding with `undefined`
the const and forcing the `() => ['const', undefined]` escape hatch documented in
`../module.f.mjs`. With a required second parameter there is no sentinel and no
overload.

Renames follow through the ADT: the `'close'` tag becomes `'rest'`, and
`InfoClose`/`Close`/`_MakeClose`/`CloseTs` become `InfoRest`/`Rest`/`_MakeRest`/`RestTs`.

**The data form does not change.** `{ members, rest? }` already carries an
arbitrary rest and normalizes per kind, so this stage touches `toData`'s mapping
and nothing in the algebra — no `subset`, `cmp`, `equal`, union or
coverage-collapse rule moves. Which is the point: stage 1 is a decision about
which form is *unmarked*, not about expressiveness.

| schema | array kind | object kind |
| --- | --- | --- |
| bare `c` | `{ prefix }` | `{ props, rest: never }` |
| `open(c)` | `{ prefix, rest: unknown }` | `{ props }` |
| `rest(c, r)` | `{ prefix, rest: r }` | `{ props, rest: r }` |

One normalization consequence to pin rather than discover: `../data/README.md`'s
ordering caveat — a declared key whose set is the whole domain is dropped only
once the `rest` is gone — moves from the rare path to the common one. Bare
structs now carry `rest: never`, so `{ a: unknown }` is "objects with at most the
key `a`" and no longer collapses.

`option` is untouched by this stage: it still means `or(t, undefined)`, and
closedness is about *undeclared* members, so a declared key admitting `undefined`
stays omittable. `{ a: number, b: option(string) }` accepts `{ a: 1 }` and rejects
`{ a: 1, c: 2 }`.

**What `Ts<>` gains and what it loses.** `TupleTs` already renders the exact
tuple, so the tuple rendering becomes *accurate* and `validate`'s success cast
becomes sound. `StructTs` keeps rendering structurally open, because TypeScript has
no exact object type — so the struct rendering becomes an over-approximation. The
two are not equally bad, and the direction matters: a closed struct's accepted
value carries only its declared keys and so really does inhabit the rendered type
(the cast stays sound), while the rendered type additionally admits values the
schema rejects (a static type cannot certify acceptance). Today's tuple mismatch
runs the other way, which is the unsound one.

The prose that defends the old default is deleted, not softened: `../README.md`'s
"Structs and tuples are open", "This is deliberate; please do not 'fix' it" and
"Closed containers" sections, and `../validate/module.f.mjs`'s "Do not add a length
check" paragraph. The length check returns — now stated by the model rather than
inferred from `Ts<>`, which is what made #1622 wrong at the time.

#### Alternative considered: a kind-dependent default

Making a bare `Tuple` closed and a bare `Struct` open would leave `Ts<>` exact on
*both* kinds, match both consumers above with no migration at all, and match the
two opposite identity elements `../data/README.md` already documents (an open
struct needs no `rest`; an open tuple needs `rest: unknown`). It is what
TypeScript itself does.

Not taken: one rule that holds for every `Const` is worth more than a rendering
that is exact on both kinds, and "a bare container is closed" is a sentence a
reader can carry. The cost is paid where it is visible — the protocol structs say
`open` — rather than in a default that differs by the kind of container you happen
to be writing. Revisit only if the `open(...)` wrappers in the protocol modules
turn out to obscure more than the single rule buys.

### Stage 2 — `option` is the absent value

`option` is a nullary schema like `boolean` or `unknown` — `() => ['option']` —
denoting one thing: **the member that is not there**. It takes no argument and
wraps nothing; a member that may be omitted says so by union.

```js
{ a: or(option, number) }             // `a` may be absent, or a number
{ a: or(number, undefined) }          // `a` must be present, may hold `undefined`
{ a: or(option, number, undefined) }  // today's `option(number)`
[or(option, number), 3]               // position 0 may be a hole
```

Absence stops being a spelling of `undefined` and becomes a value in its own
right. Everything else follows from the representation the data form already
has.

**It costs one bit.** `unitList` in [`../data/module.f.mjs`](../data/module.f.mjs)
is a bitset over `null, undefined, false, true`; absence is a fifth member of
that kind — exactly as [`../data/README.md`](../data/README.md) describes
`or(true, false)` being the two boolean bits rather than a special rule. Union,
`subset`, `cmp`, `equal` and the coverage collapse are bitwise over that kind, so
**none of them change**. The whole absence rule is two `& unitBit(undefined)`
tests that become `& absentBit`:

| site | today | stage 2 |
| --- | --- | --- |
| `trimPrefix` | a trailing position restating a `rest` that admits `undefined` is dropped | …that admits absence |
| `objectMayOmit` | a key is omittable when its set admits `undefined` | …when its set admits absence |

That is the entire structural cost, and it is why this shape is preferred over
the wrapper `option(t)`: a wrapper is not a set of values, so it would have
needed a second syntactic category (`Member = Type | Option<Type>`, legal only
at a container position) and an `{ optional, node }` pair on every `props` entry
and `prefix` position, with every algebra function and its proof rewritten.

#### The four rules the bit needs

**`unknown` excludes it.** `unknown` is the set of DJS values and absence is not
one, so "anything, or nothing" is `or(option, unknown)`. That is the top of a
*declared member*, and it sharpens the ordering caveat `../data/README.md`
records: a declared key is droppable exactly when its set is `or(option, unknown)`
— a statement about one set, rather than about the `rest` having to be gone first.

**It is observable only at a container position.** No caller can hand `validate`
an argument that is not there, so a top-level schema admitting absence accepts
exactly what the rest of its union accepts. Nothing has to enforce this:
`unionValidate` is only ever reached with a present value.

**A `rest` never sees it.** A declared member is checked as the value *read* at
its position; a `rest` is checked against each *present* member. So the absent bit
in a `rest` constrains nothing and normalizes away on both kinds. This is not new
behaviour: `../parse` and `../validate` walk a value with `Object.entries`, which
skips holes, so `array(number)` accepts `[1, , 3]` today.

**Absence at a tuple position is "no such own index"** — past the end or a hole,
one rule for both. That makes the value side symmetric with the schema side
settled in #1712, where a hole in a *schema* is a declared `undefined` position.

#### What it means for the two hard spellings

Both cases that a wrapper design would have had to forbid are ordinary unions
here, with ordinary meanings:

| schema | accepts | rejects |
| --- | --- | --- |
| `[or(option, number), 3]` | `[, 3]` | `[undefined, 3]`, `[3]` |
| `or(option, number, string)` at a key | `{}`, `{ a: 1 }`, `{ a: 'x' }` | `{ a: undefined }` |

`or(option(number), string)` in the old spelling simply flattens to the second
row — `or` is union and the absent bit merges like any other.

Two sets also become expressible that neither today's design nor a wrapper can
say: `{ a: option }` is "objects with no `a`", and `open({ a: option })` is that
plus anything else — a negative field.

#### Rendering

`StructTs` renders a key whose set admits absence as optional, with the absent
bit stripped from what it prints: `or(option, number)` → `readonly a?: number`,
`or(number, undefined)` → `readonly a: number | undefined`. Under
`exactOptionalPropertyTypes` those are already distinct in TypeScript, so the
rendering becomes exact.

For tuples the trailing run renders optional with the absent bit stripped, and
that rendering is **exact** — the first time `TupleTs` and the schema denote the
same set. `Ts<[1, or(option, number)]>` is `readonly [1, number?]`, and
TypeScript agrees on every row (checked against this repo's `tsc`):

| value | the schema | `readonly [1, number?]` |
| --- | --- | --- |
| `[1]` | accepts | assignable |
| `[1, 2]` | accepts | assignable |
| `[1, undefined]` | rejects | `TS2322` |
| `[1, 2, 3]` | rejects (closed) | not assignable |

Reading position `1` still gives `number | undefined`, which is what JavaScript
gives for an index that may not be there, so the type is honest in both
directions. The exactness depends on `exactOptionalPropertyTypes` — with the flag
off, TypeScript accepts `[1, undefined]` at an optional tuple position too
(checked both ways) — and this repo already sets it.

It takes **both** stages. Stage 1 supplies the length: while a bare tuple is
open, an exact-length rendering is the unsound cast this issue opens with. Stage
2 supplies the element type: while `option(number)` is `or(number, undefined)`,
the position can only render `(number|undefined)?`, which admits the very
`[1, undefined]` the closed spelling should reject. Together they also make the
two renderers agree — today the runtime printer prints the open tail
(`readonly[number,(undefined|string)?,...readonly(unknown)[]]`,
`../ts/proof.f.mjs`) while `Ts<>` cannot, and afterwards both print
`readonly[1,number?]`.

An *interior* position admitting absence still renders `T | undefined` —
TypeScript forbids a required element after an optional one, and `undefined` is
what TypeScript reading a hole actually gives — so `[or(option, number), 3]` is
`readonly [number | undefined, 3]`. That one stays a rendering limit, not a
narrower set.

#### The trade, stated

Legal-but-degenerate spellings replace illegal ones. `array(or(option, number))`
and a top-level `or(option, number)` are meaningless rather than rejected: the
first normalizes to `array(number)`, the second accepts what `number` accepts.
For a set-theoretic form, normalizing beats forbidding — a wrapper would buy
those two errors at the price of a second syntactic category — but it is a trade,
and each degenerate spelling's normal form should be pinned by a proof so it
stays deliberate rather than incidental.

On the name: `option` is kept as proposed. It names the modality where `absent`
or `none` would name the value, but as the only spelling it is unambiguous, and
`or(option, number)` reads correctly. Do **not** reintroduce an `option(t)`
helper alongside it — one name, one thing.

## Tasks

Stage 1 (one PR):

- [ ] `../module.f.mjs`: `rest(c, r)` and `open(c)`; delete `close`. `'close'` →
      `'rest'` in `../types.ts`, with `InfoRest`/`Rest`/`_MakeRest`.
- [ ] `../data/module.f.mjs`: map a bare `Const` to `{ prefix }` / `{ props, rest: never }`
      and `open(c)` to the mirror. No algebra change — assert that in the PR.
- [ ] `../parse` and `../validate`: reject an undeclared member of a bare `Const`;
      the tuple length check returns.
- [ ] `../ts/types.ts`: `RestTs`; rewrite `TupleTs`'s doc comment — the exact
      rendering is now the model, not an approximation.
- [ ] `../README.md`: replace "Structs and tuples are open", "This is deliberate;
      please do not 'fix' it" and "Closed containers" with the closed default and
      the `open`/`rest` spelling; keep the `Ts<>` direction note above.
      `../validate/module.f.mjs`: delete the "Do not add a length check" paragraph.
- [ ] Migrate consumers: drop 21 `close(...)` in `../../../edag/module.f.mjs`;
      wrap the protocol structs in `open(...)`; audit the other 13 modules that
      import the schema surface (`fjs/media/*`, `fjs/mcp/*`, `fjs/ci/common`,
      `fjs/emergent_testing`).
- [ ] Proofs: the acceptance tables in `../parse/proof.f.mjs`,
      `../validate/proof.f.mjs` (37 `close` sites) and `../data/proof.f.mjs` (39).
- [ ] Changelog: **BREAKING CHANGES:** a bare `Struct`/`Tuple` schema is closed;
      `close(c, rest)` is `rest(c, r)`, and `open(c)` is the old bare form.

Stage 2 (one PR, after stage 1 lands):

- [ ] `option` as a nullary schema in `../module.f.mjs`/`../types.ts` — a new
      `Tag0`, so `visit`'s `Visitor` in `../common/module.f.mjs` gains the case.
- [ ] `../data/module.f.mjs`: `absentBit` as the fifth unit bit — `unitBit` stays
      value-keyed, since the new bit has no JS value to key on — and `trimPrefix`
      and `objectMayOmit` switch to it. `allUnits` stays the four DJS units;
      `or(option, unknown)` is the declared-member top.
- [ ] Normalize the absent bit out of a `rest` on both kinds; pin
      `array(or(option, number))` → `array(number)` and the top-level spelling.
- [ ] Readers: a declared member is absent when its key or index is not an own
      one; `parse` omits an absent member instead of materializing `undefined`.
- [ ] `../ts/types.ts`: strip the absent bit and render `a?:`; an interior tuple
      position that admits absence renders `T | undefined`. Update the
      `_tupleOption`/`_tupleInteriorOption` pins, and `optionalTuplePosition` /
      `allOptionalTuple` in `../ts/proof.f.mjs`, which print the `undefined|`
      this stage removes.
- [ ] Pin `Ts<[1, or(option, number)]>` as `readonly[1,number?]` from both
      renderers, with the four assignability rows above — the exactness claim is
      the point of the two stages and should fail loudly if it regresses.
- [ ] Proofs: `{}` separated from `{ a: undefined }`; `[, 3]` accepted and
      `[undefined, 3]` rejected for `[or(option, number), 3]`; the JSON
      round-trip case from
      [parse-omits-undefined-members](./parse-omits-undefined-members.md);
      `{ a: option }` as a negative field.
- [ ] Delete [parse-omits-undefined-members](./parse-omits-undefined-members.md);
      restate the absence rule in `../README.md` and `../data/README.md` as the
      absent bit rather than as `undefined`.
- [ ] Changelog: **BREAKING CHANGES:** `option` is a nullary schema denoting
      absence — `option(t)` becomes `or(option, t)` — and `parse` no longer
      materializes an absent member.

## Related

- [parse-omits-undefined-members](./parse-omits-undefined-members.md) — the
  construction ambiguity and the array kind's JSON defect; stage 2 dissolves both
  and deletes the file.
- [schema-walk-own-indices](./schema-walk-own-indices.md) — how a tuple *schema*
  is walked; stage 2 settles the same question for the *value*, so land them in a
  consistent order.
- [`../data/README.md`](../data/README.md) — the two kinds' opposite identity
  elements (stage 1's mapping), and the declared-key/undeclared-entry asymmetry
  (stage 2's premise).
- [`../ts/types.ts`](../ts/types.ts) — `TupleTs`'s derivation and `OptionalFields`,
  the two renderings both stages change.
- [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs),
  [`../../../protocol/mcp/module.f.mjs`](../../../protocol/mcp/module.f.mjs) — the
  two consumers whose spellings the closed default swaps.
- [excluded-string-values](./excluded-string-values.md) — the other proposed `Type`
  ADT extension, and the bar it sets: a data-form mapping worked out end to end
  before code.
