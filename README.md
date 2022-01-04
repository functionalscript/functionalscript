# FunctionalScript

FunctionalScript is a pure functional programming language and a strict subset of 
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by 

- [JSON](https://en.wikipedia.org/wiki/JSON) as a subset of JavaScript. JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js)/[WebAssembly](https://en.wikipedia.org/wiki/WebAssembly), as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

Create a new FunctionalScript repository on GitHub [here](https://github.com/functionalscript/template/generate).

## 1. Design Principles

In FunctionalScript:

- Any module is a valid JavaScript module. No additional build steps are required.
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
   // ...
   "dependencies": {
      "third-party-package": "github:exampleorg/thirdpartypackage"
   }
   // ...
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
// addition(a)(b) = a + b
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

// 2. definitions
const _42plus7 = first.add42(7)

// 3. exports
module.exports = {
   _42plus7,
}
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

See [3. Expressions](#3-Expressions).

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

Expressions could fall under these categories:

- Literals:
  - Number Literals, e.g. `0`, `3.14`, `4e8`
  - Boolean Literals: `true` or `false`
  - A `null` Literal
  - An `undefined` Literal
  - String Literals, e.g. `"Hello world!"`
- Complex Structures
  - Arrays, e.g. `[2, 5]`
  - Objects, e.g. `{ a: "Hello", b: "world!" }`
  - Arrow functions, e.g. `x => x * 2`
- Operators
  - Comparison Operators: `===`, `!==`, `>`, `>=`, `<`, `<=`
  - Arithmetic Operators: `+`, `-`, `*`, `/`, `%`, `**`
  - Bitwise Operators: `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`
  - Logical Operators: `&&`, `||`, `!`, `??`
  - Conditional Operator, e.g. `condition ? val1 : val2`
  - Template Literals, e.g. `string ${expression}` 
  - `typeof`
  - Relations Operators: `in`, `instanceof`.
  - Member Operators: `.`, `[]`. 
    
Note: the `.` member operator has prohibitted property names, such as `constructor` and `push`. To access such properties, it's recommeded to use the [Object.getOwnPropertyDescriptor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/getOwnPropertyDescriptor) function.

## 4. Arrow Functions

An arrow function is also known as [a lambda function](https://en.wikipedia.org/wiki/Anonymous_function).
The format of an arrow function is `ARGUMENT_NAME => FUNCTION_BODY`. An arrow function must have either a single argument or no arguments at all. For example

```js
x => x * 2
a => a + 4
s => `template literal ${s}`
a => b => a + b // an arrow functions that returns another arrow functions.
() => 'hello' // an arrow function with no arguments
```

A function body is either an expression or a block statement. A block statement format is `{ A_LIST_OF_STATEMENTS }`. For example

```js
// a function with one argument and a block statement
const f = x => {
   const a = 2 + x
   const r = a + 4
   return r
}
```
