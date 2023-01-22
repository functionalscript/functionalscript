const parser = require('./module.f.cjs')
const tokenizer = require('../tokenizer/module.f.cjs')
const { toArray } = require('../../types/list/module.f.cjs')
const json = require('../module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const encoding = require('../../text/utf16/module.f.cjs');

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = json.stringify(sort)

module.exports = {
    testing: [
        () => {
            const tokens = tokenizeString('')
            const result = parser.parse(tokens)
            if (result[0] !== 'error') { throw result }
        },
        () => {
            const tokens = tokenizeString('null')
            const result = parser.parse(tokens)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== null) { throw result }
        },
        () => {
            const tokens = tokenizeString('true')
            const result = parser.parse(tokens)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== true) { throw result }
        },
        () => {
            const tokens = tokenizeString('false')
            const result = parser.parse(tokens)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== false) { throw result }
        },
        () => {
            const tokens = tokenizeString('0.1')
            const result = parser.parse(tokens)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 0.1) { throw result }
        },
        () => {
            const tokens = tokenizeString('1.1e+2')
            const result = parser.parse(tokens)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 110) { throw result }
        },
        () => {
            const tokens = tokenizeString('"abc"')
            const result = parser.parse(tokens)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 'abc') { throw result }
        },
    ]
}