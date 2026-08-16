# Delete `validate`

**Priority:** P2
**Status:** open — decided; implement

## Decision

Delete `../validate/module.f.mjs`. `parse` is the way to read a value against
a schema.

With it goes the question of what a *validator* does about extra members.
Structs and tuples are **open** — a value carrying more than the schema
declares is accepted — and `parse` constructs a fresh value holding exactly
what the schema declares, so the extras are accepted on the way in and simply
absent on the way out.

## Deleting is not the same as reverting #1622

#1622 added an exact-length check for tuples. That check lives **only** in
`validate`; `parse` never had one. So deleting the module removes it outright
— there is nothing to revert, and no intermediate state where the two readers
disagree.

`parse` is already open on both counts, verified against `805aabe`:

```js
parse([42])([42, 'extra'])              // ['ok', [42]]              extra element accepted, dropped
parse({ a: 42 })({ a: 42, b: 'x' })     // ['ok', { a: 42 }]         extra key accepted, dropped
parse([number, option(string)])([42])   // ['ok', [42, undefined]]   short array, trailing optional filled
parse([42])([])                         // ['error', …]              42 excludes undefined, so position 0 is required
```

The last two are the same rule the data form already states for objects
(`../data/types.ts:42-44`): an absent member reads as `undefined`, so a member
is required exactly when its set excludes `undefined`. `parse` applies it to
both kinds.

## Why the `Ts<T>` argument for closing tuples does not hold

#1622 argued that `Ts<readonly [42]>` is the exact tuple, so a 2-element array
is not assignable to it. The open mapping in `TupleTs`
(`../ts/types.ts:78-80`) is commented out because TypeScript could not handle
it, not because open tuples were rejected:

```ts
export type TupleTs<T extends Tuple> =
    // readonly[...{ readonly[K in keyof T]: Ts<T[K]> }, ...readonly Unknown[]]
    { readonly[K in keyof T]: Ts<T[K]> }
```

TypeScript's expressiveness does not define the value model. A schema
describes a set of values; `Ts<T>` renders that set into TypeScript as well as
TypeScript allows, and where it cannot, `Ts<T>` is what is incomplete.

Schemas that want exact members say so explicitly — see
[close-type.md](./close-type.md).

## Migration

Nine modules import `validate`:

| module | use |
| --- | --- |
| `../../../protocol/mcp/module.f.mjs:172` | tool-argument decoding, result passed to `handle` |
| `../../../protocol/json_rpc/module.f.mjs:66` | `decodeRequest` |
| `../../../protocol/json_rpc/proof.f.mjs:7` | proof |
| `../../../dev/package_json/module.f.mjs:26` | `validatePackageJson` |
| `../../../media/module.f.mjs:123` | `dialectEntry`, via `matchWith` |
| `../../../media/revision/module.f.mjs:133` | `validateShape` |
| `../../../media/lock/module.f.mjs:74` | `validateShape` |
| `../../../media/note/module.f.mjs:113` | `validate` (re-exported) |
| `../../../media/json/rtti/proof.f.mjs:11` | proof |

`parse` is not a drop-in. Three differences to check per site:

- **The result is a fresh value.** Reference identity is not preserved, so a
  site that compares the result against its input by identity, or relies on
  getting the same object back, changes behavior.
- **Extras are gone from the result.** Any site that validates and then reads
  a member the schema does not declare stops seeing it. Worth checking
  `media/module.f.mjs`, where `matchWith` hands the value to a caller-supplied
  `extraValidate` — that predicate will now receive the parsed value.
- **It allocates.** `validate` returned its argument; `parse` rebuilds. In
  `media`'s dialect detection this runs once per candidate dialect per value,
  so measure there rather than assuming it is free.

## Scope: only the schema-form `validate`

`../data/module.f.mjs` also exports a `validate`. That is a different
function — the reader for the serializable data form — and the data module has
**no** `parse`, so deleting it would leave the data form unreadable. Keep it.

## One thing deleting `validate` does not fix

The data form still describes tuples as closed, so it disagrees with `parse`:

```js
parse([42])([42, 'extra'])                    // ['ok', [42]]
validate(toData([42]))([42, 'extra'])         // ['error', …]   data form
```

`toData` maps a `Tuple` to `{ prefix }` with no `rest`, and an absent `rest`
means closed on arrays but open on objects (`../data/module.f.mjs:296-320`:
`arraySet` normalizes a `rest` of `never` away, `objectSet` normalizes a
`rest` of `unknown` away). Making the data form agree means mapping `Tuple` to
`{ prefix, rest: unknown }` and dropping `arraySetValidate`'s minimum-length
check (`:994-998`) in favour of "a position past the value's end reads as
`undefined`" — the object rule, applied to arrays.

That is a self-contained change and can be split into its own issue if this
one is already large; it is recorded here so it is not lost.

## Make sure openness does not get "fixed" again

The failure mode is specific: someone reads `Ts<T>`, concludes tuples are
exact, and adds a length check. Guard it where that person will be looking.

- A proof case asserting extras are accepted, on both kinds, whose comment
  says *why* and points here — not just "extras are allowed".
- `../README.md`'s "Tuples are closed, structs are open" section describes the
  post-#1622 state; replace it with open-by-default plus a pointer to `close`.
- Annotate `../ts/types.ts:78-80` so the commented-out mapping reads as a
  TypeScript limitation rather than a design decision.

## Tasks

- [ ] Migrate the nine importers to `parse`, checking the three differences
      above at each site.
- [ ] Delete `../validate/module.f.mjs` and its proof. The deletion itself is
      clean: all nine importers take only `validate`; nothing imports the four
      symbols it re-exports from `../common/module.f.mjs`
      (`constPrimitiveValidate`, `prependPath`, `primitive0Validate`,
      `verror`); `parse` imports from `common` directly, not through
      `validate`; and neither `deno.json` nor `package.json` names the path.
- [ ] Document openness in `../README.md`; add the guard proofs and the
      `ts/types.ts` annotation.
- [ ] `npx tsc`, `fjs t`, `npm run cov`.
- [ ] Optional, or split: make the data form open for tuples (see above).

## Related

- [close-type.md](./close-type.md) — the explicit closed form; the other half
  of this decision.
- `../parse/module.f.mjs` — its module header already documents the
  fresh-value contract and the forward-compatibility reason for it.
