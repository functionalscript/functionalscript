/** Unary plus through every output of the compiler: the same node, each output's own spelling of it. */

import { assert, assertEq } from '../asserts/module.f.js'
import { compileSource, moduleRefused } from './proof.f.js'

export const proof = /** @type {const} */ ({
    // The JavaScript output writes the prefix back, apart from a sign or
    // another prefix beside it, and in a group where it is a base.
    javascript: () => {
        assertEq(compileSource('export default a => +a;')('output.js'), 'export default ($0)=>+$0;')
        assertEq(compileSource('export default a => + +a;')('output.js'), 'export default ($0)=>+ +$0;')
        assertEq(compileSource('export default (a, b) => a + +b;')('output.js'), 'export default ($0,$1)=>$0+ +$1;')
        assertEq(compileSource('export default a => -+a;')('output.js'), 'export default ($0)=>-+$0;')
        assertEq(compileSource('export default a => (+a) ** 2;')('output.js'), 'export default ($0)=>(+$0)**2;')
        assertEq(compileSource('export default a => typeof +a;')('output.js'), 'export default ($0)=>typeof +$0;')
    },
    // An index is a numeric key in every output, the prefix inside it.
    index: () => {
        assertEq(compileSource('export default (a, x) => a[+x];')('output.js'), 'export default ($0,$1)=>$0[Number(+$1)];')
        assertEq(compileSource('export default (a, x) => a?.[+x];')('output.js'), 'export default ($0,$1)=>$0?.[Number(+$1)];')
        assertEq(compileSource('export default (a, x) => a[+x];')('output.edag.data.js'),
            'export default ["{}",[[":","default",["=>",2,[],[".",["arg",0],["Number",["+",["arg",1]]]]]]]];')
        assert(compileSource('export default (a, x) => a[+x];')('output.rs').includes(
            'Any::dot(_args.argument(0), (Any::number((Any::unary_plus(_args.argument(1)))?))?).end()'))
    },
    // The graph holds the node, and the Rust output calls NaNVM's own
    // conversion, which refuses a bigint as JavaScript does.
    graphAndRust: () => {
        assertEq(compileSource('export default a => +a;')('output.edag.data.js'), 'export default ["{}",[[":","default",["=>",1,[],["+",["arg",0]]]]]];')
        assert(compileSource('export default a => +a;')('output.rs').includes('Any::unary_plus(_args.argument(0))'))
    },
    // A data output is the value the conversion gives, and a module whose
    // conversion throws has none.
    data: () => {
        assertEq(compileSource('export default +"5";')('output.json'), '5')
        assertEq(compileSource('export default [+true, +null, +[], +"1e3"];')('output.json'), '[1,0,0,1000]')
        assert(moduleRefused('export default +1n;').includes('module initialization failed'))
    },
})
