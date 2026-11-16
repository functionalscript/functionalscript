import { assertEq } from '../../../asserts/module.f.js'
import { encodeUriComponent } from './module.f.js'

export const proof = {
    empty: () => assertEq(encodeUriComponent(''), ''),
    ascii: () => {
        assertEq(encodeUriComponent("aZ09-_.!~*'()"), "aZ09-_.!~*'()")
        for (let code = 0; code < 0x80; code += 1) {
            const text = String.fromCharCode(code)
            assertEq(encodeUriComponent(text), encodeURIComponent(text), code)
        }
    },
    unicode: () => {
        const boundaries = /** @type {const} */ ([
            '\u007f', '\u0080', '\u07ff', '\u0800', '\ud7ff', '\ue000',
            '\uffff', '\ud800\udc00', '\udbff\udfff',
        ])
        for (const text of boundaries) {
            assertEq(encodeUriComponent(text), encodeURIComponent(text))
        }
        assertEq(encodeUriComponent('П/雪 😀'), '%D0%9F%2F%E9%9B%AA%20%F0%9F%98%80')
        assertEq(encodeUriComponent('a%20/😀\u0000雪!'), 'a%2520%2F%F0%9F%98%80%00%E9%9B%AA!')
    },
    coercion: () => {
        assertEq(encodeUriComponent(), 'undefined')
        const values = /** @type {const} */ ([
            undefined, null, true, false, 0, -0, 1.5, NaN, Infinity,
            -Infinity, 1n, -2n, [], [undefined, null],
            [1, 'a b', ['雪']], {}, { a: 1 },
        ])
        for (const value of values) {
            assertEq(encodeUriComponent(value), encodeURIComponent(String(value)))
        }
    },
    throw: {
        highSurrogate: () => encodeUriComponent('\ud800'),
        lowSurrogate: () => encodeUriComponent('\udfff'),
        reversedPair: () => encodeUriComponent('\udc00\ud800'),
        embeddedHigh: () => encodeUriComponent('a\ud800b'),
        highBeforeHigh: () => encodeUriComponent('\ud800\udbff'),
        highBeforeOutside: () => encodeUriComponent('\ud800\ue000'),
        embeddedLow: () => encodeUriComponent('a\udc00b'),
        failedCoercion: () => encodeUriComponent({ toString: 0, valueOf: 0 }),
    },
}
