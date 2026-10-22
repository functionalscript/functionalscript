import { assertStructurallySame } from '../../../../asserts/module.f.js'
import { toJsonSchema } from '../../../../media/json/schema/module.f.mjs'
import { bigint, never, option, or, string, unknown } from '../../../module.f.mjs'
import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        lossyIntegers: () => verdicts('Lossy integers', [true]),
    },
    // The page's example and table.
    examples: {
        page: () => assertStructurallySame(toJsonSchema({ id: bigint, note: or(option, string) }), {
            type: 'object',
            properties: { id: { type: 'integer' }, note: { type: 'string' } },
            required: ['id'],
            additionalProperties: { not: {} },
        }),
        unknown: () => assertStructurallySame(toJsonSchema(unknown), {}),
        never: () => assertStructurallySame(toJsonSchema(never), { not: {} }),
        undefinedConst: () => assertStructurallySame(toJsonSchema(undefined), { not: {} }),
        wholeKind: () => assertStructurallySame(toJsonSchema(or(true, false)), { type: 'boolean' }),
        // The nearest double.
        lossy: () => assertStructurallySame(toJsonSchema(9007199254740993n), { const: 9007199254740992 }),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
