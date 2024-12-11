import * as _ from './module.f.mjs'
import ascii from '../text/ascii/module.f.mjs'
const { one } = ascii
import j from '../json/module.f.mjs'
const { stringify } = j
const s = stringify(i => i)

/** @type {(v: string) => string} */
const f = v => {
    const n = one(v)
    return s(_.init(n)[0])
}

export default {
    a: () => {
        const x = f('1')
        if (x != '["1"]') { throw x }
    }
}