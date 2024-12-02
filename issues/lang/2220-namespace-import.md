# Namespace Import

We need it to import types from other modules.

```js
import * as A from './a.d.mjs'
/** @type {A.Type} */
export default [5]
```

Where `./a.d.mjs` may look like this:

```js
// this type can be used in other modules
/** @typedef {readonly [number]} Type */

// export nothing
export default null
```

FunctionalScript should use namespace import only as a mechanism to reference type definitions. Since, VM doesn't analyze types, namespace import can be ignored be VM. However different linters, such as TypeScript, can use the information.

Depends on [default-import](./2110-default-export.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#namespace_import
