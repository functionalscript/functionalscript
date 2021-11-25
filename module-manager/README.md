# Module Manager

## Module Provider

```js
/** @typedef {(packageName: string) => PackageMap|Package|undefined} PackageMap */

/**
 * @typedef {{
 *  readonly id: string,
 *  readonly packages: PackageMap,
 *  readonly files: (fileName: string) => string|undefined,
 * }} Package
 */
```

## Runner IO

```js
/** 
 * @typedef {(require: Require<T>) => (info: T) => (source: string) => readonly[Result<unknown, Error>, T]} RunnerIo
 */
```

```js
/**
 * @template T
 * @typedef {(info: T) => (module: string) => readonly[Result<unknown, Error>, T]} Require<T>
 */
```
