const _ = require('.')

/** @type {(a: number) => string} */
const toHexString = x =>
{
    return x >= 0 ? x.toString(16).padStart(8, '0') : (x + 0x100000000).toString(16).padStart(8, '0')
}

{
    const result = _.padding([])(0)
    console.log(result.map(toHexString))
}

{
    const result = _.padding([0x61626364, 0x65000000])(40)
    console.log(result.map(toHexString))
}

{
    const result = _.padding([0x11111110])(31)
    console.log(result.map(toHexString))
}

module.exports = {

}
