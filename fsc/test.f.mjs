import _ from './module.f.mjs'
import { one } from '../text/ascii/module.f.cjs'
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