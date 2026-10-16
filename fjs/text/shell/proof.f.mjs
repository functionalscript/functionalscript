import { tryShellQuote } from './module.f.js'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    tryShellQuote: () => {
        assertEq(tryShellQuote('a\0b'), null)
        assertEq(tryShellQuote(''), "''")
        assertEq(tryShellQuote("a'b"), "'a'\\''b'")
        assertEq(tryShellQuote('$HOME\n`whoami`'), "'$HOME\n`whoami`'")
    },
}
