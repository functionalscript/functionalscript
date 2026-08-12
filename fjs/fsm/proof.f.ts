import { dfa, run, toRange, toUnion, type Grammar } from './module.f.ts'
import { union } from '../types/byte_set/module.f.mjs'
import { sort, fromEntries } from '../types/object/module.f.mjs'
import { stringify } from '../media/json/sede/module.f.ts'
import { identity } from '../types/function/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { stringToList } from '../text/utf16/module.f.mjs'
import { assertEq } from '../asserts/module.f.mjs'

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

export const proof = {
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
            assertEq(result, expectedResult)
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
            assertEq(result, expectedResult)
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
            assertEq(result, expectedResult)
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
            assertEq(result, expectedResult)
        },
        () => {
            // `run` accepts any `Dfa` (a `StringMap`, so entries may be
            // missing), not only one built by `dfa()`. A state absent from
            // the map falls back to the empty transition table.
            const result = stringifyIdentity(toArray(run({})(stringToList('a'))))

            const expectedOutput = ['[]']
            const expectedResult = stringifyIdentity(expectedOutput)
            assertEq(result, expectedResult)
        }
    ]
}
