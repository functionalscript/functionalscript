# Non-default Export

In FunctionalScript we use `export default`:

```js
export default 17
```

The main reason is that it's compatible with other module types, such as JSON and CommonJS.

ECMAScript supports `export` of other non-default objects. We wouldn't have much reasons to support but systems as JSR doesn't really like `default` exports.

To implement `export` we should change our definition of a module from `unknown` to

```ts
type Module = {
    readonly [k in string]?: unknonwn
    readonly default?: unknown
}
```

Or, more strict version, which allows either `export` or `export default` but not both:

```ts
type Module = ExportMap | ExportDefault
type ExportMap = Omit<{
    readonly[k in string]: unknown
}, 'default'>
type DefaultExport = {
    readonly default: unknown
}
```

We don't need to change `import` for now if we implement `import * as X from ...`. For example

```js
// types/list/module.f.js
export const map = ...
```

```js
import * as List from 'types/list/module.f.js'
const { map } = List
```

## Reserved Export Names

Certain export names are forbidden because they give the module namespace object special meaning in the JavaScript runtime.

### `then`

A module **must not** export a zero-argument (or one-or-two-argument) function named `then`:

```ts
// FORBIDDEN
export const then = () => { ... }
```

When a module namespace object has a callable `.then` property, JavaScript's `await` (and `Promise.resolve()`) treats the entire namespace as a *thenable*. A dynamic import `await import('./module.f.ts')` would call `.then()` on the namespace instead of resolving to it — causing the import to hang, resolve to an unexpected value, or never complete, depending on what `then` does.

Since FunctionalScript modules are loaded via dynamic import in the test framework and the runtime, this would silently corrupt module loading. The FunctionalScript compiler/validator must reject any module that exports a function named `then`.

Non-function exports named `then` (e.g. a string or number) are also problematic because `Promise.resolve()` only checks `typeof value.then === 'function'` — so a function is the critical case, but for clarity the name `then` should be reserved entirely.

See [i65Y-registermodule-thenable](../65Y-registermodule-thenable.md) for the related test-framework issue that surfaced this constraint.
