## Path-aware JSON serialization

**Priority:** P3
**Status:** open

### Problem

[`serialize` and `stringify`](../module.f.ts) accept one `MapEntries` function:

```ts
type MapEntries = (entries: Entries) => Entries
```

That function is applied to every object in the JSON value. It cannot distinguish
the root object from a particular nested field.

The revision lock-map task needs to sort object entries only inside the `lock`
subtree. Applying the existing global mapper would also reorder the top-level
revision fields and every unrelated nested object, changing existing serialized
bytes and CAS hashes. Pre-serializing `lock` separately is not valid because
passing the resulting string through the normal serializer would quote it as a
JSON string.

### Proposal

Add path-aware variants while keeping the existing APIs and behavior:

```ts
export type PathSegment = string | number
export type Path = readonly PathSegment[]

type MapEntriesAt = (path: Path) => MapEntries

export const serializeAt
    : (mapEntriesAt: MapEntriesAt) => (value: Unknown) => List<string>

export const stringifyAt
    : (mapEntriesAt: MapEntriesAt) => (value: Unknown) => string
```

Path rules:

- the root value has path `[]`;
- an object property appends its string key;
- an array element appends its numeric index;
- the mapper receives the path of the object whose entries it is mapping.

Preserve the current APIs as adapters:

```ts
export const serialize = (mapEntries: MapEntries) =>
    serializeAt(_path => mapEntries)

export const stringify = (mapEntries: MapEntries) =>
    stringifyAt(_path => mapEntries)
```

Therefore all existing callers retain exactly the same output.

### Revision lock use

The revision writer can preserve its existing top-level order while sorting only
lock maps:

```ts
const revisionEntries = (path: Path): MapEntries =>
    path[0] === 'lock' ? sortEntries : identity

const toJson = stringifyAt(revisionEntries)
```

For Stage 1, only the object at `['lock']` is sorted. For recursive Stage 2,
every object whose path starts with `'lock'` is sorted, including nested maps.
Objects outside the lock subtree retain current enumeration order.

### Tasks

- [ ] Add exported `PathSegment`, `Path`, and path-aware entry-mapper types.
- [ ] Add `serializeAt` and thread paths through object properties and array
      elements.
- [ ] Add `stringifyAt` over `serializeAt`.
- [ ] Reimplement existing `serialize` and `stringify` as path-ignoring adapters
      without changing their signatures or output.
- [ ] Add proofs that `stringify(identity)` remains byte-for-byte identical for
      representative primitives, arrays, and nested objects.
- [ ] Add proofs for root, object-property, nested-object, and array-index paths.
- [ ] Add a selective-sorting proof where one named subtree is sorted while the
      root and sibling subtrees preserve their existing order.
- [ ] Include numeric-looking object keys such as `"10"` and `"2"` in the
      selective-sorting proofs.

### Out of scope

- Defining one universal canonical JSON format.
- Changing the default object enumeration order.
- Revision-specific schemas, validation, or lock semantics.
- JSON Pointer or query-language path syntax.

### Dependents

- [Revision lock map](../../todo/revision-lock-map.md), Stage 1 and Stage 2
  canonical lock serialization.
