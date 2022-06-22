const _ = require('./index.f.js')
const json = require('../json/index.f.js')
const { sort } = require('../types/object/index.f.js')
const list = require('../types/list/index.f.js')

/** @type {(a: number) => number} */
const toU32 = x => (x + 0x1_0000_0000) % 0x1_0000_0000

/** @type {(a: number) => string} */
const toHexString = x => toU32(x).toString(16).padStart(8, '0')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

// {
//     const result = _.padding([])(0)
//     console.log(result.map(toHexString))
// }

// {
//     const result = _.padding([0x61626364, 0x65000000])(40)
//     console.log(result.map(toHexString))
// }

// {
//     const result = _.padding([0x11111110])(31)
//     console.log(result.map(toHexString))
// }

// {
//     const result = _.padding([0x11111110])(32)
//     console.log(result.map(toHexString))
// }

{
    const hash = _.computeSha256([])(0)
    const result = stringify(hash.map(toHexString))
    if (result !== '["e3b0c442","98fc1c14","9afbf4c8","996fb924","27ae41e4","649b934c","a495991b","7852b855"]') { throw result }
}

{
    const hash = _.computeSha224([])(0)
    const result = stringify(hash.map(toHexString))
    if (result !== '["d14a028c","2a3a2bc9","476102bb","288234c4","15a2b01f","828ea62a","c5b3e42f","bdd387cb"]') { throw result }
}

{
    //[0x68656C6C, 0x6F20776F, 0x726C6400] represents phrase 'hello world'
    const hash = _.computeSha256([0x68656C6C, 0x6F20776F, 0x726C6400])(88)
    const result = stringify(hash.map(toHexString))
    if (result !== '["b94d27b9","934d3e08","a52e52d7","da7dabfa","c484efe3","7a5380ee","9088f7ac","e2efcde9"]') { throw result }
}

{
    //[0x68656C6C, 0x6F20776F, 0x726C6488] represents phrase 'hello world' with 1's at the end
    const hash = _.computeSha256([0x68656C6C, 0x6F20776F, 0x726C64FF])(88)
    const result = stringify(hash.map(toHexString))
    if (result !== '["b94d27b9","934d3e08","a52e52d7","da7dabfa","c484efe3","7a5380ee","9088f7ac","e2efcde9"]') { throw result }
}

{
    const input = Array(8).fill(0x31313131)
    const result = _.computeSha256(input)(256)
    if (toU32(result[0]) !== 0x8a83665f) { throw result[0] }
}

{
    const input = Array(16).fill(0x31313131)
    const hash = _.computeSha256(input)(512)
    const result = stringify(hash.map(toHexString))
    if (result !== '["3138bb9b","c78df27c","473ecfd1","410f7bd4","5ebac1f5","9cf3ff9c","fe4db77a","ab7aedd3"]') { throw result }
}

module.exports = {

}
