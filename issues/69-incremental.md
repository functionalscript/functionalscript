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
import a from "./a.f.js"
// bigint
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
const c = -24n
export default {
    /* properties: */
    _: c, //< identifiers as properties
    "a": [5.3, false, c],
    "f0": () => c, //< functions w/o parameters
    "f1": a => b => [a, b], //< functions with parameters
    "b": null, //< trailing comma
}
```
