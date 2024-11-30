import list from '../list/module.f.mjs'
const { every, map, countdown } = list
const _ = require('./module.f.mjs').default

export default {
    has: () => {
        if (_.has(0)(_.empty)) { throw _.empty }
        if (_.has(1)(_.empty)) { throw _.empty }
        if (_.has(15)(_.empty)) { throw _.empty }
    },
    set: [
        () => {
            const s = _.set(0)(_.empty)
            if(s !== 1) { throw s }
            if(!_.has(0)(s)) { throw s }
            if (_.has(1)(s)) { throw s }
            if (_.has(15)(s)) { throw s }
        },
        () => {
            const s = _.set(15)(_.empty)
            if (s !== 0x8000) { throw s }
            if (_.has(0)(s)) { throw s }
            if (_.has(1)(s)) { throw s }
            if (!_.has(15)(s)) { throw s }
        }
    ],
    unset: () => [
        () => {
            const a = _.set(0)(_.empty)
            const result = _.unset(0)(a)
            if (result !== 0) { throw result }
        },
        () => {
            const a = _.set(15)(_.empty)
            const result = _.unset(15)(a)
            if (result !== 0) { throw result }
        }
    ],
    setRange: () => {
        const result = _.setRange([2, 5])(_.empty)
        if (result !== 60) { throw result }
    },
    universe: () => {
        const x = every(map(v => _.has(v)(_.universe))(countdown(16)))
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
    }
}
