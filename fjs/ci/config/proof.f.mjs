import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { actions, bun, deno, images, jobTimeout, node, rust, spidermonkey, typescript, wasmer, wasmtime } from './module.f.js'

export const proof = /** @type {const} */ ({
    runnerImages: () => {
        const runners = Object.entries(images).flatMap(([system, architectures]) => {
            assertStructurallySame(Object.keys(architectures), ['intel', 'arm'])
            const names = Object.values(architectures)
            assert(names.every(name => name.startsWith(`${system}-`)))
            return names
        })
        assertEq(new Set(runners).size, runners.length)
    },
    versionPins: () => {
        for (const version of /** @type {const} */ ([bun, deno, node, rust, spidermonkey.version, typescript.version, wasmer, wasmtime])) {
            const parts = version.split('.')
            assertEq(parts.length, 3)
            assert(parts.every(part => part.length !== 0 && Number.isSafeInteger(Number(part)) && Number(part) >= 0))
        }
        assertEq(actions['dtolnay/rust-toolchain'], rust)
        for (const [name, pin] of Object.entries(actions)) {
            assert(name.includes('/'))
            assert(pin.length !== 0)
        }
        assert(Number.isSafeInteger(jobTimeout) && jobTimeout > 0)
    },
})
