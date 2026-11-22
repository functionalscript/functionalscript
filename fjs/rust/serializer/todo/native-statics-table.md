## The natively bound statics as a table

**Priority:** P3
**Status:** open

### Problem

Where no runtime is given, `operation` in
[`module.f.js`](../module.f.js) binds a static to a Rust closure. The
wrapper is spelled out at each site:

```js
map1(pure(result))(ok(cat(['A::static_function(|_self, _args| ', <body>, `, <arity>, `, vm('Array'), `::default(), ${represented(staticText(tag))})`, toAny])))
```

for `String.fromCharCode`, the unary `Math` methods, `Math.imul`,
`Math.max`/`Math.min`, `Object.entries` and the helpers. `closure` is one
more, with captures in place of `Array::default()`.

Which statics are bound is listed twice in the same function: a refusal
guard, a chain of `tag !== '…' &&` tests, and then the `if (tag === …)`
branches under it. A new native is an edit to both, and one added to the
branches only is refused by the guard before it is reached.

The copies have drifted. The arity is a marked number at some sites
(`num('1')` for `Object.entries`, ``num(`${length}`)`` for a helper) and
plain text inside a template at the others, so the marked output
colours the arity of some natives and not of others. The plain text is
the same either way.

### Proposal

```js
/** `A::static_function(|_self, _args| body, arity, Array::default(), text).to_any()` */
const nativeFunction = (body, arity, text) => …

/** @type {StringMap<readonly [body: Printed, arity: number]>} */
const staticNatives = {
    'String.fromCharCode': [[vm('String'), '::from_char_code(_args).map(|v| v.to_any())'], 1],
    'Math.imul': […, 2],
    …
}
```

The guard is `entry(staticNatives, tag) === undefined`, the sites
are rows, the unary `Math` methods and `max`/`min` are rows that a small
function makes from the method's name, and the arity is marked in one
place.

### Drawbacks

- The committed `gen.*` Rust must stay byte for byte, which the plain
  text does; the marked text changes where an arity gains its mark.
- A table of bodies is a table of Rust fragments. If the set of natives
  is about to move into the runtime
  ([runtime-static](../../../js/todo/runtime-static.md)), this is churn
  on code that is leaving, and the table should wait for that decision.
