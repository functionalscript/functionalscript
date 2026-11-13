## Compile the schema-form readers

**Priority:** P2
**Status:** blocked
**Blocked by:** mutual recursion in a function body and the modules `common` imports

### Problem

`common` and `validate` are written in constructs the compiler accepts but for
three things, so neither module can be renamed `.f.js`:

- **`declaredTest`** builds a `Set` of a schema's declared names, so the
  undeclared-member walk asks one lookup a key rather than scanning the
  names — a scan made a 10 000-member tuple quadratic. The language has no
  `Set`; replace it with an object of the names read with `hasEntry`.
  `Object.fromEntries` is now admitted and builds that object in linear
  time.
- **`readerOf`**'s `read` and `visitor` refer to each other, and a body
  `const` cannot read a later one
  ([3140](../../../spec/todo/3140-forward-references.md)): the object
  grouping that record proposes would resolve it. A `read` that builds the
  visitor itself, which the self case already admits, compiles but builds
  every container handler again on each call.
- **`types/object`**, imported for `isObject`, `at`, `definedEntries` and
  `definedValues`, destructures `Object`. Its
  [`array`](../../types/array/module.f.js),
  [`ordered_map`](../../types/ordered_map/module.f.js),
  [`btree`](../../types/btree/module.f.js) and
  [`list`](../../types/list/module.f.js) dependencies are now compiler-compatible.

`validate` imports `common` and `data`, and `data` has refusals of its own.

`hasUndeclaredMember`'s `Object.keys` is now admitted and no longer blocks
compilation. Its shared reference body projects entries through array `map`;
it does not supply a native enumeration optimization. The earlier measurement
found entry enumeration three times slower on a 500 000-key record than the
host's `Object.keys`, so that performance distinction remains.

### Direction

Each item above is its own pull request once what it waits on lands;
`types/object` may instead give the four helpers rtti uses a module that
compiles.
