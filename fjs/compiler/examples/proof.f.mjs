import { assertEq } from '../../asserts/module.f.mjs'
import { examplePicker } from '../../website/demo/examples/module.f.mjs'
import { examples } from './module.f.mjs'

export const proof = {
    /**
     * The picker refuses a repeated name or source, so building one over the
     * shared list is the proof that every demo's drop-down can be built from
     * it, and a pick returns the example's own source.
     */
    distinct: () => {
        const picker = examplePicker(examples)
        assertEq(picker.pick(examples[0][0]), examples[0][1])
    },
}
