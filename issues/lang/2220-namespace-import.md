# Namespace Import

We need it to import types from other modules. FunctionalScript uses `import type` for this purpose — it is purely a type-level construct and is stripped at runtime.

```ts
import type * as A from './a.f.js'
/** @type {A.Type} */
export default [5]
```

Where `./a.f.js` may look like this:

```ts
// this type can be used in other modules
export type Type = readonly [number]

// export nothing at runtime
export default null
```

FJS ignores `import type` at runtime (VM does not analyse types). TypeScript and other linters use it for type checking. This is part of type stripping.

Type stripping blockers:

- Node.js (even 24) can't use `.ts` files from `./node_modules/`.
- Node, Deno, and TypeScript don't allow type annotations in `.js` files. See the [Type Annotations proposal](https://github.com/tc39/proposal-type-annotations).
- Browsers don't support type annotations or `.ts` files.

Depends on [default-import](./2130-default-import.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#namespace_import
