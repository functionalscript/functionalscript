const { map } = require('../list/module.f.cjs')
const { join } = require('../string/module.f.cjs')
const m = require('./module.f.cjs')
const { add } = m

/** @typedef {readonly T[]} A */

/** @typedef {A|bigint} T */

/** @type {(a: T) => string} */
const s = a => typeof a === 'bigint' ? a.toString(16) : `[${join(' ')(map(s)(a))}]`

/** @type {(r: m.Root) => (v: bigint) => (e: string) => m.Node1} */
const f = r => v => e => {
    const n = add(r)(v)
    const sn = s(n)
    if (sn !== e) { throw sn }
    return n
}

module.exports = () => {
    let root = f(null)(0x56n)('56')
    root = f(root)(0xb3n)('[56 b3]')
    root = f(root)(0xaan)('[56 aa b3]')
    root = f(root)(0x8en)('[56 8e [aa b3]]')
    root = f(root)(0xc6n)('[56 8e [[aa b3] c6]]')
    root = f(root)(0xd5n)('[56 8e [[aa b3] c6 d5]]')
    root = f(root)(0x0cn)('[[c 56] 8e [[aa b3] c6 d5]]')
    root = f(root)(0xfbn)('[[c 56] 8e [[aa b3] c6 [d5 fb]]]')
    root = f(root)(0x11n)('[[[c 11] 56] 8e [[aa b3] c6 [d5 fb]]]')
    root = f(root)(0xc3n)('[[[c 11] 56] 8e [[aa b3] c3 [[c6 d5] fb]]]')
    root = f(root)(0x91n)('[[[c 11] 56] 8e [[91 aa b3] c3 [[c6 d5] fb]]]')
}
