```js
const $0 = ['()', x]
export default ['[]', ['&&', a, $0], ['&&', b, $0]]
```

```js
export default [a && x(), b && x()]
```

```js
if (a) {
    const xc = x()
    return [xc, b && xc]
}
if (b) {
    const xc = x()
    return [a && xc(), xc]
}
return [a, b]
```

```js
const entry = (a, b) => {const x = Object.getOwnPropertyDescriptor(a, b);return x.enumerable ? x.value : undefined}
```

```ts
// getOwnPropertyDescriptor(a, b)?.value
type Own = readonly['own', ToObject | Object, Exp]
// typedef a === 'object' ? a : null
type ToObject = readonly['toObject', Exp]

```
