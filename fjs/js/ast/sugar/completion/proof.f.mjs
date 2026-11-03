/** Invocation completion preserves normal continuations and exact return owners. */

import { assert, assertEq } from '../../../../asserts/module.f.js'
import { _function } from '../../../../compiler/parser/standalone.proof.f.mjs'
import { returnedBlock, hasRetainedReturn } from './module.f.js'

/** @type {(body: string) => import('../source.ts').SourceBlock} */
const source = body => _function(`export default (a,b)=>{${body}};`).body

export const proof = /** @type {const} */ ({
    terminalTransfersAndGuards: () => {
        const returned = returnedBlock(source('return 1;const dead=2;'))
        assertEq(returned.statements.length, 0)
        assertEq(returned.exit[0], 'return')
        assertEq(returnedBlock(source('throw 1;const dead=2;')).exit[0], 'throw')
        assertEq(returnedBlock(source('if(a){return 1;}else{return 2;}const dead=3;')).exit[0], 'if')
        assertEq(returnedBlock(source('if(a){return 1;}return 2;')).exit[0], 'if')
        assertEq(returnedBlock(source('const x=1;')).statements.length, 1)
        assertEq(returnedBlock(source('if(a){}return 2;')).statements[0][0], 'if')
    },
    mixedArmsKeepOwningReturns: () => {
        for(const body of [
            'if(a){return 1;}else{const x=2;}return 3;',
            'if(a){return 1;}else{if(b){return 2;}}return 3;',
            'if(a){return 1;}else{switch(b){case 0:{return 2;}}}return 3;',
        ]) {
            const completed = returnedBlock(source(body))
            assertEq(completed.statements[0][0], 'if')
            assertEq(hasRetainedReturn(completed), true)
        }
    },
    switchCompletion: () => {
        for(const body of [
            'switch(a){case 0:{return 1;}default:{return 2;}}const dead=3;',
            'switch(a){case 0:{return 1;}}return 2;',
        ]) { assertEq(returnedBlock(source(body)).exit[0], 'switch') }
        for(const body of [
            'switch(a){case 0:{return 1;}default:{break;}}return 2;',
            'switch(a){case 0:{break;}default:{return 2;}}return 3;',
        ]) { assertEq(returnedBlock(source(body)).statements[0][0], 'switch') }
    },
    retainedNestedOwners: () => {
        assertEq(hasRetainedReturn(source('return 1;const dead=2;')), true)
        assertEq(hasRetainedReturn(returnedBlock(source('return 1;const dead=2;'))), false)
        assertEq(hasRetainedReturn(source('while(a){return 1;}')), true)
        assertEq(hasRetainedReturn(source('for(const x of [1]){return x;}')), true)
        assertEq(hasRetainedReturn(source('if(a){return 1;}')), true)
        assertEq(hasRetainedReturn(source('switch(a){case 0:{return 1;}default:{break;}}')), true)
        assertEq(hasRetainedReturn(source('const nested=()=>{return 1;};')), false)
        assertEq(hasRetainedReturn(returnedBlock(source('if(a){return 1;}else{return 2;}'))), false)
        assertEq(hasRetainedReturn(returnedBlock(source('switch(a){case 0:{return 1;}default:{return 2;}}'))), false)
        const terminal = source('while(true){return 1;}').statements[0]
        assert(terminal[0] === 'while')
        assertEq(hasRetainedReturn({ statements: [], exit: ['terminal-loop', terminal[1]] }), true)
    },
})
