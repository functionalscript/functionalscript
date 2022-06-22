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
    build: require('./build/index.f.js'),
    /** @readonly */
    module: require('./module/index.f.js'),
    /** @readonly */
    package: require('./package/index.f.js'),
    /** @readonly */
    path: require('./path/index.f.js'),
}