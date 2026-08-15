# FunctionalScript

> **Note:** This file is parked and stale; see [todo/samples.md](../samples.md) for
> the plan to migrate its usable content into a top-level `samples/` directory
> and delete this file.

## 1. What is FunctionalScript?

FunctionalScript is a **purely functional subset of JavaScript**.

### What does that mean?

* **Subset**: `.f.mjs` modules can be imported and used in JavaScript or TypeScript code without transpilation.
* **Functional**: Functions are first-class citizens and support composition and currying.
* **Purely functional**: No side effects. Execution is deterministic and reproducible:

  * All values are **immutable**.
  * No direct access to I/O (file system, network, etc.).

## 2. Example

FunctionalScript modules look like this:

```js
// math.f.mjs
export default {
  add: a => b => a + b,
  mul: a => b => a * b,
}
```

You can use them from regular JavaScript:

```js
// app.js
import math from "./math.f.mjs"

const add2 = math.add(2)
console.log("5 ===", add2(3))
```

Parser status: Work in Progress (WiP)

## 3. FunctionalScript as a Data Format

### JSON is a Tree

```json
{
  "a": { "name": "shared object" },
  "b": { "name": "shared object" }
}
```

Note: Although `"a"` and `"b"` reference equal values, they're *not* the same object.

### FunctionalScript is a Graph

With `import` and `const`, you can express **shared references** and **identity**:

```js
// shared.f.js
export default { "name": "shared object" }
```

```js
// data.f.js
import shared from "./shared.f.js"
const s = "hello!"
export default {
  "a": shared,
  "b": shared,
  "s": s
}
```

## 4. Getting Started

Install the CLI:

```sh
npm install --global functionalscript
```

Convert `.f.mjs` files:

```sh
# From JSON to FJS
fjs compile tree.json _tree.f.mjs

# To FunctionalScript (FJS)
fjs compile data.f.mjs _data.f.mjs

# To JSON
fjs compile data.f.mjs _data.json
```

## 5. Test Framework in FunctionalScript

```js
// test.f.mjs
const arrayOfTests = [
  () => {
    if (2 + 2 !== 4) throw "It's the end of the world as we know it!"
  },
  () => {
    if (2n + 2n !== 4n) throw "It's the end of the world as we know it!"
  }
]

export default {
  arrayOfTests,
  generatingTests: () => arrayOfTests,
}
```

Run it with:

```sh
fjs test
```

## 6. Roadmap

We are gradually adding more features:

* Language features:

  * Function support
  * Operators and control flow
  * Non-default exports
* Tooling:

  * BAST: Binary Abstract Syntax Tree for FunctionalScript
  * Language specification (draft in progress)
* Virtual Machines (executes BAST):

  * Content-addressable VM written in Rust compatible with Web3 and DWeb
  * AOT compiler: BAST to WebAssembly

## 7. Contribute & License

* **GitHub**: [github.com/functionalscript/functionalscript](https://github.com/functionalscript/functionalscript)
* **Contribute**: We host **weekly contributor meetings**: everyone’s welcome.
* **License**:

  * Currently: MIT.
  * Need a custom license? Contact us: `sergey.oss@proton.me`
