const _ = require('./module.f.cjs')
const { every, countdown, map } = require('../list/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../object/module.f.cjs')
const { toArray } = require('../list/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

module.exports = {
    has: [
        () => {
            if (_.has(0)(_.empty)) { throw _.empty }
            if (_.has(1)(_.empty)) { throw _.empty }
            if (_.has(33)(_.empty)) { throw _.empty }
        },
        () => {
            const s = _.set(0)(_.empty)
            if (s !== 1n) { throw s }
            if (!_.has(0)(s)) { throw s }
            if (_.has(1)(s)) { throw s }
            if (_.has(33)(s)) { throw s }
        },
        () => {
            const s = _.set(33)(_.empty)
            if (s !== 8589934592n) { throw s }
            if (_.has(0)(s)) { throw s }
            if (_.has(1)(s)) { throw s }
            if (!_.has(33)(s)) { throw s }
        }
    ],
    setRange: () => {
        const result = _.setRange([2, 5])(_.empty)
        if (result !== 60n) { throw result }
    },
    unset: [
        () => {
            const a = _.set(0)(_.empty)
            const result = _.unset(0)(a)
            if (result !== 0n) { throw result }
        },
        () => {
            const a = _.set(255)(_.empty)
            const result = _.unset(255)(a)
            if (result !== 0n) { throw result }
        }
    ],
    universe: () => {
        const x = every(map(v => _.has(v)(_.universe))(countdown(256)))
        if (!x) { throw x }
    },
    compliment: {
        empty: () => {
            const r = _.complement(_.empty)
            if (r !== _.universe) { throw r }
        },
        universe: () => {
            const r = _.complement(_.universe)
            if (r !== _.empty) { throw r }
        },
    },
    toRangeMap: [
        () => {
            const result = stringify(toArray(_.toRangeMap(_.empty)('a')))
            if (result !== '[]') { throw result }
        },
        () => {
            const s = _.set(0)(_.empty)
            const result = stringify(toArray(_.toRangeMap(s)('a')))
            if (result !== '[[["a"],0]]') { throw result }
        },
        () => {
            const s = _.setRange([1,2])(_.empty)
            const result = stringify(toArray(_.toRangeMap(s)('a')))
            if (result !== '[[[],0],[["a"],2]]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.toRangeMap(_.universe)('a')))
            if (result !== '[[["a"],255]]') { throw result }
        },
    ]
}
