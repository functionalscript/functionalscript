# DataJS

JSON forms a tree. DataJS is a valid JavaScript (ECMAScript) module.

DataJS value could be any JSON with one minor exception, see `__proto__` properties.

## The `"__proto__"` Properties

All string property keys which equals to `"__proto__"` (after resolving all escape symbols) should be replaced by `["__proto__"]`.

Invalid DataJS:

```js
export default {"__proto__":5};
```

Correct DataJS:

```js
export default {["__proto__"]:5};
```
