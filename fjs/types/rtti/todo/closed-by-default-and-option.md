# Closed containers by default, then `option` as omission

**Priority:** P2
**Status:** open

Two stages, in this order:

1. a bare `Const` is **closed**; `open(c)` / `rest(c, r)` state otherwise;
2. `option(t)` means **the member may be absent**, no longer `or(t, undefined)`.

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

### Stage 2 — `option(t)` means the member may be absent

`option(t)` states that the member **may be omitted**; when present it must be `t`.
It stops being a union and stops being a `Type`.

**It is not a set of values, so it is not a `Type`.** "May be omitted" is a
property of a position in a container, not of a value — `array(option(number))`,
`record(option(t))` and `or(option(x), y)` have no meaning. The ADT splits:

```
Member = Type | Option<Type>
```

legal only directly at a struct key or a tuple position. That is exactly
TypeScript's rule for `?`, and it is the price of the gap being closed; today's
uniformity is what buys the gap.

**Absence, per kind.** A struct key is absent when the value has no such own key.
A tuple position is absent when the value has no such index — past the end *or* a
hole — which makes the value side symmetric with the schema side settled in #1712,
where a hole in a schema is a declared `undefined` position.

| schema | accepts | rejects |
| --- | --- | --- |
| `{ a: option(string) }` | `{}`, `{ a: 'x' }` | `{ a: undefined }` |
| `{ a: or(string, undefined) }` | `{ a: 'x' }`, `{ a: undefined }` | `{}` |
| `{ a: option(or(string, undefined)) }` | all three | — |
| `[number, option(string)]` | `[42]`, `[42, 'x']` | `[42, undefined]` |

The third row is today's `option`, so **nothing becomes inexpressible** — stage 2
is strictly additive.

**The data form pays a flag.** A `props` entry and an array `prefix` position
become `{ optional, node }`. Union is `optional ||`, `subset` is
`optional ⇒ optional` plus node inclusion, `cmp`/`equal` gain the field, and the
rule "a member is required exactly when its set excludes `undefined`" is replaced
by the flag everywhere it is stated — `../README.md`, `../data/README.md`, and the
degenerate-pattern simplification that drops "a trailing position restating a
`rest` that admits absence".

**The readers gain a presence check** in place of read-yields-`undefined`, and
`parse`'s output stops being a choice: an absent optional member stays absent, a
present one is built. That closes
[parse-omits-undefined-members](./parse-omits-undefined-members.md) — delete it in
this stage — and with it the array kind's JSON round-trip defect.

**`Ts<>` becomes exact under `exactOptionalPropertyTypes`:** `option(t)` renders
`readonly k?: t`, `or(t, undefined)` renders `readonly k: t | undefined`.
`OptionalFields`/`RequiredFields` in [`../ts/types.ts`](../ts/types.ts) key on the
`Option` wrapper instead of on `undefined extends Ts<T[K]>`. `TupleTs`'s
trailing-run limit stays — TypeScript forbids a required element after an optional
one — but it is now a *rendering* limit only, with no claim about the set.

**Where the distinction is observable.** `JSON.stringify` drops an
`undefined`-valued key, so no JSON-sourced value exhibits it. It matters for
in-memory values, for DJS text, and for `../../../cas` addressing, where two
RTTI-equal values that serialize differently address differently.

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

- [ ] `Member = Type | Option<Type>` in `../types.ts`; `option` legal only at a
      struct key or tuple position, and rejected under `array`/`record`/`or`.
- [ ] `../data`: `{ optional, node }` on `props` entries and `prefix` positions;
      `subset`, `cmp`, `equal`, union and the degenerate simplifications.
- [ ] `../parse`/`../validate`: presence check per kind — own key for structs, own
      index (past end or hole) for tuples. `parse` omits an absent member.
- [ ] `../ts/types.ts`: `OptionalFields` keys on `Option`; `option(t)` → `k?: t`.
- [ ] Proof: the JSON round-trip case from
      [parse-omits-undefined-members](./parse-omits-undefined-members.md), and a
      row separating `{}` from `{ a: undefined }`.
- [ ] Delete [parse-omits-undefined-members](./parse-omits-undefined-members.md);
      restate the absence rule in `../README.md` and `../data/README.md` as the flag.
- [ ] Changelog: **BREAKING CHANGES:** `option(t)` is omission, not
      `or(t, undefined)`; `parse` no longer materializes an absent member.

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
