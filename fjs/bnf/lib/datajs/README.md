# DataJS

A JSON document represents a tree. DataJS is a valid JavaScript (ECMAScript) module.

A DataJS value is a JSON value extended with bigint, undefined, non-finite numbers, and references to previously declared const values. Every JSON value is therefore DataJS value; only the source spelling of an `__proto__` property must change.

## The `__proto__` Properties

All string property keys which equals to `"__proto__"` (after resolving all escape sequences) must be replaced by `["__proto__"]`.

Invalid DataJS files:

```js
export default {"__proto__":5};
```

```js
export default {"\u005f_proto__":5};
```

Correct DataJS file:

```js
export default {["__proto__"]:5};
```
