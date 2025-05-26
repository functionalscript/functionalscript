# Incremental

## 1. JSON

```json
{
    "a": [5.3, false],
    "b": null
}
```

## 2. `export default`

```js
export default {
    "a": [5.3, false],
    "b": null
}
```

## 3. `import`, `const`, bigint, undefined and comments

Release: 0.6.9.

```js
// import
import a from "./a.f.js"
// const and bigint
const c = -24n
export default {
    /* properties: */
    "a": [5.3, false, c],
    "b": null,
    "c": undefined
}
```

## 4. Next

- identifier properties
- trailing comma

```js
// import
import a from "./a.f.js"
// const and bigint
const c = -24n
export default {
    /* properties: */
    "a": [5.3, false, c],
    "b": null,
    c: c, //< identifier properties and trailing comma
}
```

## 5. Wish List

```js
import a from "./a.f.js"
const c: bigint = -24n //< Type erasure
export default {
    1e3: c //< number properties.
    _: c, /*< identifiers as properties */
    "a": [5.3, false, c],
    "f1": x => { //< function with body
        return 7
    },
    "f2": x => {
        const m = () => x //< function with constants
        return m
    },
    "f3": () => c, //< functions w/o parameters
    "f4": a => b => [a, b], //< functions with parameters
    f11: m => ({ m: 5 }) //< function returns an object
    c, //< property that references a constant with the same name
    "b": null,
    'x': 'x', //< single quoted strings.
}
```
