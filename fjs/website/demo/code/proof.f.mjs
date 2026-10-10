import { codeBlock, tryShellQuote } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

export const proof = {
    codeBlock: () => {
        const h = htmlToString(codeBlock('<text>&', 'Copy result'))
        assert(h.startsWith('<!DOCTYPE html><div data-code="" data-code-block=""><pre>&lt;text&gt;&amp;</pre>'), h)
        assert(h.includes('data-copy="&lt;text&gt;&amp;"'), h)
        assert(h.includes('aria-label="Copy result" title="Copy result"'), h)
        assert(h.includes('data-copy-check=""'), h)
        assert(h.includes('data-copy-status="" aria-live="polite"'), h)
    },
    tryShellQuote: () => {
        assertEq(tryShellQuote('a\0b'), null)
        assertEq(tryShellQuote(''), "''")
        assertEq(tryShellQuote("a'b"), "'a'\\''b'")
        assertEq(tryShellQuote('$HOME\n`whoami`'), "'$HOME\n`whoami`'")
    },
}
