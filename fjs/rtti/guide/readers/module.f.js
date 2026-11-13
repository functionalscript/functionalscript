/**
 * The lessons of the readers pages, in the order the module page's demo lists
 * them. A page owns its lessons: each sits in the page's `sample.f.js`.
 *
 * @module
 *
 * @import { DemoExample } from '../../types.ts'
 */

import { lessons as parseAndValidate } from './parse-and-validate/sample.f.js'
import { lessons as errors } from './errors/sample.f.js'

/** @type {readonly DemoExample[]} */
export const lessons = [...parseAndValidate, ...errors]
