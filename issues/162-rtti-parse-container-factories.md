# 162. RTTI `parse`: mirror `validate`'s container factories

`fs/types/rtti/validate/module.f.ts` already factors its four container
handlers into two parameterized factories:

- `containerValidate(isContainer, getEntries)` builds the `array` and `record`
  validators (lines 78–112).
- `constContainerValidate(isContainer, getItem)` builds the `tuple` and
  `struct` validators (lines 119–144).

`fs/types/rtti/parse/module.f.ts` instead hand-writes all four as separate
functions — `arrayParse` (76–93), `recordParse` (95–111), `tupleParse`
(113–122), `structParse` (124–135) — each repeating the same skeleton:

```
guard container type  →  (empty-check)  →  map items through parse
→  first error?  →  prependPath(key, err)  :  ok(rebuilt value)
```

`arrayParse`/`recordParse` share the `indexedFirstError` / `keyedFirstError` +
`map` + `prependPath` shape; `tupleParse`/`structParse` likewise. The only
real differences are `commonIsArray` vs `commonIsObject`, index vs key, and
`[]`/`results.map(r => r[1])` vs `{}`/`Object.fromEntries(...)` reconstruction.

## Why it can't just import `validate`'s factories

`validate` returns the value unchanged on success (identity), so its factories
build no output. `parse` *transforms* — it rebuilds the array/record/tuple/
struct from each item's parsed result (`results.map(r => r[1])`,
`Object.fromEntries(...)`). So `parse` needs its own factory pair, structurally
mirroring `validate`'s but with a `build` callback:

```ts
const containerParse =
    <K extends Tag1>(
        isContainer: IsContainer<Container<K>>,
        getEntries:  GetEntries<Container<K>>,
        rebuild:     (entries: readonly (readonly[string, Unknown])[]) => Unknown,
    ) => <I extends Type>(item: I): Parse<Info1<K, I>> => value => { … }

const arrayParse  = containerParse<'array'>(isArray,  arrayEntries,  es => es.map(([, v]) => v))
const recordParse = containerParse<'record'>(isObject, Object.entries, Object.fromEntries)
```

and a `constContainerParse` for the `tuple`/`struct` pair, paralleling
`constContainerValidate`. This is a precedent-backed consistency fix: the
sibling module already demonstrates the exact factory shape, so `parse` reading
differently is an avoidable divergence — and a future change to container
traversal (as in the recent validate/parse work) would otherwise have to be
applied in four places instead of two.

## Note

Both `parse` and `validate` lean on `as any` to bridge the schema-driven
generics (`indexedFirstError`/`keyedFirstError` results, the `ok(...)` returns).
That casting is tracked in [i146](./146-rtti-ts-inference.md); this factory
extraction should not add new casts beyond what the two existing factories in
`validate` already require, and ideally removes a few by funnelling the
reconstruction through one typed `rebuild` per factory.

## Related

- [i143](./143-rtti-data.md) — RTTI data form.
- [i146](./146-rtti-ts-inference.md) — the `Ts<T>` inference / `as any` problem
  these modules work around.
