# DJS

Parse this code

```js
import a from 'c.d.mjs'
const c = [12, 'x']
export default { a: a, b: a, c: c}
```

Into this structure:

```ts
type Module = {
  modules: string[]
  func: Func
}
```

Where bytecode is a byte code of the function:

```js
(...args) => {
  const const0 = [12, 'x']
  return { a: args[0], b: args[0], c: const0}
}
```
