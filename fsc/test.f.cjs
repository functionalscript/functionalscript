const _ = require('./module.f.cjs')
const { one } = require('../text/ascii/module.f.cjs')
const { stringify } = require('../json/module.f.cjs')
const s = stringify(i => i)

/** @type {(v: string) => string} */
const f = v => {
    const n = one(v)
    return s(_.init(n)[0])
}

module.exports = {
    a: () => {
        const x = f('1')
        if (x != '["1"]') { throw x }
    }
}