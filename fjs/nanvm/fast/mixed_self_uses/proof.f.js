import { assert, assertEq } from '../../../asserts/module.f.js'
import { generate, path } from './module.f.js'

export const proof = /** @type {const} */ ({
    generate: () => {
        assertEq(path, 'nanvm/harness/gen.fast/mixed_self_uses.rs')
        const rust = generate()
        assert(rust.startsWith('// Fixture source: `fjs/nanvm/fast/mixed_self_uses/module.f.js`; regenerate with `npm run gen`.'))
        assert(rust.includes('pub fn module<A: IStaticFunction>'))
    },
})
