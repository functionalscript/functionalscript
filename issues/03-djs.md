# DJS

Parse this code

```js
import a from 'c.d.js'
const c = [12, 'x']
export default { a: a, b: a, c: c}
```

Into this structure:

```ts
type Module = {
  modules: string[]
  func: Func
}

// the last constant from the array is a return
type Func = Const[]

type Const = Primitive | CObject | CArray |CRef | ARef

type Primitive = number|string|boolean|null|bigint

type CRef = ['cref', number]

type ARef = ['aref', number]

type CObject = ['object', {
  [k in string]: Const
}]

type CArray = ['array', [Const]]
```

Where `func` is a description of the function:

```js
(...args) => {
  const const0 = [12, 'x']
  return { a: args[0], b: args[0], c: const0}
}
```

## Parsed Example

```js
export default
// array of constants
[
  // const const0
  ['array', [12, 'x']],
  // return
  ['object', { 'a': ['aref', 0], 'b': ['aref', 0], c: ['cref', 0] }]
]
```
