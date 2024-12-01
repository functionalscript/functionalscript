# Namespace Import

We need it to import types from other modules.

```js
import * as A from './a.d.mjs'
export default {
    /** @type {A.Type} */
    "a": [5],
    "b": [-42.5, false, "hello"]
}
```

FunctionalScript should use it only to reference type definitions.

Depends on [default-import](./211-default-export.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#namespace_import
