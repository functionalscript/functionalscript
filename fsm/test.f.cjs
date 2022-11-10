const _ = require('./module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const { sort, fromEntries } = require('../types/object/module.f.cjs')
const json = require('../json/module.f.cjs')
const { identity } = require('../types/function/module.f.cjs')

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

        const dfa = _.dfa(grammar)
        const entries = Object.entries(dfa)
        const sortedEntries = sort(entries)
        const obj = fromEntries(sortedEntries)
        const result = json.stringify(identity)(obj)

        const expectedObj = {
            '[""]': [
                [ '[]', 35 ],
                [ '["id"]', 36 ],
                [ '[]', 47 ],
                [ '["floatBegin","int"]', 57 ],
                [ '[]', 64 ],
                [ '["id"]', 90 ],
                [ '[]', 94 ],
                [ '["id"]', 95 ],
                [ '[]', 96 ],
                [ '["id"]', 122 ]
            ],
            '["float"]': [ [ '[]', 47 ], [ '["float"]', 57 ] ],
            '["floatBegin","int"]': [
                [ '[]', 45 ],
                [ '["floatDot"]', 46 ],
                [ '[]', 47 ],
                [ '["floatBegin","int"]', 57 ]
            ],
            '["floatDot"]': [ [ '[]', 47 ], [ '["float"]', 57 ] ],
            '["id"]': [
                [ '[]', 35 ],
                [ '["id"]', 36 ],
                [ '[]', 47 ],
                [ '["id"]', 57 ],
                [ '[]', 64 ],
                [ '["id"]', 90 ],
                [ '[]', 94 ],
                [ '["id"]', 95 ],
                [ '[]', 96 ],
                [ '["id"]', 122 ]
            ],
            '[]': []
        };
        const expectedResult = json.stringify(identity)(expectedObj)

        if (result !== expectedResult) {throw result }
    }
}
