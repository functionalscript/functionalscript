/** Pure query codec, validation and input-only sharing adapters.
 * @module
 * @import { Fields, Query, InputField, InputValue, Inputs, Sharing, SharedExample, InputName } from './types.ts'
 * @import { Examples } from '../examples/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { definedEntries } from '../../../types/object/module.f.mjs'
import { stringToU8List } from '../../../text/utf8/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { parse } from '../../../media/json/module.f.mjs'
import { percentDecode } from '../../../text/percent/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'

/** Maximum encoded query characters plus the canonical #demo target. @type {number} */
export const queryLimit = 16 * 1_024
const { keys, fromEntries } = Object
const entries = definedEntries
/** @type {(text: string) => string} */
const escaped = text => toArray(stringToU8List(text)).map(b =>
    b >= 0x61 && b <= 0x7a || b >= 0x41 && b <= 0x5a || b >= 0x30 && b <= 0x39 || [0x2d, 0x2e, 0x5f, 0x7e].includes(b)
        ? String.fromCharCode(b) : `%${b.toString(16).padStart(2, '0').toUpperCase()}`).join('')
/** @type {(fields: Fields) => Inputs} */
export const defaultsOf = fields => fromEntries(entries(fields).map(([name, field]) => [name, field.default]))
/** Validate all fields before merging defaults; never invoke a demo on a partial set.
 * @type {(fields: Fields, inputs: Inputs) => Result<Inputs, string>}
 */
export const validateInputs = (fields, inputs) => {
    const invalid = entries(inputs).find(([name, value]) => {
        const field = fields[name]
        return !Object.hasOwn(fields, name) || field === undefined
            || typeof value !== typeof field.default
            || typeof value === 'number' && !Number.isFinite(value)
            || field.choices !== undefined && !field.choices.includes(/** @type {string} */ (value))
    })
    return invalid === undefined ? ok({ ...defaultsOf(fields), ...fromEntries(entries(inputs)) })
        : error(`Unknown input or invalid value: ${invalid[0]}`)
}
/** Decode normal URL query escaping: + means space; %2B means a literal plus.
 * @type {(search: string) => Result<Query, string>}
 */
export const decodeQuery = search => {
    if (search === '' || search === '?') { return ok({ kind: 'defaults' }) }
    if (search.length + 5 > queryLimit) { return error('Demo query exceeds the 16 KiB sharing limit') }
    if (!search.startsWith('?')) { return error('Malformed demo query') }
    const pairs = search.slice(1).split('&').map(/** @returns {readonly [string | null, string | null]} */ part => {
        const split = part.indexOf('=')
        return split < 0 ? [null, null] : [percentDecode(part.slice(0, split).replaceAll('+', ' ')), percentDecode(part.slice(split + 1).replaceAll('+', ' '))]
    })
    const names = pairs.map(([name]) => name)
    if (pairs.some(([name, value]) => name === null || name === '' || value === null)
        || names.some((name, index) => names.indexOf(name) !== index)) { return error('Malformed or repeated demo parameter') }
    return ok({ kind: 'inputs', values: fromEntries(/** @type {readonly (readonly [string, string])[]} */ (pairs)) })
}
/** @type {(field: InputField, value: string) => Result<InputValue, string>} */
const inputValue = (field, value) => {
    if (typeof field.default === 'string') { return ok(value) }
    if (typeof field.default === 'boolean') {
        return value === 'true' ? ok(true) : value === 'false' ? ok(false) : error('Expected true or false')
    }
    const number = parse(value)
    return number[0] === 'ok' && typeof number[1] === 'number' && Number.isFinite(number[1])
        ? ok(number[1]) : error('Expected a finite number')
}
/** @type {<S>(sharing: Sharing<S>, inputs: Inputs) => Result<Inputs, string>} */
const checked = (sharing, inputs) => {
    const valid = validateInputs(sharing.fields, inputs)
    if (valid[0] === 'error') { return valid }
    const message = sharing.validate === undefined ? null : sharing.validate(valid[1])
    return message === null ? valid : error(message)
}
/** A named example supplies the baseline; explicit individual inputs override it.
 * A declared input named example keeps its ordinary validation, including the
 * empty custom-tree selection. No field name is silently discarded.
 * @type {<S>(sharing: Sharing<S>, query: Query) => Result<Inputs, string>}
 */
export const restoreInputs = (sharing, query) => {
    if (query.kind === 'defaults') { return checked(sharing, {}) }
    const id = query.values.example
    const example = sharing.examples.find(e => e.id === id)
    if (id !== undefined && example === undefined && !Object.hasOwn(sharing.fields, 'example')) { return error(`Unknown or retired demo example: ${id}`) }
    const parsed = entries(query.values).filter(([name]) => name !== 'example' || Object.hasOwn(sharing.fields, name)).map(([name, value]) => {
        const field = sharing.fields[name]
        return /** @type {const} */ ([name, !Object.hasOwn(sharing.fields, name) || field === undefined
            ? error(`Unknown input: ${name}`) : inputValue(field, value)])
    })
    const invalid = parsed.find(([, result]) => result[0] === 'error')
    if (invalid !== undefined) { return error(`Invalid input ${invalid[0]}: ${invalid[1][1]}`) }
    const inputs = fromEntries(parsed.map(([name, result]) => [name, /** @type {InputValue} */ (result[1])]))
    return checked(sharing, { ...example?.inputs, ...inputs })
}
/** @type {(a: Inputs, b: Inputs) => boolean} */
const same = (a, b) => keys(a).length === keys(b).length && entries(a).every(([name, value]) => Object.hasOwn(b, name) && b[name] === value)
/** Defaults use #demo; complete example matches use a stable ID. All other
 * inputs are individual query parameters with ordinary URL escaping.
 * @type {<S>(sharing: Sharing<S>, inputs: Inputs) => Result<string, string>}
 */
export const encodeQuery = (sharing, inputs) => {
    const valid = checked(sharing, inputs)
    if (valid[0] === 'error') { return valid }
    if (same(valid[1], defaultsOf(sharing.fields))) { return ok('#demo') }
    const example = sharing.examples.find(e => same(valid[1], { ...defaultsOf(sharing.fields), ...fromEntries(entries(e.inputs)) })
        && (!Object.hasOwn(sharing.fields, 'example') || valid[1].example === e.id))
    if (Object.values(valid[1]).some(v => typeof v === 'string' && v.length > queryLimit)) { return error('Inputs exceed the 16 KiB sharing limit') }
    const query = example !== undefined ? `example=${escaped(example.id)}`
        : keys(valid[1]).toSorted().map(name => `${escaped(name)}=${escaped(String(assertNotNullish(valid[1][name])))}`).join('&')
    const link = `?${query}#demo`
    return link.length > queryLimit ? error('Demo query exceeds the 16 KiB sharing limit') : ok(link)
}
/** @type {(name: string, init: string, examples?: Examples) => Sharing<string>} */
export const textSharing = (name, init, examples = []) => ({
    fields: { [name]: { default: init } },
    examples: examples.map(([, source, id]) => ({ id, inputs: { [name]: source } })),
    read: text => ({ [name]: text }),
    restore: inputs => /** @type {string} */ (assertNotNullish(inputs[name])),
})
/** Flat state adapter: reset outputs/action history to init while replacing all
 * declared inputs. A control name may differ from the state key.
 * @type {<S>(init: S, fields: Fields, names?: StringMap<string>, examples?: readonly SharedExample[]) => Sharing<S>}
 */
export const recordSharing = (init, fields, names = {}, examples = []) => {
    /** @type {(name: string) => string} */
    const keyOf = name => Object.hasOwn(names, name) ? names[name] ?? name : name
    return {
        fields, examples,
        read: state => fromEntries(entries(fields).map(([name]) => [name,
            assertNotNullish((/** @type {Inputs} */ (/** @type {unknown} */ (state)))[keyOf(name)])])),
        restore: inputs => ({ ...init, ...fromEntries(entries(inputs).map(([name, value]) => [keyOf(name), value])) }),
    }
}
/** Declare top-level string/number/boolean inputs; their init values are the defaults.
 * @type {<S, O extends import('../../../effects/types.ts').Operation>(demo: import('../types.ts').Demo<S, import('../types.ts').DemoEvent, O>, names: readonly InputName<S>[], choices?: StringMap<readonly string[]>, examples?: readonly SharedExample[]) => import('../types.ts').Demo<S, import('../types.ts').DemoEvent, O>}
 */
export const withInputs = (demo, names, choices = {}, examples = []) => {
    const init = /** @type {Inputs} */ (/** @type {unknown} */ (demo.init))
    const fields = fromEntries(names.map(name => {
        const allowed = Object.hasOwn(choices, name) ? choices[name] : undefined
        return [name, { default: assertNotNullish(init[name]), ...(allowed === undefined ? {} : { choices: allowed }) }]
    }))
    return { ...demo, sharing: recordSharing(demo.init, fields, {}, examples) }
}
/** Capture edits from the moment the HTML arrives, before module imports load.
 * @type {Element}
 */
export const earlyInputCapture = ['script', {}, "document.addEventListener('input', event => { const root = event.target instanceof Element ? event.target.closest('[data-demo]') : null; if (root) root.setAttribute('data-demo-input-edited', String(Number(root.getAttribute('data-demo-input-edited') ?? 0) + 1)) }, true)"]
/** Feedback sits below the heading and stays visible when Demo is folded.
 * @type {() => Element}
 */
export const sharingStatus = () => ['span', { 'data-demo-link-status': '', role: 'status', hidden: '' }]
