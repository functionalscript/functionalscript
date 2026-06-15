# 66F-json-stringify-skip-undefined. `stringify` should skip `undefined`-valued properties

**Priority:** P2
**Status:** done

## Problem

`JSON.stringify` omits object properties whose value is `undefined`. Our `stringify` in
`fs/json/module.f.ts` does not — it reaches the `default` branch of the `typeof` switch
with `undefined`, passes it to `objectSerialize`, and `Object.entries(undefined)` throws.

TypeScript optional fields (`field?: T`) are set to `undefined` legitimately. `Object.entries`
includes such entries. The result is that rtti-derived types with `option(…)` fields — e.g.
`error.data` (`option(unknown)`) and `nextCursor` (`option(string)`) in the MCP schemas —
cause `stringify` to crash when a step leaves those fields `undefined`.

A test demonstrating the expected (currently failing) behaviour exists in `fs/json/proof.f.ts`:

```ts
undefined: () => {
    assertEq(stringify(sort)({ x: undefined }), '{}')
}
```

## Workaround

`fs/mcp/stdio/module.f.ts` works around this with a pre-filter on every object's entries:

```ts
const defined = filter(([,v]: Entry) => v !== undefined)
const stringifyJson = stringify(e => sort(defined(e)))
```

Once `stringify` handles `undefined` natively, `stringifyJson` can simplify back to
`stringify(sort)` and the `defined` filter can be removed.

## Proposal

`definedEntries` already exists in `fs/types/object/module.f.ts` — it wraps `Object.entries`
and drops `undefined`-valued pairs. Import it in `fs/json/module.f.ts` and use it in place
of `entries` inside `objectSerialize`:

```ts
import { definedEntries, ... } from '../types/object/module.f.ts'
```

```ts
const objectSerialize
    : (object: Object) => List<string>
    = fn(definedEntries)
    .map(sort)
    .map(mapPropertySerialize)
    .map(objectWrap)
    .result
```

No new helper needed. Filtering happens before `mapEntries` so all callers benefit automatically.

## Tasks

- [x] Fix `serialize` in `fs/json/module.f.ts` to skip entries where `v === undefined`
- [ ] Confirm the `proof.undefined` test passes
- [x] Remove the `defined` workaround from `fs/mcp/stdio/module.f.ts`

## Related

- `fs/json/proof.f.ts:64` — failing test
- `fs/mcp/stdio/module.f.ts:41` — workaround (`defined` filter)
- `fs/mcp/module.f.ts:98` — `nextCursor: option(string)` — a field that becomes `undefined`
- `fs/json/rpc/module.f.ts:45` — `error.data: option(unknown)` — another such field
