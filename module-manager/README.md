# Module Manager

## Module Provider

```js
/** @typedef {(packageName: string) => PackageMap|Package|undefined} PackageMap */

/** 
 * @typedef {readonly[
 *  string, 
 *  PackageMap, 
 *  (fileName: string) => string|undefined
 * ]} Package 
 */
```

## Runner IO

The main target of this design is to simplify `RunnerIo` as much as possible.

```js
/**
 * @template T 
 * @typedef {readonly[Result<unknown, Error>, Require<T>]} RunnerResult
 */

/** @typedef {<T>(require: Require<T>) => (source: string) => RunnerResult<T>} RunnerIo */

/**
 * @template T
 * @typedef {readonly[(path: string) => RunnerResult<T>, T]} Require<T>
 */
```

`Require` is using a `Package` and it contains also `RunnerIo` to provide sources also it contains