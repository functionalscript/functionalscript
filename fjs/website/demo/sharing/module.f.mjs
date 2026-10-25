/** Pure fragment codec, validation and input-only sharing adapters.
 * @module
 * @import { Fields, Fragment, Inputs, Sharing, SharedExample, InputName } from './types.ts'
 * @import { Examples } from '../examples/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 */
import { encode, decode } from '../../../basen/base64/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { fromVec, stringToU8List } from '../../../text/utf8/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { parse, stringifySorted } from '../../../media/json/module.f.mjs'
import { percentDecode } from '../../../text/percent/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'

/** Maximum ASCII characters, including #demo: and all encoded parameters. @type {number} */
export const fragmentLimit = 16 * 1_024
const { entries, keys, fromEntries } = Object
/** @param {Unknown | undefined} value
 * @returns {value is import('../../../media/json/types.ts').Object}
 */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** @param {Unknown | undefined} value
 * @returns {value is Inputs}
 */
const inputsObject = value => object(value) && Object.values(value).every(v => typeof v === 'string' || typeof v === 'boolean')
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
    const invalid = entries(inputs).find(([name, value]) => !Object.hasOwn(fields, name)
        || typeof value !== typeof fields[name].default
        || fields[name].choices !== undefined && !fields[name].choices.includes(/** @type {string} */ (value)))
    return invalid === undefined ? ok({ ...defaultsOf(fields), ...inputs })
        : error(`Unknown input or invalid value: ${invalid[0]}`)
}
/** Strict, canonical unpadded Base64url, UTF-8, and versioned JSON.
 * @type {(text: string) => Result<Inputs, string>}
 */
const decodeState = text => {
    if (text === '' || !text.split('').every(c => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.includes(c))) { return error('Malformed Base64url state') }
    const standard = text.replaceAll('-', '+').replaceAll('_', '/')
    const bytes = decode(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='))
    if (bytes === null) { return error('Malformed Base64url state') }
    const decoded = fromVec(bytes)
    if (decoded === null) { return error('Malformed Base64url or UTF-8 state') }
    const parsed = parse(decoded)
    if (parsed[0] === 'error') { return error('Malformed JSON state') }
    const value = parsed[1]
    if (!object(value) || value.v !== 1) { return error('Unsupported demo state version') }
    if (keys(value).some(k => k !== 'v' && k !== 'inputs') || !inputsObject(value.inputs)) { return error('Invalid demo state schema') }
    return ok(value.inputs)
}
/** Ignore documentation fragments. State takes precedence over example, after
 * validating parameter spelling, escapes and uniqueness.
 * @type {(hash: string) => Result<Fragment | null, string>}
 */
export const decodeFragment = hash => {
    if (hash !== '#demo' && !hash.startsWith('#demo:')) { return ok(null) }
    if (hash.length > fragmentLimit) { return error('Demo link exceeds the 16 KiB fragment limit') }
    if (hash === '#demo') { return ok({ kind: 'defaults' }) }
    const pairs = hash.slice(6).split('&').map(part => {
        const split = part.indexOf('=')
        return split < 0 ? [null, null] : [percentDecode(part.slice(0, split)), percentDecode(part.slice(split + 1))]
    })
    const names = pairs.map(([name]) => name)
    if (pairs.some(([name, value]) => name !== 'state' && name !== 'example' || value === null)
        || names.some((name, index) => names.indexOf(name) !== index)) { return error('Malformed, unknown, or repeated demo parameter') }
    const state = pairs.find(([name]) => name === 'state')
    if (state !== undefined) {
        const decoded = decodeState(/** @type {string} */ (state[1]))
        return decoded[0] === 'error' ? decoded : ok({ kind: 'state', inputs: decoded[1] })
    }
    const id = pairs[0][1]
    return id === '' ? error('Unknown demo example') : ok({ kind: 'example', id: /** @type {string} */ (id) })
}
/** @type {<S>(sharing: Sharing<S>, inputs: Inputs) => Result<Inputs, string>} */
const checked = (sharing, inputs) => {
    const valid = validateInputs(sharing.fields, inputs)
    if (valid[0] === 'error') { return valid }
    const message = sharing.validate === undefined ? null : sharing.validate(valid[1])
    return message === null ? valid : error(message)
}
/** @type {<S>(sharing: Sharing<S>, fragment: Fragment) => Result<Inputs, string>} */
export const restoreInputs = (sharing, fragment) => {
    if (fragment.kind === 'defaults') { return checked(sharing, {}) }
    if (fragment.kind === 'state') { return checked(sharing, fragment.inputs) }
    const example = sharing.examples.find(e => e.id === fragment.id)
    return example === undefined ? error(`Unknown or retired demo example: ${fragment.id}`)
        : checked(sharing, example.inputs)
}
/** @type {(a: Inputs, b: Inputs) => boolean} */
const same = (a, b) => keys(a).length === keys(b).length && entries(a).every(([name, value]) => Object.hasOwn(b, name) && b[name] === value)
/** Defaults use #demo; changed inputs use a complete example match or v1 JSON.
 * @type {<S>(sharing: Sharing<S>, inputs: Inputs) => Result<string, string>}
 */
export const encodeFragment = (sharing, inputs) => {
    const valid = checked(sharing, inputs)
    if (valid[0] === 'error') { return valid }
    if (same(valid[1], defaultsOf(sharing.fields))) { return ok('#demo') }
    const example = sharing.examples.find(e => same(valid[1], { ...defaultsOf(sharing.fields), ...e.inputs }))
    if (example !== undefined) {
        const hash = `#demo:example=${escaped(example.id)}`
        return hash.length > fragmentLimit ? error('Demo link exceeds the 16 KiB fragment limit') : ok(hash)
    }
    if (Object.values(valid[1]).some(v => typeof v === 'string' && v.length > fragmentLimit)) { return error('Inputs exceed the 16 KiB fragment limit') }
    const json = stringifySorted({ v: 1, inputs: valid[1] })
    if (json.length > fragmentLimit) { return error('Inputs exceed the 16 KiB fragment limit') }
    // Bounded JSON is at most 4 * fragmentLimit UTF-8 bytes, below the Vec cap.
    const encoded = assertNotNullish(encode(utf8(json)))
    const hash = `#demo:state=${encoded.replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')}`
    return hash.length > fragmentLimit ? error('Demo link exceeds the 16 KiB fragment limit') : ok(hash)
}
/** @type {(name: string, init: string, examples?: Examples) => Sharing<string>} */
export const textSharing = (name, init, examples = []) => ({
    fields: { [name]: { default: init } },
    examples: examples.map(([, source, id]) => ({ id, inputs: { [name]: source } })),
    read: text => ({ [name]: text }),
    restore: inputs => /** @type {string} */ (inputs[name]),
})
/** Flat state adapter: reset outputs/action history to init while replacing all
 * declared inputs. A control name may differ from the state key.
 * @type {<S>(init: S, fields: Fields, names?: Readonly<Record<string, string>>, examples?: readonly SharedExample[]) => Sharing<S>}
 */
export const recordSharing = (init, fields, names = {}, examples = []) => {
    /** @type {(name: string) => string} */
    const keyOf = name => Object.hasOwn(names, name) ? names[name] : name
    return {
        fields, examples,
        read: state => fromEntries(keys(fields).map(name => [name,
            (/** @type {Inputs} */ (/** @type {unknown} */ (state)))[keyOf(name)]])),
        restore: inputs => ({ ...init, ...fromEntries(entries(inputs).map(([name, value]) => [keyOf(name), value])) }),
    }
}
/** Declare top-level string/boolean inputs; their init values are the defaults.
 * @type {<S, O extends import('../../../effects/types.ts').Operation>(demo: import('../types.ts').Demo<S, import('../types.ts').DemoEvent, O>, names: readonly InputName<S>[], choices?: Readonly<Record<string, readonly string[]>>, examples?: readonly SharedExample[]) => import('../types.ts').Demo<S, import('../types.ts').DemoEvent, O>}
 */
export const withInputs = (demo, names, choices = {}, examples = []) => {
    const init = /** @type {Inputs} */ (/** @type {unknown} */ (demo.init))
    const fields = fromEntries(names.map(name => [name, {
        default: init[name],
        ...(Object.hasOwn(choices, name) ? { choices: choices[name] } : {}),
    }]))
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
