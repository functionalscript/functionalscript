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

`open` needs a **`const` signature of its own** — `_MakeOpen` as
`<const C extends ConstObject>(c: C) => Rest<C, Unknown>` — not just the renamed
`_MakeRest`. Without the modifier a broad annotation still type-checks while
`open([42])` loses its literal tuple shape and `Ts<typeof open([42])>` degrades
to the container type. `../proof.f.mjs` already states this as a convention and
pins it — "`or`, `option`, `array`, `record`, and `close` take `const` type
parameters … the assertions below are what fail if one of the modifiers is
dropped" — so `open` and `rest` join that list and that assertion block, rather
than relying on the signature being written correctly once.

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

##### The tail admits holes, so it renders `| undefined`

The tail as written above would trade one unsound cast for a smaller one. Both
readers check an undeclared member as an *entry*, and a hole is no entry, so
`validate(rest([42], string))([42, , ])` is `ok` — verified on this repo's
`main`, spelled `close([42], string)`: `length` is 2, `Object.hasOwn(v, 1)` is
`false`, and the result is `['ok', …]`. `readonly [...Mapped<readonly [42]>,
...string[]]` types index 1 as `string`, and
[`../../../../tsconfig.json:96`](../../../../tsconfig.json) has
`noUncheckedIndexedAccess` commented out, so nothing adds the `undefined` back
at the use site. The accepted value reads `undefined` where the type says
`string`.

So the tail renders `...(Ts<R> | undefined)[]`, in `RestTs` and in the runtime
printer (`../ts/module.f.mjs`) alike. That is not a hedge — it is what "a rest
never sees an absent member" (stage 2's rule, and today's behaviour already)
says on the type side, stated once rather than discovered by a caller. The
common case pays nothing: `open(c)` has `rest: unknown`, and
`unknown | undefined` is `unknown`, so `...unknown[]` is unchanged. Only an
explicit `rest(c, r)` widens.

`| undefined` is necessary but not sufficient: a hole past the prefix can also
be **readable through the prototype**, and then it is neither absent nor
checked. Measured on `main` — give `[42, , ]` a prototype carrying `1: 99`
(built on `Array.prototype`, or `isArray` rejects the value before any of this
matters) and `validate(close([42], string))` answers `ok`, handing back the
same array, whose index 1 reads `99`. `undeclaredEntries` filters
`Object.entries`, which is own-enumerable-only, so the inherited index is
never an undeclared entry and never meets the `rest`. The tail then promises
`string | undefined` over a number. `parse` escapes it by rebuilding — it
returns `[42]`, length 1 — so this is `validate`'s success cast alone, which is
the same shape as the declared-member prototype hazard in stage 2 below and
wants the same answer: decide the rest region by what the index *reads*, not by
whether it is an own entry. Concretely, walk `prefix.length … length - 1` and
hold every index with HasProperty to the `rest`, skipping only the genuinely
absent ones. That keeps "a rest never sees an absent member" intact — an
inherited index is not absent — and it is a stage-1 item because stage 1 is
where the tail starts being rendered at all.

Do **not** take the other branch — making the readers reject a hole past the
prefix — without reopening stage 2 with it. It would buy the narrower tail, but
it contradicts the undeclared-entry rule both stages are built on, and it is a
behaviour change stage 1 otherwise does not make. Pin the sparse case
(`rest([42], string)` against `[42, , ]`) in `../ts/proof.f.mjs` beside the tail
rows, so whichever way it is settled is recorded rather than re-derived.

The widening is guarded by one condition: **an empty rest renders no tail at
all.** Applied blindly, `...(Ts<R> | undefined)[]` turns an absence-only or
empty rest into `...undefined[]` — `rest([42], option)` after stage 2 strips its
inline rest to nothing (the normalization task below), so both readers and the
runtime printer see the exact `[42]`, while the formula would compute
`Ts<typeof option>` as `never`, add `undefined`, and render
`readonly [42, ...undefined[]]`, admitting `[42, undefined]` where the schema
rejects it. Same for `rest([42], or())` in stage 1, where the rest is empty
without any absence involved. So the rule is: strip absence from the rest, and
if what remains is empty, render the exact tuple; otherwise render
`...(Ts<R> | undefined)[]`. Pin `rest([42], or())` in stage 1 and
`rest([42], option)` in stage 2.

The exact rendering for an empty rest is only right *with* the length bound
beside it: `validate(close([42], or()))([42, , ])` is `ok` today while
`validate(close([42]))([42, , ])` is `error` — measured — which is the
`array(or())` divergence the acceptance table above records. That bound is a
stage-1 task for this reason and not a stage-2 one, though the divergence
predates both stages: the two are one change seen from the type side and the
reader side, and shipping the rendering alone would understate `length` on
exactly the spelling this paragraph exempts from the tail.

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
than `equal`. `subset` gets there by **resolving** the rest rather than masking
the bit — it already resolves references coinductively — and comparing present
parts.

Masking would be unsound, and the case that shows it is reachable: for
`X = or(option, Y)` with `Y = or(X)`, the pure `or` cycle dissolves to the absent
bit alone, so `X`'s present part is empty. Then `rest(c, X)` keeps a `rest` and
admits any hole-only array, while the stripped `X'` is `never`, which normalizes
to no `rest` and so **bounds the length** — the two denote different sets, not one
set spelled twice. A mask would report them as mutual subsets, and `subset`
answering `true` for a non-inclusion is the one thing `../data/README.md`
promises it never does. So the structural distinctness is an accepted
incompleteness where the present part is non-empty, and simply *correct* where it
is empty.

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
does not carry this row. **Stage 1 fixes it** — the array-kind readers bound
length when the rest admits nothing — because stage 1 is what makes `RestTs`
render an empty rest as an exact tuple, and that rendering is only sound with
the bound beside it. Stage 2 reaches the same defect again through the natural
spelling `array(option)`, so it would have forced the fix in any case; it is
stage 1 that cannot ship without it. The task is in stage 1's list below. It
deserves its own issue if it is fixed before this lands.

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

**The entry node keeps its bit**, and that asymmetry with the rest is deliberate
rather than an oversight. At the entry, `or(option, number)` and `number` accept
exactly the same inputs — nothing can be handed to a call that is not there — yet
they stay structurally distinct, so `equal` is false between them and `subset`
holds only from `number` to the union. They are different *sets*, and this form
compares sets; the entry position simply cannot witness the difference.

Stripping there instead would cost more than it buys. A rest node has no life
outside its position: it is a field of a pattern, and every value that position
ever sees is a present member, so the bit is vacuous by construction. An entry
node **is the schema** — a `Data` is serializable and a consumer may embed it at
a member position, where the bit is live again. Stripping it at the root would
make `toData` lose information that reappears as a silent meaning change on
reuse, which is worse than an `equal` that answers "different" for two schemas
that behave alike in one position.

So this joins the same list as the rule-name limit in
[`../data/README.md`](../data/README.md): semantically indistinguishable *here*,
structurally distinct, and content-addressed apart. Stated, not latent.

On the name: `option` is kept as proposed. It names the modality where `absent`
or `none` would name the value, but as the only spelling it is unambiguous, and
`or(option, number)` reads correctly. Do **not** reintroduce an `option(t)`
helper alongside it — one name, one thing.

## Tasks

Stage 1 (one PR):

- [ ] `../module.f.mjs`: `rest(c, r)` and `open(c)`; delete `close`. `'close'` →
      `'rest'` in `../types.ts`, with `InfoRest`/`Rest`/`_MakeRest`.
- [ ] `../data/module.f.mjs`: map a bare `Const` to `{ prefix }` /
      `{ props, rest: never }` and `open(c)` to the mirror. No algebra change —
      assert that in the PR.
- [ ] `../parse` and `../validate`: reject an undeclared member of a bare `Const`;
      the tuple length check returns.
- [ ] `../ts/types.ts`: `RestTs` **renders the tuple tail** — a rename alone
      relocates the unsound cast to `open(c)` (see above). Spike whether the
      tail composes with the trailing-optional derivation; state the gap if not.
      Rewrite `TupleTs`'s doc comment — the exact rendering is now the model,
      not an approximation.
- [ ] Render that tail as `...(Ts<R> | undefined)[]`, in `RestTs` and in the
      runtime printer `../ts/module.f.mjs`, because both readers accept a hole
      past the prefix (see above; `open(c)` is unaffected, since
      `unknown | undefined` is `unknown`). Pin `rest([42], string)` against
      `[42, , ]` in `../ts/proof.f.mjs`.
- [ ] Hold an **inherited** index past the prefix to the `rest`. Today
      `undeclaredEntries` filters `Object.entries`, so it is skipped, and
      measured, `validate(close([42], string))` returns `ok` on a `[42, , ]`
      whose prototype carries `1: 99` — under the new tail that is
      `string | undefined` over a number. Walk `prefix.length … length - 1` and
      check every index with HasProperty, skipping the genuinely absent ones;
      `parse` needs nothing, since it rebuilds. Pin that value against
      `rest([42], string)` and against `rest([42], number)`, which must answer
      error and ok. Stage 2's declared-member prototype task is the same
      hazard one region to the left; the two should read as one rule.
- [ ] **Needs its own investigation, not a design here.** That walk covers the
      indices below `length`; an inherited index above it is readable and no walk
      bounded by the value reaches it. Measured: with `Array.prototype[10] = 99`,
      `validate(rest([42], string))([42])` is `ok` and `v[10]` reads `99` — and so
      are `close([42])` and `array(number)` on the same realm, so this is the
      whole reader family and predates both stages. Neither obvious remedy
      settles it: a prototype-identity check closes only the per-value half, and
      "check the intrinsic" is a realm-wide property that can change between the
      check and the read. What stage 1 owes is the honest note in `../README.md`
      — the tail is the first place these readers *claim* an element type, so the
      caveat has to arrive with the claim. The rest is a separate issue, and
      probably a question about what the FunctionalScript subset assumes of its
      host rather than about rtti.
- [ ] …except when the rest **normalizes away**, where the tail is omitted and
      the exact tuple is rendered — otherwise `rest([42], or())` (stage 1) and
      `rest([42], option)` (stage 2, whose inline rest normalizes away entirely)
      render `readonly [42, ...undefined[]]` and admit `[42, undefined]`, which
      both readers reject. Pin both.
      The exception keys on **the empty-rest criterion** — *not* on "the
      absence-stripped rest is empty", which is a different question with a
      different answer. `RestTs` cannot *evaluate* that criterion: it is a
      `toData` conversion plus `subset` both ways, and `types.ts` has no way to
      invoke either. Nor is `Ts<R> extends never` a substitute — measured, for
      the case this section explicitly requires, `Ts<[or()]>` is `readonly
      [never]` with `.length` of `1`, not `never`. So `RestTs` implements a
      **conservative syntactic approximation**: recognize the directly spellable
      empty rests (`or()`, and a container with a provably empty position if the
      spike shows that composes without TS2589), and **keep the tail whenever it
      cannot tell**. The conservatism has a direction and it is not arbitrary —
      a kept tail is wide but sound, by the same argument as the retained
      reference below, while a wrongly dropped one is the unsound cast. Where
      the two renderers then differ, the type renderer keeps a tail the data
      printer drops; document that divergence rather than closing it, and pin
      `rest([42], [or()])` as its example. A **retained** reference
      separates them: for the absence-only cycle the exemption below keeps
      unstripped, `toData(rest([42], X))` still carries `rest: "X"`, so the
      readers do not bound the length and `rest([42], X)` accepts hole-only
      arrays of any length — while stripping absence from `X` leaves nothing,
      so the wrong test would render the exact `readonly [42]` over a length-2
      value. Keyed on the criterion it keeps its tail and renders
      `...undefined[]`: wider than the schema, which rejects a *present*
      `undefined` there, but wide in the safe direction — every accepted value
      still has the type, which is the only direction the success cast needs.
      Pin `rest([42], X)` beside the two above; it is the row that tells the
      two tests apart.
      This shares its other half with the length-bound task below: until that
      lands, `validate(close([42], or()))([42, , ])` is `ok` while
      `validate(close([42]))([42, , ])` is `error`.
- [ ] `../README.md`: replace "Structs and tuples are open", "This is deliberate;
      please do not 'fix' it" and "Closed containers" with the closed default and
      the `open`/`rest` spelling; keep the `Ts<>` direction note above.
- [ ] `../validate/module.f.mjs`'s **module doc**, all of it — not just the
      "Do not add a length check" paragraph (`:40-45`). `:29-38` is a whole
      `## Structs and tuples are open` section stating the rule as this
      reader's own contract, `:47-52` is a `## Closed containers` section
      defining `close(c)`/`close(c, rest)` as the narrowing spelling, and the
      `@example` on the exported `validate` demonstrates the open reading at
      `:293-295` ("open, and the extras are still there afterwards") and calls
      `close` twice at `:301-302`. Deleting only the paragraph would leave the
      two section headings asserting the reverse of the code. This is the same
      edit as the `../parse/module.f.mjs` one below, on the other reader.
- [ ] The rest of the **public JSDoc that states the open/closed contract**,
      swept across the tree this time rather than named as it is found — three
      earlier revisions of this list each missed sites, so here it is in full,
      minus what other items already own:
      `../types.ts:35-40` is a `## Closed containers` section in the ADT's own
      declarations ("A `Struct` or a `Tuple` on its own is **open**"), and
      `:168` describes `CloseTs` as "the type of `close(c)`, matching the
      constructor's own optional parameter" — an optional parameter `rest(c, r)`
      stops having; `../module.f.mjs:120-128` is the constructor module's doc,
      stating the open default and demonstrating `close` three times, on the
      module whose API this stage changes; `../ts/types.ts:112-124` says "**The
      remaining approximation is open-ness, and it is deliberate**", and `:194`
      and `:201` are `CloseTs`'s own — `:201` naming the unrendered rest as "a
      gap in this rendering", which is exactly the gap `RestTs` closes above;
      `../ts/module.f.mjs:292` describes the printer's open-tuple output and
      `:308` shows `toTs(close(...))`; `../data/types.ts:33-36` states the
      mapping as "A tuple schema is `{ prefix, rest: unknown }` — tuples are
      open"; and `../data/module.f.mjs:774-780` says "Used bare, both kinds are
      **open**" while defining the very function whose mapping this stage
      inverts. All of these are `.ts`/`.mjs` declaration files, so the tag and
      constructor edits touch the code beside them without a checker ever
      looking at the sentence.
- [ ] Three **consumer** modules justify a design decision by the open default,
      which the call-site audit reaches only as calls: `../../../protocol/json_rpc/types.ts:23`
      and `../../../protocol/json_rpc/module.f.mjs:57` both say "rtti structs
      are open, so additive extension keeps the tag", and
      `../../../media/note/module.f.mjs:9` says the same. After stage 1 the
      premise holds only where the struct is wrapped in `open(...)` — so
      wrapping them is not enough; the sentence has to say *why* it is wrapped,
      or the next reader unwraps it and silently breaks forward compatibility.
- [ ] `../parse/module.f.mjs`'s **module doc** is the longest single statement of
      the open default anywhere in the tree and stage 1 inverts all of it:
      `:8-14` opens "**Structs and tuples are open.** A value carrying more than
      the schema declares is accepted", `:31-37` is a standing instruction not to
      add a length check ("Do not read … as 'tuples are closed' … A schema that
      wants exact members says so, with `close`", citing #1622), `:39-43`
      contrasts `close(c)` with `close(c, rest)`, and the `@example` at `:280-289`
      builds three of its five lines on the open reading plus two `close(...)`
      calls. The `#1622` history is worth keeping in some form — it records *why*
      the open reading was defended — but it has to read as history rather than
      as a rule, and the "do not fix it" instruction has to go, or the next
      reader will restore the behaviour stage 1 removes. This is the same edit as
      the `../validate/module.f.mjs` paragraph above, on a file that says much
      more.
- [ ] Two more link/prose sites outside `../`, both surviving stage 1:
      `../../../media/json/todo/rtti-parse.md:246-255` asserts "Structs and
      tuples are open there" as the behaviour its own parser inherits, and links
      `#closed-containers` for the closed case that stage 1 makes the default —
      so the inheritance claim inverts, not just the anchor; and
      `./excluded-string-values.md:40-42` cites `Closed containers` — the same
      `../README.md#closed-containers` anchor — as the precedent it measures
      itself against, which needs the anchor retargeted and the precedent
      re-worded now that it is not an extension but the default.
- [ ] `../../../edag/README.md` explains the ADT's exactness in terms of the API
      stage 1 deletes — `:33` ("Every tuple in the schema is stated `close`d")
      and `:238` (`['.', a, 'b', null, 'extra']` rejected because "the schema is
      `close`d"), with `:245` saying `close` "could not have separated them;
      only disjoint vocabularies can" — the one place `close` is named for what
      it does *not* do, so it needs restating as a spelling and not as a
      mechanism correction. After stage 1 all three name a function that no
      longer exists, and `:238` additionally credits the wrong mechanism for the
      rejection; restate them in the closed-by-default model.
- [ ] Delete [close-counts-trailing-undefined](./close-counts-trailing-undefined.md),
      whose whole subject is the `close(c, rest?)` overload stage 1 removes, and
      carry anything still live into this file — its defect half is the
      length-bounding task further down this list, its documentation half is
      the README rewrite, and its **criterion** for an empty rest is the task
      just before that one, which is the piece "anything still live" reads past
      most easily because it looks like an implementation detail of the first.
      One concrete item is easy to lose in "anything still live": its
      proof task, adding `[close([number]), [42, undefined]]` to
      `../validate/proof.f.mjs`'s acceptance table with an oracle beside it —
      the explicit-`undefined` row that tells the two rejections apart. Carry
      that row in the closed-by-default spelling; the mechanical migration count
      above is a different task and does not cover it. `../../../../AGENTS.md` requires a fixed issue to be deleted in
      the PR that fixes it, and leaving it would advertise work against an API
      that is gone.
- [ ] `../data/README.md:158-179` is the data form's architectural contract and
      states the **opposite** of stage 1 throughout: "A `Tuple` schema is open on
      both readers, and says so here as `{ prefix, rest: unknown }`", a link to
      `#structs-and-tuples-are-open`, a worked block whose four lines all assume
      the open reading, and `close(c)` named as the spelling for the exact-length
      set with a link to `#closed-containers`. Stage 1 inverts every one of those,
      and since the stages land separately the public data-form contract would
      otherwise describe the reverse of the code for a whole release.
- [ ] Migrate the other two todos that **survive** stage 1, since the stages are
      separate PRs and the tree must not advertise a deleted API between them:
      [prefix-then-rest-tuple](./prefix-then-rest-tuple.md) `:30-31` links the
      `#closed-containers` anchor stage 1 removes and describes `close(c, rest)`
      as what makes its shape spellable; and
      [parse-omits-undefined-members](./parse-omits-undefined-members.md) keeps
      two `close(...)` spellings right up to its stage 2 deletion.
- [ ] Migrate [schema-walk-own-indices](./schema-walk-own-indices.md), which
      **survives** stage 1 rather than being deleted by it: `:69-72` links to
      `close-counts-trailing-undefined.md` — gone by then — and states its
      value-side constraint as `close([number, () => ['const', undefined]])`
      against `close([number])`, a spelling the API no longer has. Retarget the
      link at this file and restate the pair in the closed-by-default form; the
      constraint itself is untouched, since it is about the prototype asymmetry
      and not about `close`.
- [ ] Migrate consumers: drop 21 `close(...)` in `../../../edag/module.f.mjs`;
      wrap the protocol structs in `open(...)`; audit the other 13 modules that
      import the schema surface (`fjs/media/*`, `fjs/mcp/*`, `fjs/ci/common`,
      `fjs/emergent_testing`). `../../../media/json/schema/module.f.mjs` follows
      the data form, so a bare struct now renders `additionalProperties: false`
      on its own — correct, and its proof pins the old output.
- [ ] Proofs: the acceptance tables in `../data/proof.f.mjs` (50 `close` sites),
      `../validate/proof.f.mjs` (37) and `../parse/proof.f.mjs` (24), plus
      `../ts/proof.f.mjs` (11) and `../proof.f.mjs` (2) — 124 in all. (Counted by
      occurrence; a per-line count reads 39 for `../data/proof.f.mjs`, which is
      the figure to distrust.)
- [ ] Carry [close-counts-trailing-undefined](./close-counts-trailing-undefined.md)'s
      **definition of an empty rest** into this file before deleting it — its
      third task, the one the carry-over item above does not cover, because the
      criterion is neither the defect half nor the documentation half. "The rest
      admits nothing" is not a syntactic test: `[or()]` is closed after stage 1
      and has no inhabitant, and measured today
      `validate(close([42], [or()]))([42, , ])` is `ok` while
      `validate(close([42], [or()]))([42, 1])` is `error` — so a reader keying
      on the exported `never` bounds nothing here, and the empty-rest `RestTs`
      rule above would then type an accepted length-2 array as the exact
      `readonly [42]`. That file works the criterion out in full and its
      conclusions transfer unchanged: define empty as `toData(rest(c, r))`
      equalling `toData` of the bare closed `c`, compared **up to rule
      renaming** with `subset` applied both ways rather than with `equal`; the
      five cases that fix it (the three interchangeable-looking spellings
      `never`/`or()`/`close([never])`, the two recursive rests that must *not*
      be recognised, and `unknown`, which rules out "the conversion kept no
      `rest` key" as the test) are the reason a simpler rule fails. Carry the
      seven proof rows with it.
- [ ] Bound length on the array kind's thunk readers when the rest admits
      nothing **by that criterion**, and pin `array(or())` against
      `new Array(1)`, `rest([42], or())` against `[42, , ]`, and
      `rest([42], [or()])` against `[42, , ]` — the third is the row that tells
      a semantic classifier from a syntactic one. **This belongs to stage 1, not stage 2**, even
      though the divergence predates both: stage 1 is what makes `RestTs` render
      an empty rest as the exact tuple (see above), so shipping the rendering
      without the bound would hand `rest([42], or())` a `readonly [42]` over a
      value `validate` accepts at length 2 — the same unsound cast this issue
      opens with, on a narrower spelling. The rendering and the bound are one
      change; landing either alone is worse than landing neither.
- [ ] Changelog: **BREAKING CHANGES:** a bare `Struct`/`Tuple` schema is closed;
      `close(c, rest)` is `rest(c, r)`, and `open(c)` is the old bare form.

Stage 2 (one PR, after stage 1 lands):

- [ ] `option` as a nullary schema in `../module.f.mjs`/`../types.ts` — a new
      `Tag0`, so `visit`'s `Visitor` in `../common/module.f.mjs` gains the case.
- [ ] Give **both** schema-form readers an `option` handler that *rejects*
      normally. `orVisit` tries the union's members in order, so for a present
      value under `or(option, t)` the `option` branch is reached first and has to
      return an ordinary error for `t` to be tried. Extending the `Visitor` type
      is not enough to force this: `parseVisitor` (`../parse/module.f.mjs:292`)
      and `validateVisitor` (`../validate/module.f.mjs:261`) are both
      `/** @type {any} */ ({ … })`, so a missing handler is not a type error but
      a `v.option is not a function` throw — and FunctionalScript has no
      `try`/`catch` to contain it. Proof: a **present** value under
      `or(option, t)`, through both readers.
- [ ] Decide the migration's **semantics** before its spelling. `option(t)` is
      `or(t, undefined)` today, so it accepts a present `undefined` — verified,
      `validate({ a: number, b: option(string) })({ a: 1, b: undefined })` is
      `ok`. Rewriting it to `or(option, t)` therefore **narrows** every migrated
      schema; the faithful translation is `or(option, t, undefined)`. This issue
      takes the narrowing deliberately — it is what stage 2 is for, and
      `exactOptionalPropertyTypes` already rejects the present-`undefined`
      spelling at an optional key — but each production site is reviewed rather
      than swept, and the changelog says the schemas got stricter, not that a
      spelling changed.
- [ ] Migrate the **documentation and instructions** too, which the compiled-call
      sweep does not reach and no checker flags. A missed call is `TS2554` at
      build time; a missed doc is a working example that quietly builds the wrong
      schema for whoever copies it. Twenty sites across eight files:
      `../README.md` (3), `../ts/README.md` (2), `../data/README.md` (3),
      `../../../protocol/mcp/README.md:71` (a copy-me
      `greeting: option(string)`), `../../../media/revision/README.md` (5,
      including the `option(true)` presence-flag idiom it recommends twice),
      `../../../media/note/README.md` (2),
      `../../../media/note/todo/extend-note-format.md` (2), and
      `../../../AGENTS.md` — `:383` writes `option(...)` among the schema
      references, a call form it stops having, while `:405` lists `option` as a
      bare name among `types/rtti`'s exports, so that one is a description to
      re-word rather than a spelling to fix. Two near-misses stay out: `option` in
      `../../../bnf/todo/207.md` is `bnf`'s own combinator, and the `option(s)`
      in `../../../cas/evo/todo/cache-staleness.md` is English, not code.
- [ ] The **JSDoc** sites, which that list does not cover: it is a markdown
      inventory, and a comment is no more compiled than a `.md` file is, so the
      two sweeps between them still leave these eleven untouched, in six files.
      Two of them are not spellings but *statements of the semantics stage 2
      replaces*, and matter more than the rest: `../ts/proof.f.mjs:27` says
      "`option(t)` is `or(t, undefined)`; these are the schema types it
      produces", which is the definition this stage retires, and
      `../data/module.f.mjs:453` argues a design decision from
      "`close({ a: option(number) })` a subset of `record(number)`, which admits
      `{ a: undefined }` on the left" — the same claim that flips in
      `../data/proof.f.mjs:620` above, so the rationale and the row have to move
      together or the code will justify itself with a false example.
      `../ts/module.f.mjs:280` asserts the printer's output for a schema
      (`option(number)` prints `'undefined|number'`), which stops being true.
      `../ts/types.ts` (`:80`, `:139`, `:162`, `:163`, `:167`) uses `option(x)`
      as the optional-member spelling throughout the `TupleTs`/`OptionalFields`
      derivation. `../validate/module.f.mjs` (`:18`, `:298`) publishes
      `b: option(string)` in its parse-vs-validate contrast and in the exported
      `validate`'s `@example` — copy-me code in the reader's own API docs.
      `../../../media/revision/proof.f.mjs:125` names the `option(true)`
      presence-only idiom its README recommends. Sweep JSDoc explicitly rather
      than trusting the markdown pass: the earlier revision of this item said
      "twenty sites across eight files" and meant twenty *markdown* sites, which
      review caught. The markdown count stands; the scope did not.
- [ ] Audit the members that spell optionality **directly** as `or(…, undefined)`,
      which the `option(` sweep does not reach and `checkJs` cannot flag — they
      stay syntactically valid and silently become *required*. Verified sites:
      `mcp/cas/module.f.mjs:142` (`type: or('text', 'base64', undefined)`, so
      `cas_add` would start rejecting `{ content: 'hello' }`),
      `media/json/schema/module.f.mjs:56` and `:60` (`type`, `items`), plus
      `media/json/schema/proof.f.mjs:121` and `:136`. Each is a decision — add
      `option` where omission was intended, leave it where a present `undefined`
      was — not a mechanical rewrite.
- [ ] One of those decisions has a **second copy in a surviving todo**:
      [checked-const-pin](./checked-const-pin.md) `:14` and `:36` quote
      `casAddArgs` — the `mcp/cas/module.f.mjs:142` schema above — twice, as the
      motivating example for its own proposal. It is not a call site, so neither
      the `option(` sweep nor `checkJs` reaches it, and it outlives stage 2. If
      the CAS decision goes to `or(option, 'text', 'base64')`, the todo would be
      left arguing from a schema whose `type` key is now *required*, which is
      the opposite of what its example illustrates. Rewrite both quotes to
      whatever that decision picks, in the same PR — the point it makes about
      unchecked `as const` pins is untouched either way.
- [ ] Migrate every `option(t)` call site to `or(option, t)` — 52 of them across
      10 files in 9 modules outside this one (`protocol/mcp` 10,
      `media/json/schema` 11 plus 11 in its proof, `ci/common` 5, `mcp/evo` 5,
      `protocol/json_rpc` 3,
      `media/revision` 2, `media/note` 2, `mcp` 2, `mcp/cas` 1), plus this
      module's own proofs. The repo sets `checkJs`, so a missed site is
      `TS2554: Expected 0 arguments, but got 1` rather than a silent
      absence-only schema — verified — but the schemas are wrong until migrated.
- [ ] `../data/module.f.mjs`: give `thunkUnion` an explicit `'option'` case
      returning `{ unit: absentBit }`. Its switch ends in
      `default: { return orUnion(state, t, rest) }`, and a nullary tag has an
      empty `rest`, so without the case `toData(option)` is the empty union —
      `never` — and `toData(or(option, number))` silently loses the bit. Every
      data-side rule below then operates on a bit nothing ever sets. The tag
      enumerations are independent: adding `option` to `Tag0` does not reach this
      switch. Pin `toData(option)` and `toData(or(option, number))`.
- [ ] `../data/types.ts:70-73` states the public contract that stage 2 breaks:
      "`unit` is a bitset over the four singleton values; bit `1 << i` stands for
      `unitList[i]` … (`['null', 'undefined', 'false', 'true']`)". A fifth bit
      maps to no `unitList` entry, and the form is *serializable*, so a consumer
      decoding stored data by that sentence cannot read bit 16 at all. Document
      the absence bit there and in `unitList`'s own JSDoc, saying why it is not a
      `unitList` member — it is not a DJS value.
- [ ] `../data/module.f.mjs`: `absentBit` as the fifth unit bit — `unitBit` stays
      value-keyed, since the new bit has no JS value to key on — and `trimPrefix`
      and `objectMayOmit` switch to it. `allUnits` stays the four DJS units;
      `or(option, unknown)` is the declared-member top.
- [ ] Normalize the absent bit out of an **inline** `rest` on both kinds; pin
      `array(or(option, number))` → `array(number)` and the top-level spelling.
- [ ] `objectPresentSet` strips the absent bit too — it answers "what may be
      **present** at this key", while `objectMayOmit` answers whether the key may
      be missing, and `objectSetSubset` calls both. Left unstripped, the closed
      `{ a: or(option, number) }` tests `(Absent | number) ⊆ number` against
      `record(number)` and answers false, though its only values are `{}` and
      `{ a: number }`, both of which `record(number)` admits — so coverage
      collapse stops firing and equivalent unions stay structurally unequal.
      `../data/proof.f.mjs:620` is the row that **flips**:
      `assert(!subset(toData({ a: option(number) }))(toData(record(number))))`,
      correct today because `option(number)` admits `{ a: undefined }`, wrong
      once it does not. Its comment — "the open-struct spelling, which was sound
      before, still is" — has to change with it.
- [ ] Split the **array** position test the same way, which the struct strip
      above does not reach. `arraySetSubset` (`../data/module.f.mjs:425-436`)
      hands each left position straight to `nodeSubset` —
      `p.prefix.every((el, i) => le(el, qAt(i)))` — so the absent bit is compared
      as an ordinary member and closed `[or(option, number)]` ⊆ `array(number)`
      answers false, though the left's only values are `new Array(1)` and
      `[number]` and `array(number)` admits both (it walks own entries, so it
      accepts a hole). Give the position the two questions the object kind
      already asks: compare the **absence-stripped** left set against `qAt(i)`,
      and separately require that the right admits absence at `i` when the left
      does — which it does when `i >= q.prefix.length` (a hole there is no entry)
      or when `q.prefix[i]` carries the bit. The left's own `rest` needs neither,
      since a rest carries no absent bit after normalization. Pin
      `[or(option, number)]` ⊆ `array(number)` as **true** and
      `[or(option, number)]` ⊆ `rest([number], never)` as **false**, the pair
      that tells the two halves apart.
- [ ] Restate `arraySetSubset`'s doc comment with it. Its "the shortest needs no
      test of its own" argument is spelled in terms of `undefined` membership —
      "otherwise `undefined` would be a member of `p.prefix[i]` and not of
      `q.prefix[i]`" — and after stage 2 the property it needs is the absent bit,
      not `undefined`. The absence-implication check above *is* that argument
      made explicit, so the comment should point at it rather than restate the
      old reason.
- [ ] Leave a **referenced** `rest` unstripped, and have `subset` **resolve** it
      rather than mask the bit — masking is unsound where the reference's present
      part is empty (see above), so there is no context in which the mask is the
      rule. Expect one-way inclusion there, not mutual: `rest(c, X')` ⊆
      `rest(c, X)` when `X` is absence-only, since the stripped form bounds the
      length and the syntactic one does not. Pin `X = or(option, array(X))` used
      as a rest for the non-empty case, the absence-only cycle for the empty one,
      and add both to `../data/README.md`'s list of accepted structural
      incompleteness.
- [ ] The same exemption covers a referenced **trailing position**, which the
      redesigned `trimPrefix` reaches independently: for mutually recursive
      `X`/`Y` where `X` normalizes to `or(option, number)`,
      `toData(rest([X], number))` stores the prefix as `"X"`, and neither
      `trimPrefix` nor `arraySet` takes a rule set to resolve it with (verified —
      both are `(prefix, rest) => …`). So a referenced trailing position is left
      untrimmed by the same rule that leaves a referenced rest alone, and
      `rest([X], number)` stays structurally distinct from `array(number)`. Pin
      it beside the rest case rather than leaving it to be discovered.
- [ ] Redesign `trimPrefix` around the trailing **declared position** — drop it
      when it admits absence and its absence-stripped set equals the rest — and
      pin `rest([or(option, number)], number)` as `array(number)`. A bit test on
      the rest is dead once rests carry no absent bit.
- [ ] Except when **both** the stripped position and the rest are empty. A bare
      `[option]` is closed, so its rest is `never` and its sole position strips
      to `never` too — the rule above would drop the position and normalize it to
      `[]`. Those are different sets: `[option]` accepts `new Array(1)` (index 0
      absent, length within the declared prefix) and `[]` rejects that length, so
      the trim would make the data form disagree with the thunk readers and have
      `equal`/`cmp` identify two array sets that differ. Pin `[option]` against
      `new Array(1)` and `[]`.
- [ ] Make `isTop` position-aware: `or(option, unknown)` for a declared member,
      `unknown` for a `rest`. Keep `objectSet`'s `r === undefined` guard, and pin
      `{ a: or(option, unknown) }` (closed) as objects with at most the key `a`.
- [ ] Absence is decided by the **container loop, before dispatch** — it cannot
      be decided by the recursive reader, which is handed only the value read.
      `constContainerValidate`/`constContainerParse` call
      `validate(v)(getItem(value, k))`, so an absent key arrives as plain
      `undefined`; with the `option` handler rejecting normally (below), both
      branches of `or(option, number)` would reject `{}`. So `common` gains an
      `admitsAbsence(schema)` predicate and each container loop asks it first:
      a member whose key or index is not an own one succeeds iff its schema
      admits absence, and only a present member is dispatched. The predicate
      **traverses nested unions**, with a visited set for cycles: schema-form
      `or` does no
      flattening (its own doc says so), so `or(or(option, number), string)` has
      no `option` among its direct members while admitting absence, and a
      shallow test would reject `{}`. It descends `or` nodes and the thunks they
      hold, stops at any other tag, and carries the visited thunks to terminate
      on a recursive `X = or(option, X)`. The data form needs none of this
      *traversal* — `toData` has already flattened, which is why `objectMayOmit`
      can read one bit — so the thunk side pays for being the reader that does no
      preprocessing.
- [ ] The data **reader** still needs its own absence path, which `objectMayOmit`
      does not supply: that function is used only by `subset`
      (`data/module.f.mjs:475`, called once at `:500`), while
      `arraySetValidate` and `objectSetValidate` dispatch each declared position
      as `nodeValidate(rules)(n)(value[Number(k)])` — the value read, with no
      ownership, exactly like the thunk loops. Give both container loops the same
      before-dispatch test, or the data reader rejects `{}` and sparse tuples
      that both thunk readers accept, and `validate/proof.f.mjs`'s three-reader
      table breaks.
- [ ] A member absent by own-key but supplied by the **prototype** must still
      satisfy the member's present part, or `validate`'s success type goes
      unsound — and this is a regression the own-key rule introduces, not a
      corner it inherits. Measured today:
      `validate({ a: option(number) })(Object.create({ a: 'bad' }))` is an
      **error**, because `getItem` reads through the prototype and checks
      `'bad'` against `number`. Under the own-key rule alone it becomes `ok`,
      and the returned object — `validate` hands back what it was given, so it
      cannot sanitize by rebuilding as `parse` does — reads `.a` as `'bad'`
      while `Ts` promises `number | undefined`. So the absence test rejects when
      `Object.hasOwn` is false, HasProperty is true, and the inherited value is
      outside the member's present set. Proof: that exact value against
      `{ a: option(number) }` and `{ a: option(string) }`, which today answer
      error and ok respectively.
- [ ] Readers: a declared member is absent when its key or index is not an own
      one. `parse` omits an absent member rather than materializing `undefined`:
      the struct kind drops the key, and the array kind **preserves indices** —
      a trailing absent run shortens the result, an interior one stays a hole.
      `arrayRebuild` is `entries => entries.map(([, v]) => v)`, so omitting an
      absent entry would rebuild `[, 3]` as `[3]`, shifting `3` to index 0 and
      returning a value that fails its own schema.
- [ ] The array kind's rebuild is **slice, then map**, and mapping alone is not
      enough: `.map` preserves length, so `[1, or(option, number)]` against
      `[1, ,]` would rebuild a sparse two-element array and serialize back to
      `[1,null]` — the very defect stage 2 removes. Truncate to the last present
      declared position first, then map the *parsed* element results over the
      truncated array, so a trailing absent run shortens the result while an
      interior hole survives. FunctionalScript's rules leave no other route:
      `Array.from({ length }, …)` yields a dense array and there is no index
      assignment or mutation. Verified: `[1, , 3].slice(0, 3)` keeps the hole at
      1, `[1, , ,].slice(0, 1)` is `[1]` with length 1, and a `.map` after either
      keeps the hole.
- [ ] Drive that rebuild by the **own**-index test the check uses, not by
      `slice`/`map` alone. Both use HasProperty, so an index the value only
      *inherits* is materialized as an own property of the result — measured,
      with `Array.prototype[0]` defined, `[, 3].slice(0, 2)` and
      `[, 3].map(v => v)` both give `["PROTO", 3]` with
      `Object.hasOwn(result, 0)` true. That contradicts this stage's own rule
      and can rebuild a value the schema rejects. The same measurement settles
      the test to use: `0 in [, 3]` is **true** once the prototype supplies the
      index, so it is `Object.hasOwn`, never `in`, while `Object.entries` stays
      own-only. Reachable only from plain JavaScript — FunctionalScript has
      neither mutation nor prototype writes — so it constrains the construction
      rather than rejecting the slice-then-map shape, on the same footing as the
      overridden-`Symbol.iterator` case `../common/module.f.mjs` documents and
      the prototype asymmetry
      [close-counts-trailing-undefined](./close-counts-trailing-undefined.md)
      records.
- [ ] State the bound rather than implying a construction that does not exist:
      against a prototype-supplied index, **no** immutable builder can produce
      the hole. An `Object.hasOwn` guard *inside* the callback does not help —
      `.map` creates the own output element whatever the callback returns
      (measured: the guarded map still gives `hasOwn(result, 0)` true) — and a
      fresh `Array(n)` inherits the index too, so it is no cleaner source. The
      escapes are `Object.assign` or index assignment, both mutation, both
      forbidden. So `parse` materializes the inherited value in that case, and
      `validate` is untouched because it returns the value it was given. Pin it
      as a bounded divergence, unreachable from FunctionalScript, rather than
      leaving the task reading as though a sanitized source were available.
- [ ] `../ts/module.f.mjs`, the **runtime printer**: `arraySetToTs` and
      `objectSetToTs` decide optionality through their own `admitsUndefined`
      (`:159`, `:184`, `:217`), so without this `{ a: or(option, number) }` and
      `[1, or(option, number)]` print required members while `Ts<>` and both
      readers treat them as optional — and the two-renderer pin below could not
      hold. Move them to the absent bit and update `../ts/proof.f.mjs`.
- [ ] `../../../media/json/schema/module.f.mjs`: move `admitsUndefined` (and so
      `required`/`minItems`) to the absent bit, leave `stripUndefined` on
      `undefined`, and update `./proof.f.mjs` — a third renderer over the data
      form, and the one whose output is wrong rather than merely imprecise if it
      is missed.
- [ ] `../ts/types.ts`: "strip the absent bit" is data-form vocabulary and does
      not apply here — `OptionalFields` keys on `undefined extends Ts<T[K]>`, so
      the type level sees members already reduced through `Ts`. Map `option` to a
      **branded uninhabited marker** (`Absent`, a `unique symbol` brand). Not
      `never`, which vanishes in a union and takes the information with it; not
      `undefined`, which would make `or(undefined, number)` optional too and
      conflate the pair this stage exists to separate. Then `OptionalFields` keys
      on **`_AdmitsAbsence<T[K]>`, a structural predicate over the schema**, and
      renders `Exclude<_TsRaw<T[K]>, Absent>` for the value. The test cannot be
      a subtype query against the rendered union — neither `Absent extends Ts<…>`
      (which excludes the marker itself, so it is false for every member) nor
      `Absent extends _TsRaw<T[K]>`, which fails in the other direction at
      `unknown`: `_TsRaw<typeof unknown>` is `unknown`, `Absent extends unknown`
      is true for any `Absent`, and `unknown | Absent` is `unknown` — all three
      measured. So the closed `{ a: unknown }`, which stage 2 *rejects* `{}` for,
      would render `a?:`, and would be indistinguishable from
      `{ a: or(option, unknown) }`, which the runtime printer does tell apart.
      The marker is absorbed by the top and cannot be recovered from the union
      it lands in; only the schema still carries the fact. `_AdmitsAbsence<T>`
      recurses through `or` — which does no flattening, so
      `or(or(option, number), string)` needs the recursion, the same reason the
      runtime `admitsAbsence` is not a one-level scan. Pin `{ a: unknown }`
      required and `{ a: or(option, unknown) }` optional with
      `Assert<Equal<…>>`, the pair that fails under either subtype query;
      `ArrayTs`/`RecordTs` `Exclude` it from their element type, so
      `Ts<array(or(option, number))>` stays `readonly number[]` — the type-level
      counterpart of "a rest never sees it" — except that `ArrayTs` emits
      `readonly []` when the exclusion leaves `never`, since `readonly never[]`
      is *not* the empty array: `readonly never[] = new Array<never>(1)`
      type-checks and its `.length` is `number`, while `readonly []` rejects it
      ("Target allows only 0 element(s)") and its `.length` is `0` — both
      measured. `array(option)` is the empty array (see "Length still bounds a
      closed array" above), so without the case the compile-time renderer is
      wider than the runtime one on the schema that section exists to settle.
      Pin `Ts<array(option)>`. `RecordTs` needs no counterpart:
      `Record<string, never>` already admits `{}` and nothing else, because an
      object type carries no length to disagree about. Split the transformer to keep the
      marker internal: `_TsRaw<T>` preserves it for the container mappings to
      read, and the public `Ts<T>` is `Exclude<_TsRaw<T>, Absent>`. Excluding it
      only in the reader results would leave `Ts<typeof or(option, number)>` as
      `Absent | number` for direct consumers and for `Check`, a union no runtime
      value can inhabit and one the runtime printer has no way to spell. With the
      split, `Result<T>` needs no exclusion of its own — "observable only at a
      container position" falls out of the public entry.
- [ ] Lower the marker **per position**, not with one outer `Exclude`. A tuple
      type is not a union, so `Exclude<_TsRaw<T>, Absent>` never reaches inside
      it: `_TsRaw<[or(option, number), 3]>` keeps `Absent | number` at index 0
      and the public `Ts` would hand a consumer the uninhabitable marker. Each
      position lowers it for itself — a struct key and a trailing tuple position
      that admit absence render optional with `Absent` excluded; an **interior**
      tuple position replaces `Absent` with `undefined`, which is what reading a
      hole gives and the only spelling TypeScript allows before a required
      element; an array/record element excludes it. The runtime printer needs the
      same conversion for the interior case: switching `admitsUndefined` to the
      absent bit alone makes `arraySetToTs` print `number` where it owes
      `number | undefined`. Update the
      `_tupleOption`/`_tupleInteriorOption` pins, and `optionalTuplePosition` /
      `allOptionalTuple` in `../ts/proof.f.mjs`, which print the `undefined|`
      this stage removes.
- [ ] Say which vocabulary a **`Phantom` annotation** is written in. `Ts`'s
      phantom branch (`T extends { readonly [phantomKey]?: infer O } ? Exclude<O,
      undefined>`) returns the annotation *before* the thunk walk — that is what
      spares recursive schemas TS2589 — so a phantom-wrapped schema whose root
      admits absence would otherwise render required. Moving the walk ahead of
      the fast path would bring TS2589 back, so instead the annotation is
      `_TsRaw`-shaped: it carries `Absent` when the schema's root admits absence,
      the branch keeps `Exclude<O, undefined>` (which strips the optional-field
      artifact, not the marker), and the public `Ts` strips `Absent` as it does
      everywhere else. Enforcing it needs a **new assert**: the existing pair
      compares through public `Ts`, which strips `Absent` from both sides, so
      `Check3<number, typeof raw, typeof wrapped>` passes even when `_TsRaw<raw>`
      is `Absent | number` and the annotation says `number` — and the member then
      renders required. Add a `_TsRaw`-level check (`CheckRaw<A, B> = Equal<A,
      _TsRaw<B>>`) for the raw half, since that is the only half with teeth
      here — and update the **contract that mandates the weak pair**:
      `../../phantom/types.ts:26-38` tells every `Phantom` user to guard with
      two `Check`s "or `Check3`, which pairs the two into one assert", both of
      which route through public `Ts`. A caller following that documentation
      after stage 2 silently renders a wrapped optional member required. The
      JSDoc has to require the raw assert and say how a caller spells it, which
      means `Absent` and `CheckRaw` become part of the exported surface rather
      than internal names. Runtime is untouched: a `Phantom` has no runtime representation, so
      `admitsAbsence`
      walks the same thunk either way. Proof: an optional `Phantom`-wrapped
      member.
- [ ] Pin `Ts<[1, or(option, number)]>` as `readonly[1,number?]` from both
      renderers, with the four assignability rows above — the exactness claim is
      the point of the two stages and should fail loudly if it regresses.
- [ ] Proofs: `{}` separated from `{ a: undefined }`; `[, 3]` accepted and
      `[undefined, 3]` rejected for `[or(option, number), 3]`; the JSON
      round-trip case from
      [parse-omits-undefined-members](./parse-omits-undefined-members.md);
      `{ a: option }` as a negative field. Delete the pin this abolishes:
      `../validate/proof.f.mjs:290`, `every(rtti)(assertOk)([undefined, 5])`
      commented "the same value, spelled densely", run against
      `[option(string), number]` through all three readers and through
      `close(t)` — under stage 2 that value is present-`undefined` at position 0
      and is no longer the same value as `[, 5]`. Assert on the **built value**, not
      only acceptance: `parse([or(option, number), 3])([, 3])` has no own index
      `0` and carries `3` at index `1`.
- [ ] Delete [parse-omits-undefined-members](./parse-omits-undefined-members.md);
      restate the absence rule in `../README.md` and `../data/README.md` as the
      absent bit rather than as `undefined`.
- [ ] Changelog: **BREAKING CHANGES:** `option` is a nullary schema denoting
      absence. `option(t)` becomes `or(option, t)`, which also **narrows**: a
      schema that accepted a present `undefined` at that member no longer does.
      `parse` no longer materializes an absent member.

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
- [close-counts-trailing-undefined](./close-counts-trailing-undefined.md) —
  **collides with stage 1**, and it has landed
  ([#1716](https://github.com/functionalscript/functionalscript/pull/1716)), so
  this file is the one that restates. Its whole lever is the `close(c, rest?)`
  overload stage 1 deletes, and the README sentence its answer B owes — that a
  closed container bounds `length` — is one stage 1 rewrites. It also already
  documents the defect family this file's `array(or())` row belongs to: an empty
  `rest` skips the length check in `closeContainerValidate`, so
  `close([number], never)` and `close([number])` part company on a hole.
- [move-rtti-out-of-types](../../../todo/move-rtti-out-of-types.md) — if that
  lands first, every relative path in this file is re-anchored. Nothing here
  depends on the location, so it is a mechanical re-base, not a redesign; the
  order just needs picking rather than discovering.
- [#1719](https://github.com/functionalscript/functionalscript/pull/1719) —
  **collides with both stages.** The epic makes RTTI the single source of truth
  for the type system and works its examples in the eDSL as it stands today —
  `close([t, t])` and `option(key)` — every one of which this proposal
  respells. Its stage list is unaffected; its worked examples are not.
