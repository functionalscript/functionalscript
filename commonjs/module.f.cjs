/** @typedef {(packageName: string) => PackageMap|Package|null} PackageMap */

/**
 * @typedef {readonly[
 *  string,
 *  PackageMap,
 *  (fileName: string) => string|null
 * ]} Package
 */

module.exports = {
    /** @readonly */
    build: require('./build/module.f.mjs'),
    /** @readonly */
    module: require('./module/module.f.mjs'),
    /** @readonly */
    package: require('./package/module.f.mjs'),
    /** @readonly */
    path: require('./path/module.f.cjs'),
}