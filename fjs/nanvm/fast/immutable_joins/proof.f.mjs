import { assert, assertEq } from '../../../asserts/module.f.js'
import { _joinBody, generate, path } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    directAndGraphJoinsUseImmutableRustBindings: () => {
        assertEq(path, 'nanvm/harness/gen.fast/immutable_joins.rs')
        const rust = generate()
        assert(rust.startsWith('// Fixture source: `fjs/nanvm/fast/immutable_joins/module.f.mjs`; regenerate with `npm run gen`.'))
        assert(rust.includes('pub fn module<A: IStaticFunction>'))
        assert(!_joinBody().includes('let mut '))
    },
})
