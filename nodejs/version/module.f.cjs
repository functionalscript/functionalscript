/** @type {(b: Buffer) => string} */
const version = b => `0.0.${b.toString().split('\n').length}`

module.exports = {
    /** @readonly */
    version,
}
