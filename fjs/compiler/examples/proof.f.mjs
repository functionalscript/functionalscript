import { assert, assertEq } from '../../asserts/module.f.js'
import { examplePicker } from '../../website/demo/examples/module.f.js'
import { dependenciesOf, examples } from './module.f.js'
import { isFileName } from '../demo_files/module.f.mjs'

export const proof = {
    /**
     * The picker refuses a repeated name or source, so building one over the
     * shared list is the proof that every demo's drop-down can be built from
     * it, and a pick returns the example's own source.
     */
    stableHexEscape: () => {
        const picker = examplePicker(examples)
        assertEq(picker.idOf(picker.pick('Hex escape')), 'hex-escape')
        assertEq(picker.sourceOf('hex-escape'), picker.pick('Hex escape'))
    },
    distinct: () => {
        const picker = examplePicker(examples)
        assertEq(picker.pick(examples[0][0]), examples[0][1])
    },
    /** An example's files are ones a program can hold, and an example of one module has none. */
    dependencies: () => {
        assertEq(dependenciesOf('hex-escape').length, 0)
        assertEq(dependenciesOf('an-import').map(([name]) => name).join(), 'm.f.js')
        for (const [, , id] of examples) {
            for (const [name] of dependenciesOf(id)) { assert(isFileName(name), `${id}: ${name}`) }
        }
    },
}
