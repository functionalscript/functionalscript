import * as _ from './module.f.ts'
import * as ascii from '../text/ascii/module.f.ts'
const { one } = ascii
import * as j from '../json/module.f.ts'
const { stringify } = j
const s = stringify(i => i)

/** @type {} */
const f
    : (v: string) => string
    = v => {
    const n = one(v)
    return s(_.init(n)[0])
}

export default {
    a: () => {
        const x = f('1')
        if (x != '["1"]') { throw x }
    }
}
