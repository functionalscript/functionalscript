# FunctionalScript Programming Language

Principles:

- FunctionalScript VM should behaves the same way as a JavaScript VM,
- Any unsupported feature should be reported at compile-time.

## 1. Module Ecosystem

FunctionalScript uses ESM conventions as a module ecosystem. For example,

```js
import thirdPartyModule from 'third-party-package/module.js'

const result = thirdPartyModule.someFunction('hello')
```

## 2. Packages

FunctionalScript uses a `package.json` file to define a package. This file is compatible with [Node.js `package.json`](https://nodejs.org/en/knowledge/getting-started/npm/what-is-the-file-package-json/).
The preferred way to reference dependencies is to use a GitHub URL. These dependencies in a `package.json` file could look like this,

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

## 3. Module Structure

A module is a file with the `.f.js` extension. It contains three parts: references to other modules, definitions, and exports. For example

`./first.f.js`
```js
// 1. references
import math from 'math'

// 2. definitions
const myConst = 42
// addition(a)(b) = a + b
const addition = a => b => a + b
const add42 = addition(42)
const _10digitsOfPi = math.calculatePi(10)

// 3. exports
export default {
   addition,
   add42,
   _10digitsOfPi,
}
```

`./second.f.js`
```js
// 1. references
import first from './first.f.js'

// 2. definitions
const _42plus7 = first.add42(7)

// 3. exports
export default {
   _42plus7,
}
```

## 4. References To Other Modules

The format of references is `import ANYNAME from 'PATH_TO_A_MODULE'`. For example,

```js
import math from 'math'
import algebra from 'math/algebra'
import localFile from '../some-directory/some-file.f.js'
```

## 5. Definitions

The format of definitions is `const NAME = EXPRESSION`, where the `EXPRESSION` is a subset of [JavaScript expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators).

```js
const myConst = 42
const functionDouble = a => a * 2
const structure = { name: "John", surname: "Smith" }
const array = [1, 2, 3]
const nestedStructure = {
   address: null,
   serialNumber: "123-45-78",
   sum: 14 + myConst + functionDouble(4),
   moreInfo: {
      name: "Ivan",
      surname: "Terrible",
   }
}
```

See [Expressions](#7-Expressions).

### 6. Exports

The format of exports is `export default { A_LIST_OF_EXPORTED_DEFINITIONS }`. There should be only one `export default` at
the end of a FunctionalScript file. For example,

```js
export default {
   nestedStructure,
   array,
   structure,
}
```

## 7. Expressions

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

**Note:** the `.` member operator has prohibited property names, such as `constructor` and `push`. To access such properties, it's recommended to use the
[Object.getOwnPropertyDescriptor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/getOwnPropertyDescriptor) function.
`[]` accepts only numbers. For example `+'0'`

## 8. Arrow Functions

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

## 9. Statements

`{ A_LIST_OF_STATEMENTS }` is one or many statements separated by the newline control character. One of these statements mentioned earlier was [definition](#5-Definitions), also known as a [const](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const) statement. The other statements are described below.

### 9.1. Let

[Let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let) declares a local mutable alias for immutable objects. For example

```js
let x = [5]
// you can assign another immutable object to the alias at any time.
x = [3, 4]
//but you can't change the properties of the immutable object.
x[0] = 3 // < invalid
//let aliases can not be referenced from another arrow function.
const f = () => x // < invalid
```

### 9.2. Return

[Return](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return)

### 9.3. If...Else

[If...Else](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/if...else)

### 9.4. Switch

[Switch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch)

### 9.5. Throw

[Throw](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw). FunctionalScript allows to throw exceptions, but the language has no syntax to catch them. Developers should only use the 'throw' statement in non-recoverable situations. Throwing an exception could be compared to [panic in Rust](https://doc.rust-lang.org/std/macro.panic.html).

### 9.6. While

[While](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/while)

### 9.7. Block

[Block](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/block)

## 10. Generators

For compatibility reason, FunctionalScript allows to create generators as implementation of `[Symbol.iterator]` function. However, it doesn't allow to read the `[Symbol.iterator]` property. For example

This code is allowed

```js
/** @type {<T>(list: List<T>) => Iterable<T>} */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const r = next(i)
            if (r === null) { return }
            yield r.first
            i = r.tail
        }
    }
})
```

The following code is not allowed, because `iterator` is a mutated object by design in JavaScript.

```js
const it = [0, 1, 2][Symbol.iterator] //< compilation error.
```

Use `Iterable` instead of `Iterator`.

```js
const x = () => {
    const a = [0, 1, 2] // iterable
    let sum = 0;
    for (let i in a) {
        sum = sum + i
    }
    return sum;
}
```
