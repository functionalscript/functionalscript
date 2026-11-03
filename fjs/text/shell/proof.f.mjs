import { tryShellQuote } from './module.f.js'
import { assertEq } from '../../asserts/module.f.js'

export const proof = {
    tryShellQuote: () => {
        assertEq(tryShellQuote('a\u0000b'), null)
        assertEq(tryShellQuote(''), "''")
        assertEq(tryShellQuote("a'b"), "'a'\\''b'")
        assertEq(tryShellQuote('$HOME\n`whoami`'), "'$HOME\n`whoami`'")
    },
}
