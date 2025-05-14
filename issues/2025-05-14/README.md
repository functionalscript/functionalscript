# FunctionalScript

## 1. FunctionalScript

FunctionalScript is a purely functional subset of JavaScript

What does it mean?
- subset: FunctionalScript modules (`.f.js`) can be used in JavaScript or TypeScript modules,
- functional: functions are the first-class citizens
- purely: no side effects, deterministic and reproducible:
  - all objects are immutable
  - no direct I/O access

## 2. How should it look like?

```js
// `math.f.js`
export default {
    add: a => b => a + b
    mul: a => b => a * b
}
```

```js
// `app.js`
import math from "./math.f.js"

const add2 = math.add(2)
console.log("5 == ", add2(3))
```

State: WiP

## 3. JSON

JSON is the most popular data format. It's a tree

```json
{
    "a": { "name": "shared object" },
    "b": { "name": "shared object" }
}
```

JSON is a subset of JavaScript.

## 4. Using FunctionalScript as data format

Supports `const` and `import` (ECMAScript).

```js
// shared.f.js
export default { "name": "shared object" }
```

```js
// data.f.js
import shared from "./shared.f.js"
const s = "hello!"
export default {
    a: shared,
    b: shared,
    s,
}
```

Now it's a graph.

## 5. Demo

```sh
npm install --global functionalscript
```

```sh
# to FJS
fsc data.f.js output.f.js
# to JSON
fsc data.f.js output.json
```

## 6. Plans

- Gradually add more features, such as functions, operators, and
  TypeScript type-erasure.
- BAST, Binary Abstract Syntax Tree.
- Language Specification.
- Content-Addressable VM.

## 7. Links

- https://github.com/functionalscript/functionalscript
  - support the project
- License:
  - currently, it's AGPL (copyleft) but we may change it in the future, when we have funding.
  - if you need another license, contact us: sergey.oss@proton.me.
