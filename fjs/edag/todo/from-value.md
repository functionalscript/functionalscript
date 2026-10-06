## from-value. Two modules convert a plain value into EDAG literal nodes

**Priority:** P4
**Status:** wip

### Problem

Turning a value into fresh `'[]'`, `'{}'`, `':'` and leaf nodes is
written in the JSON-import linker and again in the test corpus:

```js
// fjs/compiler/edag, jsonEdag and jsonMember
value instanceof Array ? ['[]', value.map(jsonEdag)] : ['{}', definedEntries(value).map(jsonMember)]
// fjs/nanvm, constExp
if (v === undefined) { return ['undefined'] }
if (Array.isArray(v)) { return ['[]', v.map(f)] }
… ['{}', entries(v).map(([k, p]) => [':', k, f(p)])]
```

The corpus copy adds a hook for thunks; the linker copy has its own
`undefinedNode`. Each made its own choices — `definedEntries` against `entries`,
`undefined` handled in one and not the other — so they can drift, and
neither is specific to its module: the conversion belongs with the
schema, beside `array`, `object` and `property` here.

One of those choices is observable and has to be settled: for
`{ a: undefined }`, `constExp` emits the property with an
`['undefined']` node and `jsonEdag` omits it. `fromValue` keeps it. A
member that is present with the value `undefined` is a member, and the
EDAG has a node for the value, so the corpus's behaviour is the
contract; `jsonEdag` loses nothing by it, since a parsed JSON document
holds no `undefined`, and its `definedEntries` was never reached by
one.

### Proposal

```ts
/** A value the EDAG spells as literal nodes: a primitive leaf, `undefined`, an array or an object of them, or an `F` the caller answers. */
export type Plain<F> =
    | Primitive | undefined | F
    | readonly Plain<F>[]
    | { readonly [k in string]?: Plain<F> }
/** `v` as fresh literal nodes: a primitive as itself, `undefined`, an array, an object; `other` answers an `F`. */
export const fromValue: <F extends Function>(other: (f: F) => Exp) => (v: Plain<F>) => Exp
```

`F` is bounded by `Function` because `typeof v === 'function'` is the
one test the walk has for it: an `F` a `typeof` cannot tell from a
plain object — a `Date`, say — would be walked as an object and never
reach `other`, so the bound refuses such an instantiation at the type.
Both callers' `F`s are functions today: the corpus's thunk arms, and
the function `jsonEdag` refuses.

in `fjs/edag/module.f.mjs`, with `Plain` in `fjs/edag/types.ts` beside
`Primitive`. The input is not `unknown`: a symbol, or anything else the
EDAG has no leaf for, is a type error rather than a value returned
under a cast or refused by a throw the signature does not mention.
`fjs/nanvm/types.ts`'s `Const` is this shape with its thunk union as
`F`, so `constExp(resolve)` is `fromValue` with its thunk hook as
`other` and `Value` becomes `Plain<F>` over every thunk arm `Value`
lists today — `Ref`, `FunctionValue`, `Callback`, `Returns` and
`Unreached` — so that a corpus value built with `returns(…)` stays
assignable, as its proofs require. `jsonEdag` today has no function arm at all,
since a JSON document holds none, so its `other` refuses one: a
callback that throws, the way `valueExp`'s resolver throws on a name it
has no value for, with the linker's proof pinning the throw so the
callback is covered.

### Tasks

- [ ] `fromValue` with a proof; the two sites through it.
- [ ] `tsc`, `fjs test`; `npm run gen` regenerates byte-identical.

### Related

- [leaf-dedup.md](./leaf-dedup.md) — deduplicating leaves; a policy
  `fromValue` could later take.
