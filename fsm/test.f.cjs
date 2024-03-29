const _ = require('./module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const { sort, fromEntries } = require('../types/object/module.f.cjs')
const json = require('../json/module.f.cjs')
const { identity } = require('../types/function/module.f.cjs')
const { toArray } = require('../types/list/module.f.cjs')
const { stringToList } = require('../text/utf16/module.f.cjs')

const stringifyIdentity = json.stringify(identity)

const buildDfa = () => {
    const lowercaseAlpha = _.toRange('az')
    const uppercaseAlpha = _.toRange('AZ')
    const alpha = byteSet.union(lowercaseAlpha)(uppercaseAlpha)
    const idSymbol = _.toUnion('_$')
    const idBegin = byteSet.union(alpha)(idSymbol)
    const digit = _.toRange('09')
    const idNext = byteSet.union(idBegin)(digit)
    const dot = _.toUnion('.')

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
    return _.dfa(grammar)
}

module.exports = {
    dfa: () => {
        const dfa = buildDfa()
        const entries = Object.entries(dfa)
        const sortedEntries = sort(entries)
        const obj = fromEntries(sortedEntries)
        const result = stringifyIdentity(obj)

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
        const expectedResult = stringifyIdentity(expectedObj)

        if (result !== expectedResult) {throw result }
    },
    run: [
        () => {
            const dfa = buildDfa()
            const input = stringToList('a1')
            const result = stringifyIdentity(toArray(_.run(dfa)(input)))

            const expectedOutput = [
                '["id"]',
                '["id"]'
            ]
            const expectedResult = stringifyIdentity(expectedOutput)
            if (result !== expectedResult) { throw result }
        },
        () => {
            const dfa = buildDfa()
            const input = stringToList('0.1')
            const result = stringifyIdentity(toArray(_.run(dfa)(input)))

            const expectedOutput = [
                '["floatBegin","int"]',
                '["floatDot"]',
                '["float"]'
            ]
            const expectedResult = stringifyIdentity(expectedOutput)
            if (result !== expectedResult) { throw result }
        },
        () => {
            const dfa = buildDfa()
            const input = stringToList('//')
            const result = stringifyIdentity(toArray(_.run(dfa)(input)))

            const expectedOutput = [
                '[]',
                '[]'
            ]
            const expectedResult = stringifyIdentity(expectedOutput)
            if (result !== expectedResult) { throw result }
        },
        () => {
            const dfa = buildDfa()
            const input = stringToList('::')
            const result = stringifyIdentity(toArray(_.run(dfa)(input)))

            const expectedOutput = [
                '[]',
                '[]'
            ]
            const expectedResult = stringifyIdentity(expectedOutput)
            if (result !== expectedResult) { throw result }
        }
    ]
}
