import { basicNode } from './module.f.ts'
import { test } from '../common/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    basicNode: () => {
        const extra = [test({ run: 'echo extra' })]
        const steps = basicNode('22.0.0')(extra)
        assertEq(steps.length, 3)
        const [setupNode, npmCi, extraStep] = steps
        assertEq(setupNode.type, 'install')
        assertEq(setupNode.type === 'install' ? setupNode.step.uses : undefined, 'actions/setup-node@v7.0.0')
        assertEq(setupNode.type === 'install' ? setupNode.step.with?.['node-version'] : undefined, '22.0.0')
        assertEq(npmCi.type, 'test')
        assertEq(npmCi.type === 'test' ? npmCi.step.run : undefined, 'npm ci')
        assertEq(extraStep, extra[0])
    },
}
