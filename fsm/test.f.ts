import { dfa, run, toRange, toUnion, type Grammar } from './module.f.ts'
import { union } from '../types/byte_set/module.f.ts'
import { sort, fromEntries } from '../types/object/module.f.ts'
import { stringify } from '../json/module.f.ts'
import { identity } from '../types/function/module.f.ts'
import { toArray } from '../types/list/module.f.ts'
import * as utf16 from '../text/utf16/module.f.ts'
const { stringToList } = utf16

const stringifyIdentity = stringify(identity)

const buildDfa = () => {
    const lowercaseAlpha = toRange('az')
    const uppercaseAlpha = toRange('AZ')
    const alpha = union(lowercaseAlpha)(uppercaseAlpha)
    const idSymbol = toUnion('_$')
    const idBegin = union(alpha)(idSymbol)
    const digit = toRange('09')
    const idNext = union(idBegin)(digit)
    const dot = toUnion('.')

    const grammar
        : Grammar
        = [
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
    return dfa(grammar)
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
            const result = stringifyIdentity(toArray(run(dfa)(input)))

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
            const result = stringifyIdentity(toArray(run(dfa)(input)))

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
            const result = stringifyIdentity(toArray(run(dfa)(input)))

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
            const result = stringifyIdentity(toArray(run(dfa)(input)))

            const expectedOutput = [
                '[]',
                '[]'
            ]
            const expectedResult = stringifyIdentity(expectedOutput)
            if (result !== expectedResult) { throw result }
        }
    ]
}
