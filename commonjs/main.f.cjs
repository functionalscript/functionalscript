/** @typedef {(packageName: string) => PackageMap|Package|undefined} PackageMap */

/**
 * @typedef {readonly[
 *  string,
 *  PackageMap,
 *  (fileName: string) => string|undefined
 * ]} Package
 */

module.exports = {
    /** @readonly */
    build: require('./build/main.f.cjs'),
    /** @readonly */
    module: require('./module/main.f.cjs'),
    /** @readonly */
    package: require('./package/main.f.cjs'),
    /** @readonly */
    path: require('./path/main.f.cjs'),
}