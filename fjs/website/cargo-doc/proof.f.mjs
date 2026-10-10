import { assert, assertEq } from '../../asserts/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { cargoDocPage, crateHref, crateOf } from './module.f.mjs'

const local = /** @type {const} */ ({ commit: null, branch: null, funding: [] })

export const proof = {
    crateOf: () => {
        assertEq(crateOf('nanvm-effects-node'), 'nanvm_effects_node')
        assertEq(crateOf('plain'), 'plain')
    },
    crateHref: () => assertEq(crateHref('nanvm_lib'), '/cargo.doc/nanvm_lib/index.html'),
    page: () => {
        const html = utf8ToString(cargoDocPage(local)(['nanvm_harness', 'nanvm_lib']))
        assert(html.includes('<h1>Rust API</h1>'), html)
        assert(html.includes('<li><a href="/cargo.doc/nanvm_harness/index.html">nanvm_harness</a></li><li><a href="/cargo.doc/nanvm_lib/index.html">nanvm_lib</a></li>'), html)
    },
}
