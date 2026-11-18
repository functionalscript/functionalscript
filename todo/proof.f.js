import { assertEq } from '../fjs/asserts/module.f.js'

/** @type {(...x: [string]) => [string]} */
const utf8 = (...x) => x

export const proof = {
    literal: () => {
        /** @typedef {`<html>${string}</html>`} _TemplateType */
        assertEq(utf8('17')[0], '17')
        /** @type {_TemplateType} */
        const m = '<html>Hello</html>'
    },
}
