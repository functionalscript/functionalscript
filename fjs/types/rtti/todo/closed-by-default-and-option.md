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

#### `RestTs` must render the tail

A straight rename is not enough. `CloseTs<C> = ConstTs<C>` ignores its rest
today, which was harmless while the rest was the rare, explicitly-closed case.
After stage 1 the *open* form is the wrapper, so the same definition would make
`Ts<typeof open([42])>` the exact `readonly [42]` while
`validate(open([42]))([42, 'extra'])` accepts and returns two elements — the
unsound cast this issue opens with, moved from the bare form to `open` rather
than removed.

The struct kind needs nothing: an open struct's declared props already *are* its
accurate TypeScript type, since object types are width-open. Only the tuple kind
needs a tail, and the tail is expressible — measured against this repo's `tsc`:

| type | accepts | rejects |
| --- | --- | --- |
| `readonly [...Mapped<readonly [42]>, ...string[]]` | `[42]`, `[42, 'x', 'y']` | `[42, 99]` |
| `readonly [...Mapped<readonly [42]>, ...unknown[]]` — the `open(c)` case | `[42, 'anything', 1, null]` | `[43]` |
| `readonly [number, string?, ...boolean[]]` | — | type-checks, so a rest may follow an optional element |

That is narrower than it looks: `TupleTs`'s documented failure is the generic
derivation *composed with* the trailing-optional transform, not the tail on its
own. The tail shape works; composing the two is a spike stage 1 has to run. If
it cannot be composed, `RestTs` renders the tail where it can and states the
gap — what it must not do is keep returning an exact tuple for an open schema,
which is the lie in the first place.

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
**the set algebra does not change**.

The *normalizations* do, and only one of the three is a straight substitution:

| site | today | stage 2 |
| --- | --- | --- |
| `objectMayOmit` | a key is omittable when its set admits `undefined` | …when its set admits absence — a straight swap |
| `objectSet`'s `isTop` | a declared key whose set is `unknown` is dropped, and only once the `rest` is gone | the rest guard **stays**; `isTop` becomes position-aware — `unknown` for a `rest`, `or(option, unknown)` for a declared member |
| `trimPrefix` | a trailing position restating a `rest` that admits `undefined` is dropped | the rest no longer carries the bit, so the test moves to the trailing **declared position**: drop it when it admits absence and its absence-stripped set equals the rest |

Neither of the last two can be reached by swapping the bit, and both would
mis-canonicalize if it were:

- **`trimPrefix`.** Measured today, `close([option(number)], option(number))` and
  `array(option(number))` are the same `Node` — the rest admits `undefined`, so
  the trim fires. Its stage-2 counterpart is `rest([or(option, number)], number)`:
  position 0 may be absent and every present entry is a number, so it denotes the
  same arrays as `array(number)`. But a `rest` carries no absent bit, so a bit
  test on the rest is dead, the prefix survives, and two spellings of one set get
  different `toData` — breaking `equal` and `cmp`.
- **The declared-key drop.** `{ a: or(option, unknown) }` is closed after stage 1,
  so it carries `rest: never` and denotes objects with at most the key `a`.
  Dropping `a` would leave the empty object, a different set. `objectSet` already
  guards the filter with `r === undefined` ("the rest is gone"); that guard stays
  and only the predicate moves.

That is the structural cost — one bit, one swap, two normalizations to redesign —
and it is still why this shape is preferred over the wrapper `option(t)`: a
wrapper is not a set of values, so it would have
needed a second syntactic category (`Member = Type | Option<Type>`, legal only
at a container position) and an `{ optional, node }` pair on every `props` entry
and `prefix` position, with every algebra function and its proof rewritten.

#### The four rules the bit needs

**`unknown` excludes it.** `unknown` is the set of DJS values and absence is not
one, so "anything, or nothing" is `or(option, unknown)`. That is the top of a
*declared member*, so the ordering caveat `../data/README.md` records — a
declared key whose set is the top is dropped only once the `rest` is gone —
**stays**, with `or(option, unknown)` as the top it tests. That guard is what
keeps `{ a: or(option, unknown) }` denoting objects with at most the key `a`
rather than the empty object.

**It is observable only at a container position.** No caller can hand `validate`
an argument that is not there, so a top-level schema admitting absence accepts
exactly what the rest of its union accepts. Nothing has to enforce this:
`unionValidate` is only ever reached with a present value.

**A `rest` never sees it.** A declared member is checked as the value *read* at
its position; a `rest` is checked against each *present* member. So the absent bit
in a `rest` constrains nothing and normalizes away on both kinds. This is not new
behaviour: `../parse` and `../validate` walk a value with `Object.entries`, which
skips holes, so `array(number)` accepts `[1, , 3]` today.

**A referenced rest is left alone**, which is the one place the strip cannot be
applied. `trimPrefix` already declines to see through a reference ("reading its
unit bits would need the rule set"), and a rest that resolves to a rule cannot be
stripped in place: the same rule may be used at a declared position, where the
bit is meaningful, so clearing it globally would delete optionality elsewhere.
For `X = or(option, array(X))` used as a rest, the stripped form is not even
inline — it is the fixpoint `X' = array(X')`, a derived rule per rule reachable
at a rest position.

So stage 2 strips an **inline** rest and leaves a **referenced** one as it is.
The cost is that `rest(c, X)` and `rest(c, X')` are then structurally distinct
while denoting one set, which is exactly the incompleteness
[`../data/README.md`](../data/README.md) already accepts and documents for rule
*names* — semantically equal, structurally distinct, and mutual `subset`s rather
than `equal`. To keep that property here, `subset` masks the absent bit when it
compares rest positions; without the mask the two spellings would not even be
mutual subsets, which is the part that would actually be wrong.

Materializing derived rules instead would restore full canonicality at the price
of a fixpoint construction over the rule graph, a naming scheme that cannot
collide with user rule names, and memo identities for the derived names — the
bisimulation-grade direction `../data/README.md` deliberately avoids. Revisit
only if a consumer needs `equal` to see through it.

**Length still bounds a closed array**, which settles the one case the strip
creates rather than leaving it to be discovered. `array(option)` has an empty
element set once the bit is stripped; a `never` rest normalizes to no rest, which
on the array kind is the exact-length set, so `array(option)` is the empty array
— not "hole-only arrays of any length". That is the reading `close` already has,
and the readers already agree on it, with one exception:

| schema | value | thunk `validate` | data `validate` | `parse` |
| --- | --- | --- | --- | --- |
| `close([])` | `new Array(1)` | error | error | error |
| `close([1])` | `[1, ,]` | error | error | error |
| `array(or())` | `new Array(1)` | **ok** | error | **ok** |

The last row is a live divergence **today**: `toData(array(or()))` and
`toData(close([]))` are the same `Node` (`{ array: [{ prefix: [] }] }`), yet the
thunk readers accept a hole-only array for one and reject it for the other,
because the `array` handler walks `Object.entries` and never bounds length.
`../validate/proof.f.mjs` runs its acceptance table through all three readers but
does not carry this row. Stage 2 reaches it through the natural spelling
`array(option)`, so stage 2 must fix it — the array-kind readers bound length
when the rest admits nothing. It deserves its own issue if it is fixed before
this lands.

**Absence at a tuple position is "no such own index"** — past the end or a hole,
one rule for both. That makes the value side symmetric with the schema side
settled in #1712, where a hole in a *schema* is a declared `undefined` position.
Construction has to preserve it: an interior absent position must stay a hole,
because materializing it as `undefined` now denotes a different value, and
omitting it from a rebuilt list shifts every position after it.

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

There is a **third** renderer over the data form:
`../../../media/json/schema/module.f.mjs` derives `required` and `minItems` from
`admitsUndefined`, and drops `undefined` from an optional member's schema with
`stripUndefined`. Stage 2 splits those two uses, which today are one thing:

- `admitsUndefined` drives `required`/`minItems`, so it asks about **absence** and
  moves to the absent bit. Without that, `{ a: or(option, number) }` renders
  `required: ["a"]` while RTTI accepts `{}`.
- `stripUndefined` asks what JSON can **carry**, so it stays keyed on `undefined`.
  A key of `or(number, undefined)` is then required and renders as `number`: JSON
  has no way to write the `undefined` case, so the rendering under-approximates —
  the same corner the module already documents for `NaN` and `-0`.

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
- [ ] `../ts/types.ts`: `RestTs` **renders the tuple tail** — a rename alone
      relocates the unsound cast to `open(c)` (see above). Spike whether the
      tail composes with the trailing-optional derivation; state the gap if not.
      Rewrite `TupleTs`'s doc comment — the exact rendering is now the model,
      not an approximation.
- [ ] `../README.md`: replace "Structs and tuples are open", "This is deliberate;
      please do not 'fix' it" and "Closed containers" with the closed default and
      the `open`/`rest` spelling; keep the `Ts<>` direction note above.
      `../validate/module.f.mjs`: delete the "Do not add a length check" paragraph.
- [ ] Migrate consumers: drop 21 `close(...)` in `../../../edag/module.f.mjs`;
      wrap the protocol structs in `open(...)`; audit the other 13 modules that
      import the schema surface (`fjs/media/*`, `fjs/mcp/*`, `fjs/ci/common`,
      `fjs/emergent_testing`). `../../../media/json/schema/module.f.mjs` follows
      the data form, so a bare struct now renders `additionalProperties: false`
      on its own — correct, and its proof pins the old output.
- [ ] Proofs: the acceptance tables in `../parse/proof.f.mjs`,
      `../validate/proof.f.mjs` (37 `close` sites) and `../data/proof.f.mjs` (39).
- [ ] Changelog: **BREAKING CHANGES:** a bare `Struct`/`Tuple` schema is closed;
      `close(c, rest)` is `rest(c, r)`, and `open(c)` is the old bare form.

Stage 2 (one PR, after stage 1 lands):

- [ ] `option` as a nullary schema in `../module.f.mjs`/`../types.ts` — a new
      `Tag0`, so `visit`'s `Visitor` in `../common/module.f.mjs` gains the case.
- [ ] Migrate every `option(t)` call site to `or(option, t)` — 52 of them across
      10 modules outside this one (`protocol/mcp` 10, `media/json/schema` 11 plus
      11 in its proof, `ci/common` 5, `mcp/evo` 5, `protocol/json_rpc` 3,
      `media/revision` 2, `media/note` 2, `mcp` 2, `mcp/cas` 1), plus this
      module's own proofs. The repo sets `checkJs`, so a missed site is
      `TS2554: Expected 0 arguments, but got 1` rather than a silent
      absence-only schema — verified — but the schemas are wrong until migrated.
- [ ] `../data/module.f.mjs`: `absentBit` as the fifth unit bit — `unitBit` stays
      value-keyed, since the new bit has no JS value to key on — and `trimPrefix`
      and `objectMayOmit` switch to it. `allUnits` stays the four DJS units;
      `or(option, unknown)` is the declared-member top.
- [ ] Normalize the absent bit out of an **inline** `rest` on both kinds; pin
      `array(or(option, number))` → `array(number)` and the top-level spelling.
- [ ] Leave a **referenced** `rest` unstripped, and mask the absent bit where
      `subset` compares rest positions, so the two spellings stay mutual subsets.
      Pin `X = or(option, array(X))` used as a rest, and add the case to
      `../data/README.md`'s list of accepted structural incompleteness.
- [ ] Redesign `trimPrefix` around the trailing **declared position** — drop it
      when it admits absence and its absence-stripped set equals the rest — and
      pin `rest([or(option, number)], number)` as `array(number)`. A bit test on
      the rest is dead once rests carry no absent bit.
- [ ] Make `isTop` position-aware: `or(option, unknown)` for a declared member,
      `unknown` for a `rest`. Keep `objectSet`'s `r === undefined` guard, and pin
      `{ a: or(option, unknown) }` (closed) as objects with at most the key `a`.
- [ ] Bound length on the array kind's thunk readers when the rest admits
      nothing, and pin `array(or())` against `new Array(1)`, where the thunk
      readers and the data form disagree today.
- [ ] Readers: a declared member is absent when its key or index is not an own
      one. `parse` omits an absent member rather than materializing `undefined`:
      the struct kind drops the key, and the array kind **preserves indices** —
      a trailing absent run shortens the result, an interior one stays a hole.
      `arrayRebuild` is `entries => entries.map(([, v]) => v)`, so omitting an
      absent entry would rebuild `[, 3]` as `[3]`, shifting `3` to index 0 and
      returning a value that fails its own schema.
- [ ] Decide the array kind's rebuild against FunctionalScript's own rules:
      `Array.prototype.map` preserves holes, `Array.from({ length }, …)` does
      not, and there is no index assignment or mutation to fall back on — so the
      hole-preserving rebuild maps over the *value* while the check keeps walking
      the schema. (Verified: `[, 3].map(v => v)` has no own index 0;
      `Array.from({ length: 2 }, (_, i) => a[i])` does.)
- [ ] `../../../media/json/schema/module.f.mjs`: move `admitsUndefined` (and so
      `required`/`minItems`) to the absent bit, leave `stripUndefined` on
      `undefined`, and update `./proof.f.mjs` — a third renderer over the data
      form, and the one whose output is wrong rather than merely imprecise if it
      is missed.
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
      `{ a: option }` as a negative field. Assert on the **built value**, not
      only acceptance: `parse([or(option, number), 3])([, 3])` has no own index
      `0` and carries `3` at index `1`.
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
