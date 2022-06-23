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
    build: require('./build/main.f.js'),
    /** @readonly */
    module: require('./module/main.f.js'),
    /** @readonly */
    package: require('./package/main.f.js'),
    /** @readonly */
    path: require('./path/main.f.js'),
}