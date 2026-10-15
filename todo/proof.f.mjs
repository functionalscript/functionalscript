import { assertEq } from '../fjs/asserts/module.f.mjs'

/** @type {(a: unknown) => (i: any) => unknown} */
const at = a => i => Object.getOwnPropertyDescriptor(a, i)?.value

/** @type {(...x: [readonly string[]]) => [readonly string[]]} */
const utf8 = (...x) => x

export const proof = {
    literal: () => {
        /** @typedef {`<html>${string}</html>`} _TemplateType */
        const x = utf8`17`
        /** @type {_TemplateType} */
        const m = '<html>Hello</html>'
    },
    ownProperty: {
        null: {
            throw: () => Object.getOwnPropertyDescriptor(null, 0),
        },
        undefined: {
            throw: () => Object.getOwnPropertyDescriptor(undefined, 0),
        },
        bool: () => {
            const v = at(true)('x')
            if (v !== undefined) {
                throw v
            }
        },
        array: () => {
            const a = ['42']
            {
                const v = at(a)('0')
                assertEq(v, '42')
            }
            {
                const v = at(a)(0)
                assertEq(v, '42')
            }
        },
        object: {
            null: () => {
                const o = { null: 'hello' }
                const v = at(o)(null)
                assertEq(v, 'hello')
            },
            undefined: () => {
                const o = { undefined: 'hello' }
                const v = at(o)(undefined)
                assertEq(v, 'hello')
            }
        },
        string: {
            number: () => {
                const o = 'hello'
                const v = at(o)(1)
                assertEq(v, 'e')
            }
        }
    }
}
