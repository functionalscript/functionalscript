/**
 * Native JavaScript spelling of the internal member-presence query. The
 * emitter has no represented-runtime parameter: its built-ins are the host's
 * implementations of the shared member inventory.
 *
 * @module
 * @import { Chunk } from '../../../../text/marked/types.ts'
 */

import { members } from '../../../members/module.f.js'
import { leafSerialize } from '../../../../media/datajs/serializer/module.f.mjs'
import { toArray } from '../../../../types/list/alt/module.f.mjs'
import { chunksText, keyword, literal } from '../../../../text/marked/module.f.mjs'
import { _name as name, _binding as binding } from '../../../../compiler/serializer/names/module.f.mjs'

const inventory = '{' + Object.entries(members).map(([kind, names]) => kind + ':['
    + Object.entries(names).map(([key]) => chunksText(toArray(leafSerialize(key)))).join(',') + ']').join(',') + '}'

/**
 * Inspect only represented own fields, indices and length before the native
 * method inventory. Unsupported host prototype values never become present.
 * Descriptor lookup also retains the nullish-receiver failure.
 *
 * @type {(path: string) => readonly Chunk[]}
 */
export const _memberPresentChunks = path => {
    const receiver = name(`${path}/receiver`)
    const key = name(`${path}/key`)
    const descriptor = name(`${path}/descriptor`)
    return [
        `((${binding(receiver)},${binding(key)})=>{`,
        keyword('const'),
        ` ${binding(descriptor)}=Object.getOwnPropertyDescriptor(${receiver},${key});`,
        keyword('if'),
        `(${descriptor}?.enumerable===`, literal('true'), '){', keyword('return'),
        ` ${descriptor}.value!==`, literal('null'), `&&${descriptor}.value!==`, literal('undefined'), ';}',
        keyword('if'), `(${key}===`, literal('"length"'), '&&(', keyword('typeof'),
        ` ${receiver}===`, literal('"string"'), '||', keyword('typeof'),
        ` ${receiver}===`, literal('"function"'), `||${receiver} `, keyword('instanceof'), ' Array)){',
        keyword('return'), ' ', literal('true'), ';}',
        keyword('return'), ` (${inventory})[${receiver} `, keyword('instanceof'),
        ' Array?', literal('"array"'), ':', keyword('typeof'), ` ${receiver}]?.includes(${key})===`, literal('true'), ';})',
    ]
}
