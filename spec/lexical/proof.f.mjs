import { assert } from '../../fjs/asserts/module.f.js'
import { examplePicker } from '../../fjs/website/demo/examples/module.f.js'
import lexical from './module.f.js'

export const proof = {
    /** The pages' lists together are a valid drop-down: names and sources are distinct. */
    distinct: () => {
        const all = lexical.all
        assert(all.length > 0, 'the lexical area has examples')
        examplePicker(all)
    },
}
