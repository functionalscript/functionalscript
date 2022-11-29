/** @typedef {(packageName: string) => PackageMap|Package|null} PackageMap */

/**
 * @typedef {readonly[
 *  string,
 *  PackageMap,
 *  (fileName: string) => string|undefined
 * ]} Package
 */

module.exports = {
    /** @readonly */
    build: require('./build/module.f.cjs'),
    /** @readonly */
    module: require('./module/module.f.cjs'),
    /** @readonly */
    package: require('./package/module.f.cjs'),
    /** @readonly */
    path: require('./path/module.f.cjs'),
}