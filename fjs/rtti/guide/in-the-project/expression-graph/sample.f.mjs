/**
 * The schemas of [`README.md`](./README.md), the expression graph's operators
 * and values, as the page's demo and the module page's demo show them: each
 * imported from the module that declares it, with a value it accepts.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { projectSchema } from '../../../schema-demo/module.f.mjs'
import { op1Id } from '../../../../edag/module.f.mjs'
import { value as edagValue } from '../../../../edag/value/module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Unary operator',
        about: 'The unary operators of the expression graph, as a union of strings. The VM\'s operator cases check membership with validate, the one project use that keeps the value.',
        schemas: projectSchema('op1Id', 'edag', op1Id),
        value: 'export default "typeof";',
    },
    {
        name: 'Evaluated EDAG value',
        about: 'An evaluated value of the expression graph: data, and functions whose captures are values. Recursive. Read with validate, so a checked value keeps its identity and sharing.',
        schemas: projectSchema('value', 'edag/value', edagValue),
        value: 'export default ["[]",[1,"a",["undefined"]]];',
    },
]
