import { assert, assertEq } from '../../../../asserts/module.f.js'
import { chunksText } from '../../../../text/marked/module.f.mjs'
import { _memberPresentChunks } from './module.f.mjs'

export const proof = {
    helper: () => {
        const text = chunksText(_memberPresentChunks('query'))
        assert(text.includes('Object.getOwnPropertyDescriptor'))
        assert(text.includes('"startsWith"'))
        assertEq(text.includes('"constructor"'), false)
        assertEq(chunksText(_memberPresentChunks('other')).includes('Object.getOwnPropertyDescriptor'), true)
    },
}
