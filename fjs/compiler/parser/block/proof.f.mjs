import { assert, assertEq } from '../../../asserts/module.f.js'
import { _function } from '../standalone.proof.f.mjs'
import { _flattenedStandalone, _hasArmThrow, _regionBlock } from './module.f.js'

export const proof = /** @type {const} */ ({
    regions: () => {
        const body = _function('export default ()=>{return 1;};').body
        assertEq(_regionBlock(['block', body]), body)
        const empty = /** @type {const} */ ({ statements: [], exit: ['yield', undefined] })
        assertEq(_flattenedStandalone(empty), empty.statements)
        assertEq(_flattenedStandalone({ statements: [], exit: ['throw', 2] })[0][0], 'throw')
    },
    throws: () => {
        for (const [source, expected] of /** @type {const} */ ([
            ['export default ()=>{return 1;};', false],
            ['export default ()=>{throw 1;};', true],
            ['export default ()=>{{throw 1;}return 0;};', true],
            ['export default ()=>{while(true){break;}return 0;};', false],
            ['export default ()=>{for(const x of []){}return 0;};', false],
            ['export default ()=>{while(true){continue;}};', false],
            ['export default ()=>{if(true){return 1;}else{return 2;}return 0;};', false],
            ['export default ()=>{switch(1){case 1:{return 1;}default:{return 2;}}};', false],
            ['export default ()=>{let x=0;if(true){x=1;}return x;};', false],
            ['export default ()=>{while(false){if(true){throw 1;}}return 0;};', true],
            ['export default ()=>{while(false){switch(1){case 1:{break;}default:{break;}}}return 0;};', false],
        ])) { assertEq(_hasArmThrow([_function(source).body]), expected) }
        const loop = _function('export default ()=>{while(true){throw 1;}};').body.statements[0]
        assert(loop[0] === 'while')
        assertEq(_hasArmThrow([{ statements: [], exit: ['terminal-loop', loop[1]] }]), true)
        assertEq(_hasArmThrow([]), false)
    },
})
