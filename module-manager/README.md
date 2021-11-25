# Module Manager

## Interface

```js
/** @typedef {(packageName: string) => PackageMap|Package|undefined} PackageMap */

/**
 * @typedef {readonly[
 *  PackageMap,
 *  (fileName: string) => string|undefined,
 * ]} Package
 */
```
