/**
 * The schemas of [`README.md`](./README.md), the media formats and JSON
 * itself, as the page's demo and the module page's demo show them: each
 * imported from the module that declares it, with a value it accepts.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { projectSchema } from '../../../schema-demo/module.f.mjs'
import { revisionSchema } from '../../../../media/revision/module.f.mjs'
import { lockSchema } from '../../../../media/lock/module.f.mjs'
import { noteSchema } from '../../../../media/note/module.f.mjs'
import { unknown as jsonValue } from '../../../../media/json/rtti/module.f.mjs'
import { unknown as jsonSchema } from '../../../../media/json/schema/module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Revision',
        about: 'vnd.fjs.revision: one step in the history of a mutable object over a content-addressable store. open(), so an older reader still reads a revision a newer writer extended.',
        schemas: projectSchema('revisionSchema', 'media/revision', revisionSchema),
        value: 'export default {"dialect":"vnd.fjs.revision","subject":"todo","parents":[],"snapshot":"c1dq3pe0t4f7a2kx","generation":0};',
    },
    {
        name: 'Lock',
        about: 'vnd.fjs.lock: a lock map as a blob of its own, so several revisions can share one resolution. The map nests: a value is a hash or another map.',
        schemas: projectSchema('lockSchema', 'media/lock', lockSchema),
        value: 'export default {"dialect":"vnd.fjs.lock","lock":{"fjs":"c1dq3pe0t4f7a2kx","deps":{"left-pad":"b7m2mnk9w0vqwhh4"}}};',
    },
    {
        name: 'Note',
        about: 'vnd.fjs.note: a note, todo or issue as a blob: its text, what it depends on, and a priority from P1 to P5.',
        schemas: projectSchema('noteSchema', 'media/note', noteSchema),
        value: 'export default {"dialect":"vnd.fjs.note","text":"Show the project\'s own schemas in the rtti demo","priority":"P2"};',
    },
    {
        name: 'Any JSON value',
        about: 'The JSON data model as a schema: a primitive, an object of JSON values, or an array of them. The graph draws recursive uses as arrows back to the definition.',
        schemas: projectSchema('unknown', 'media/json/rtti', jsonValue),
        value: 'export default {"name":"fjs","tags":["data","schema"],"stars":42,"private":false,"homepage":null};',
    },
    {
        name: 'JSON Schema',
        about: 'A JSON Schema (draft 2020-12) object, the target toJsonSchema converts rtti schemas into. Recursive: a schema\'s properties and items are schemas.',
        schemas: projectSchema('unknown', 'media/json/schema', jsonSchema),
        value: 'export default {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]};',
    },
]
