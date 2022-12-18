const _ = require('./module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../object/module.f.cjs')

const stringify = json.stringify(sort)

module.exports = {
    stringify: () => {
        const result = stringify([1, 20, 300])
        if (result !== '[1,20,300]') { throw result }
    },
    at: [
        () => {
            const result = _.at(2)([1, 20, 300])
            if (result !== 301) { throw result }
        },

        () => {
            const result = _.at(3)([1, 20, 300])
            if (result !== null) { throw result }
        }
    ],
    first: [
        () => {
            const result = _.first([1, 20, 300])
            if (result !== 1) { throw result }
        },
        () => {
            const result = _.first([])
            if (result !== null) { throw result }
        }
    ],
    last: [
        () => {
            const result = _.last([1, 20, 300])
            if (result !== 300) { throw result }
        },
        () => {
            const result = _.last([])
            if (result !== null) { throw result }
        }
    ],
    head: [
        () => {
            const result = _.head([1, 20, 300])
            if (result === null) { throw result }
            const str = stringify(result)
            if (str !== '[1,20]') { throw str }
        },
        () => {
            const result = _.head([])
            if (result !== null) { throw result }
        }
    ],
    tail: [
        () => {
            const result = _.tail([1, 20, 300])
            const str = stringify(result)
            if (str !== '[20,300]') { throw str }
        },
        () => {
            const result = _.tail([])
            if (result !== null) { throw result }
        }
    ],

    splitFirst: [
        () => {
            const result = _.splitFirst([1, 20, 300])
            const str = stringify(result)
            if (str !== '[1,[20,300]]') { throw str }
        },
        () => {
            const result = _.splitFirst([])
            if (result !== null) { throw result }
        },
        () => {
            const result = _.splitLast([1, 20, 300])
            const str = stringify(result)
            if (str !== '[[1,20],300]') { throw str }
        },
        () => {
            const result = _.splitLast([])
            if (result !== null) { throw result }
        }
    ]
}
