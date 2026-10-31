## Compile the schema-form readers

**Priority:** P2
**Status:** blocked
**Blocked by:** admitting `Object.keys`, mutual recursion in a function body, and the modules `common` imports

### Problem

`common` and `validate` are written in constructs the compiler accepts but for
five things, so neither module can be renamed `.f.js`:

- **`declaredTest`** builds a `Set` of a schema's declared names, so the
  undeclared-member walk asks one lookup a key rather than scanning the
  names — a scan made a 10 000-member tuple quadratic. The language has no
  `Set`; replace it with an object of the names read with `hasEntry`.
  `Object.fromEntries` is now admitted and builds that object in linear
  time.
- **`hasUndeclaredMember`** asks `Object.keys`, which is not admitted: it
  exists to stop at the first undeclared key without reading any value,
  and `Object.entries`, the one admitted enumeration, reads every value and
  builds every pair first — three times slower on a 500 000-key record.
  [2360](../../../spec/todo/2360-built-in.md) lists `keys` as free of side
  effects; it needs an admission of its own.
- **`readerOf`**'s `read` and `visitor` refer to each other, and a body
  `const` cannot read a later one
  ([3140](../../../spec/todo/3140-forward-references.md)): the object
  grouping that record proposes would resolve it. A `read` that builds the
  visitor itself, which the self case already admits, compiles but builds
  every container handler again on each call.
- **`types/array`**, imported for `isArray`, waits on `occurrences`
  ([`occurrences-without-map`](../../types/array/todo/occurrences-without-map.md)).
- **`types/object`**, imported for `isObject`, `at`, `definedEntries` and
  `definedValues`, destructures `Object` and still imports the unconverted
  `types/array` and `list/iterable` modules. Its
  [`ordered_map`](../../types/ordered_map/module.f.js),
  [`btree`](../../types/btree/module.f.js) and
  [`list`](../../types/list/module.f.js) dependencies are now compiler-compatible.

`validate` imports `common` and `data`, and `data` has refusals of its own.

### Direction

Each item above is its own pull request once what it waits on lands;
`types/object` may instead give the four helpers rtti uses a module that
compiles.
