# FunctionalScript

FunctionalScript is a pure functional programming language and a strict subset of 
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by 

- [JSON](https://en.wikipedia.org/wiki/JSON) as a subset of JavaScript. JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js)/[WebAssembly](https://en.wikipedia.org/wiki/WebAssembly), as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

Create a new FunctionalScript repository on GitHub [here](https://github.com/functionalscript/template/generate).

Try FunctionalScript [here](https://functionalscript.com/).

## 1. Design Principles

In FunctionalScript:

- Any module is a valid JavaScript module
- Code should not have [side-effects](https://en.wikipedia.org/wiki/Side_effect_(computer_science)). Any JavaScript statement, expression, or function which has a side effect is not allowed in FunctionalScript. There are no exceptions to this rule, such as `unsafe` code which can be found in Rust, C#, and other languages.
- A module can't depend on non FunctionalScript module. 
- It also has no standard library, only a safe subset of standard JavaScript API can be used without referencing other modules.

## 2. Outlines

### 2.1. Module Ecosystem

FunctionalScript uses [CommonJS](https://en.wikipedia.org/wiki/CommonJS) conventions as a module ecosystem. For example,

```js
const thirdPartyModule = require('third-party-package/module')

const result = thirdPartyModule.someFunction('hello')
```

### 2.2. Packages

FunctionalScript uses a `package.json` file to define a package. This file is compatible with [Node.js `package.json`](https://nodejs.org/en/knowledge/getting-started/npm/what-is-the-file-package-json/). 
The prefered way to refence dependencies is to use a GitHub URL. These dependencies in a `package.json` file could look like this,

```json
{
   ...
   "dependencies": {
      "third-party-package": "github:exampleorg/thirdpartypackage"
   }
   ...
}
```

**Note:** this repository is also a FunctionalScript package, and it can be used as a library. To install this package, use

```
npm install -S github:functionalscript/functionalscript
```

### 2.3. Module Structure

A module is a file with the `.js` extention. It contains three parts: references to other modules, definitions, and exports. For example

`./first.js`
```js
// 1. references
const math = require('math')

// 2. definitions
const myConst = 42
const addition = a => b => a + b
const add42 = addition(42)
const _10digitsOfPi = math.calculatePi(10)

// 3. exports
module.exports = {
   addition,
   add42,
   _10digitsOfPi,
}
```

`./second.js`
```js
// 1. references
const first = require('./first.js')

const _42plus7 = first.add42(7)
```

### 2.4. References To Other Modules

The format of references is `const ANYNAME = require('PATH_TO_A_MODULE')`. For example,

```js
const math = require('math')
const algebra = require('math/algebra')
const localFile = require('../some-directory/some-file.js')
```

### 2.5. Definitions

The format of defintions is `const NAME = EXPRESSION`, where the `EXPRESSION` is a subset of [JavaScript expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators).

```js
const myConst = 42
const functionDouble = a => a * 2
const structure = { name: "John", surname: "Smith" }
const array = [1, 2, 3]
const nestedStructure = { 
   address: undefined, 
   serialNumber: "123-45-78", 
   sum: 14 + myConst + functionDouble(4),
   moreInfo: { 
      name: "Ivan",
      surname: "Terrible",
   } 
}
```

### 2.6. Exports

The format of exports is `module.exports = { A_LIST_OF_EXPORTED_DEFINITIONS }`. There should be only one `module.exports` at
the end of a FunctionalScript file. For example,

```js
module.exports = {
   nestedStructure,
   array,
   structure,
}
```

## 3. Expressions
