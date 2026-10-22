/**
 * The page's demo: [`README.md`](./README.md)'s lesson in the rtti demo, with
 * the schema drawn as a graph, what rtti derives from it, and a value the
 * reader can change, with what `parse` and `validate` make of it.
 *
 * @module
 */

import { schemaDemo } from '../../../schema-demo/module.f.mjs'
import { lessons } from './sample.f.mjs'

export const demo = schemaDemo([['Open containers', lessons]])
