const _ = require('./module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')

/** @type {(c: string) => number} */
const toCharCode = c => c.charCodeAt(0)

module.exports = {
    dfa: () => {
        const lowercaseAlpha = byteSet.range([toCharCode('a'), toCharCode('z')])
        const uppercaseAlpha = byteSet.range([toCharCode('A'), toCharCode('Z')])
        const alpha = byteSet.union(lowercaseAlpha)(uppercaseAlpha)
        const idSymbol = byteSet.union(byteSet.one(toCharCode('_')))(byteSet.one(toCharCode('$')))
        const idBegin = byteSet.union(alpha)(idSymbol)
        const digit = byteSet.range([toCharCode('0'), toCharCode('9')])
        const idNext = byteSet.union(idBegin)(digit)
        const dot = byteSet.one(toCharCode('.'))

        /** @type {_.Grammar} */
        const grammar = [
            ['', digit, 'int'],
            ['int', digit, 'int'],
            ['', digit, 'floatBegin'],
            ['floatBegin', digit, 'floatBegin'],
            ['floatBegin', dot, 'floatDot'],
            ['floatDot', digit, 'float'],
            ['float', digit, 'float'],
            ['', idBegin, 'id'],
            ['id', idNext, 'id']
        ]

       const result = _.dfa(grammar)
       console.log(result)
    }
}
