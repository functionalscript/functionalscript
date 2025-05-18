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

## 3. `import`, `const`, bigint and comments

Release: 0.6.9.

```js
// import
import a from "./a.f.js"
// const and bigint
const c = -24n
export default {
    /* properties: */
    "a": [5.3, false, c],
    "b": null
}
```

## 4. Wish List

```js
import a from "./a.f.js"
// bigint
const c: bigint = -24n //< Type erasure
export default {
    _: c, /*< identifiers as properties */
    "a": [5.3, false, c],
    "f3": x => { //< function with body
        return 7
    },
    "f31": x => {
        const m = () => x //< function with constants
        return m
    },
    "f0": () => c, //< functions w/o parameters
    "f1": a => b => [a, b], //< functions with parameters
    f11: m => ({ m: 5 }) //< function returns an object
    c, //< property that references a constant with the same name
    "b": null, //< trailing comma
}
```
