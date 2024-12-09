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
