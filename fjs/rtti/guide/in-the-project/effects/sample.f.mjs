/**
 * The schemas of [`README.md`](./README.md), the data-shaped effect requests
 * and results, as the page's demo and the module page's demo show them: each
 * imported from the module that declares it, with a value it accepts.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { projectSchema } from '../../../schema-demo/module.f.mjs'
import { dirent } from '../../../../effects/schema/module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Directory entry',
        about: 'An entry readdir answers, described by a data-validation schema in effects/schema. The corresponding handwritten TypeScript operation declarations are checked against schema-derived types.',
        schemas: projectSchema('dirent', 'effects/schema', dirent),
        value: 'export default {"name":"module.f.mjs","parentPath":"fjs/rtti","isFile":true,"isDirectory":false};',
    },
]
