/**
 * The proof of the parser's recognition of the empty reference map
 * ([proposal](../../../spec/todo/reference-map.md)): the canonical body of
 * `./ref_map`, whole, as the initializer of a `const` it reads as itself,
 * is the AST's `['refMap']`; anything else is an ordinary function, in
 * which `new` is refused as everywhere.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API.
 */

import { parseFromTokens } from './module.f.mjs'
import { source } from './ref_map/module.f.mjs'
import { stringifyModule, tokenizeString } from './proof.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.js'

/** @type {(text: string, expected: string) => void} */
const expect = (text, expected) => {
    const [tag, value] = parseFromTokens(tokenizeString(text))
    assert(tag === 'ok', value)
    assertEq(stringifyModule(value), expected)
}

/** @type {(text: string, message: string, line: number, column: number) => void} */
const refused = (text, message, line, column) => {
    const [tag, value] = parseFromTokens(tokenizeString(text))
    assert(tag === 'error', text)
    assertEq(value.message, message)
    assertEq(value.metadata?.line, line)
    assertEq(value.metadata?.column, column)
}

/** `new` in the body, where an ordinary function is refused. @type {(text: string) => void} */
const ordinary = text => {
    const [tag, value] = parseFromTokens(tokenizeString(text))
    assert(tag === 'error', text)
    assertEq(value.message, 'new is not admitted')
}

export const proof = {
    // The map as a value, read, called, and declared wherever a `const`
    // may be: in a module, in a function, under any name.
    parsed: () => {
        expect(`${source}export default empty\n`, "[\"{}\",[[\":\",\"default\",[\"refMap\"]]]]")
        expect(`${source.replaceAll('empty', 'm')}export default [m, m]\n`, "[\"{}\",[[\":\",\"default\",[\"[]\",[[\"refMap\"],[\"refMap\"]]]]]]")
        expect(`${source}const key = {}\nexport default empty(key, 1)\n`, "[\"{}\",[[\":\",\"default\",[\"()\",[\"refMap\"],[[\"{}\",[]],1]]]]]")
        expect(`export default () => {\n${source}return empty\n}\n`, "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"refMap\"]]]]]")
    },
    // Not the map: a function no `const` names, one a `let` names, a body
    // a step away, a name that is a reserved word, and `WeakMap` where a
    // scope binds the word. Each is an ordinary function.
    ordinary: () => {
        const arrow = source.slice(source.indexOf('(key'))
        ordinary(`export default [${arrow}]\n`)
        ordinary(`${source.replace('const empty', 'let empty')}export default empty\n`)
        ordinary(`${source.replace('let next = 1n', 'let next = 2n')}export default empty\n`)
        ordinary(`${source.replaceAll('root', 'Number')}export default empty\n`)
        ordinary(`${source.replaceAll('root', 'if')}export default empty\n`)
        ordinary(`const WeakMap = 1\n${source}export default empty\n`)
        ordinary(`export default WeakMap => {\n${source}return empty\n}\n`)
    },
    // The body is read by no ordinary resolution, so its statements are
    // held to JavaScript's line rules here: two on a line with no `;`
    // between them, and a `return` whose value begins the next line.
    lines: () => {
        refused(`${source.replace('let next = 1n\n', 'let next = 1n ')}export default empty\n`, 'unexpected token', 3, 23)
        refused(`${source.replace('return self\n', 'return\n self\n')}export default empty\n`, 'unexpected token', 29, 2)
        expect(`${source.replace('let next = 1n\n', 'let next = 1n; ')}export default empty\n`, "[\"{}\",[[\":\",\"default\",[\"refMap\"]]]]")
    },
}
