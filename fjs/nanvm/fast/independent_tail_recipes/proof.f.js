import { assert, assertEq } from '../../../asserts/module.f.js'
import { generate, path } from './module.f.js'

export const proof = /** @type {const} */ ({
    generate: () => {
        assertEq(path, 'nanvm/harness/gen.fast/independent_tail_recipes.rs')
        const rust = generate()
        assert(rust.startsWith('// Fixture source: `fjs/nanvm/fast/independent_tail_recipes/module.f.js`; regenerate with `npm run gen`.'))
        assert(rust.includes('pub fn module<A: IStaticFunction>'))
    },
})
