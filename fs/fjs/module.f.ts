/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 */
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../emergent_testing/module.f.ts'
import { main as casMain } from '../cas/module.f.ts'
import { import_, type NodeOp, type NodeProgram } from '../effects/node/module.f.ts'
import { dispatch, type Commands } from '../cli/module.f.ts'

export const main: NodeProgram = options => {
    const commands: Commands<NodeOp> = [
        {
            names: ['test', 't'],
            description: 'Run the FunctionalScript test suite',
            handler: args => testMain({ ...options, args }),
        },
        {
            names: ['compile', 'c'],
            description: 'Compile a FunctionalScript module to JavaScript',
            handler: compile,
        },
        {
            names: ['cas', 's'],
            description: 'Content-addressable storage operations',
            handler: casMain,
        },
        {
            names: ['run', 'r'],
            description: 'Run a FunctionalScript module as a NodeProgram',
            handler: ([file, ...args]) => import_(file).step(([s, v]) => {
                if (s === 'error') { throw v }
                return (v.main as NodeProgram)({ ...options, args })
            }),
        },
    ]
    return dispatch(commands)(options.args)
}
