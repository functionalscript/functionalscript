import * as _ from './module.f.mjs'
import * as byteSet from '../types/byte_set/module.f.mjs'
import * as o from '../types/object/module.f.mjs'
const { sort, fromEntries } = o
import * as json from '../json/module.f.mjs'
import * as f from '../types/function/module.f.mjs'
const { identity } = f
import * as list from '../types/list/module.f.mjs'
const { toArray } = list
import * as utf16 from '../text/utf16/module.f.mjs'
const { stringToList } = utf16

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

export default {
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
