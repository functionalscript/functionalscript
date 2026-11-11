/**
 * The lessons of the outputs pages, in the order the module page's demo lists
 * them. A page owns its lessons: each sits in the page's `sample.f.js`.
 *
 * @module
 *
 * @import { DemoExample } from '../../types.ts'
 */

import { lessons as typescript } from './typescript/sample.f.js'
import { lessons as jsonSchema } from './json-schema/sample.f.js'
import { lessons as dataForm } from './data-form/sample.f.js'

/** @type {readonly DemoExample[]} */
export const lessons = [...typescript, ...jsonSchema, ...dataForm]
