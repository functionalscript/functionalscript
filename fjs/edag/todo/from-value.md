## from-value. Two modules convert a plain value into EDAG literal nodes

**Priority:** P4
**Status:** open

### Problem

Turning a value into fresh `'[]'`, `'{}'`, `':'` and leaf nodes is
written in the JSON-import linker and again in the test corpus:

```js
// fjs/fsc/edag, jsonEdag and jsonMember
value instanceof Array ? ['[]', value.map(jsonEdag)] : ['{}', definedEntries(value).map(jsonMember)]
// fjs/nanvm, constExp
if (v === undefined) { return ['undefined'] }
if (Array.isArray(v)) { return ['[]', v.map(f)] }
… ['{}', entries(v).map(([k, p]) => [':', k, f(p)])]
```

The corpus copy adds a hook for thunks; the linker copy has its own
`undefinedNode`. Each made its own choices — `definedEntries` against
`entries`, `undefined` handled in one and not the other — so they can
drift, and neither is specific to its module: the conversion belongs
with the schema, beside `array`, `object` and `property` here.

### Proposal

```ts
/** `v` as fresh literal nodes: a primitive as itself, `undefined`, an array, an object; `other` answers a function. */
export const fromValue: (other: (f: Function) => Exp) => (v: unknown) => Exp
```

in `fjs/edag/module.f.mjs`. `constExp(resolve)` is `fromValue` with its
thunk hook as `other`. `jsonEdag` today has no function arm at all,
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
