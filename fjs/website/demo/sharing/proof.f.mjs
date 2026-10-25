/** @import { Fields, Inputs, Sharing } from './types.ts' */
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.js'
import { encode } from '../../../basen/base64/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { fragmentLimit, defaultsOf, validateInputs, decodeFragment, restoreInputs, encodeFragment, textSharing, recordSharing, withInputs, sharingControls, earlyInputCapture } from './module.f.mjs'
import { pureOk } from '../../../effects/module.f.mjs'

/** @type {(json: string) => string} */
const raw = json => `#demo:state=${assertNotNullish(encode(utf8(json))).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')}`
/** @type {Fields} */
const fields = { text: { default: 'hello' }, choice: { default: 'one', choices: ['one', 'two'] }, checked: { default: true }, empty: { default: '' } }
const initial = { text: 'hello', choice: 'one', checked: true, empty: '', output: 'not an input' }
const sharing = recordSharing(initial, fields, {}, [{ id: 'hello&雪', inputs: defaultsOf(fields) }])
/** @type {(inputs: Inputs) => Inputs} */
const roundtrip = inputs => {
    const encoded = encodeFragment(sharing, inputs)
    assert(encoded[0] === 'ok')
    const decoded = decodeFragment(encoded[1])
    assert(decoded[0] === 'ok' && decoded[1] !== null)
    const restored = restoreInputs(sharing, decoded[1])
    assert(restored[0] === 'ok')
    return restored[1]
}
export const proof = {
    roundtrip: () => {
        const inputs = { text: 'Hello 🌍 % & = +\n\u0000', choice: 'two', checked: false, empty: '' }
        assertStructurallySame(roundtrip(inputs), inputs)
        assertStructurallySame(roundtrip({}), defaultsOf(fields))
        const encoded = encodeFragment(sharing, defaultsOf(fields))
        assertStructurallySame(encoded, ['ok', '#demo:example=hello%26%E9%9B%AA'])
        assert(encodeFragment(sharing, { ...defaultsOf(fields), checked: false })[1].startsWith('#demo:state='))
    },
    defaultsAndNamespaces: () => {
        assertStructurallySame(decodeFragment('#readme-heading'), ['ok', null])
        assertStructurallySame(decodeFragment(''), ['ok', null])
        assertStructurallySame(decodeFragment('#demo'), ['ok', { kind: 'defaults' }])
        assertStructurallySame(restoreInputs(sharing, { kind: 'defaults' }), ['ok', defaultsOf(fields)])
        assertStructurallySame(restoreInputs(sharing, { kind: 'state', inputs: { checked: false } }), ['ok', { ...defaultsOf(fields), checked: false }])
        assertEq(restoreInputs(sharing, { kind: 'example', id: 'retired' })[0], 'error')
        assertStructurallySame(encodeFragment(recordSharing({}, {}), {}), ['ok', '#demo'])
        const state = raw('{"v":1,"inputs":{"text":"state wins"}}')
        const decoded = decodeFragment(`${state}&example=retired`)
        assertStructurallySame(decoded, ['ok', { kind: 'state', inputs: { text: 'state wins' } }])
    },
    invalidParameters: () => {
        for (const hash of ['#demo:', '#demo:example', '#demo:example=', '#demo:other=x', '#demo:example=%xx', '#demo:example=%ff', '#demo:example=a&example=b', '#demo:example=a&%65xample=b', '#demo:state=x&state=y', '#demo:example=a&', '#demo:state=']) {
            assertEq(decodeFragment(hash)[0], 'error')
        }
    },
    invalidState: () => {
        for (const hash of ['#demo:state=A', '#demo:state=Zg==', '#demo:state=Zh', '#demo:state=_w', '#demo:state=@@', raw('{'), raw('null'), raw('[]'), raw('1'), raw('{"v":2,"inputs":{}}'), raw('{"v":"1","inputs":{}}'), raw('{"v":1}'), raw('{"v":1,"inputs":null}'), raw('{"v":1,"inputs":[]}'), raw('{"v":1,"inputs":{"x":2}}'), raw('{"v":1,"inputs":{"x":{}}}'), raw('{"v":1,"inputs":{},"extra":true}')]) {
            assertEq(decodeFragment(hash)[0], 'error')
        }
    },
    validation: () => {
        for (const inputs of [{ unknown: 'x' }, { text: true }, { choice: 'invalid' }, { checked: '' }, { constructor: 'not declared' }]) {
            assertEq(validateInputs(fields, inputs)[0], 'error')
            assertEq(encodeFragment(sharing, inputs)[0], 'error')
            assertEq(restoreInputs(sharing, { kind: 'state', inputs })[0], 'error')
        }
        const constrained = { ...sharing, validate: (/** @type {Inputs} */ inputs) => inputs.choice === 'two' ? 'Incompatible input set' : null }
        assertEq(restoreInputs(constrained, { kind: 'state', inputs: { choice: 'two' } })[0], 'error')
        assertEq(encodeFragment(constrained, { choice: 'two' })[0], 'error')
        assertEq(restoreInputs(constrained, { kind: 'defaults' })[0], 'ok')
        const badExample = { ...sharing, examples: [{ id: 'bad', inputs: { unknown: 'x' } }] }
        assertEq(restoreInputs(badExample, { kind: 'example', id: 'bad' })[0], 'error')
    },
    sizeLimit: () => {
        assertEq(fragmentLimit, 16_384)
        const prefix = '#demo:example='
        const id = 'a'.repeat(fragmentLimit - prefix.length)
        assertEq(decodeFragment(prefix + id)[0], 'ok')
        assertEq(decodeFragment(prefix + id + 'a')[0], 'error')
        assertEq(encodeFragment(textSharing('source', 'a', [['A', 'a', id]]), { source: 'a' })[0], 'ok')
        assertEq(encodeFragment(textSharing('source', 'a', [['A', 'a', id + 'a']]), { source: 'a' })[0], 'error')
        for (const text of ['a'.repeat(fragmentLimit + 1), 'a'.repeat(13_000), '🌍'.repeat(5_000)]) {
            assertEq(encodeFragment(sharing, { text })[0], 'error')
        }
        assertEq(encodeFragment(sharing, { text: 'a'.repeat(10_000), empty: 'b'.repeat(10_000) })[0], 'error')
        assertEq(encodeFragment(sharing, { text: 'a'.repeat(10_000) })[0], 'ok')
    },
    adapters: () => {
        const plain = textSharing('source', '')
        assertStructurallySame(plain.read(''), { source: '' })
        assertEq(plain.restore({ source: 'new' }), 'new')
        const text = textSharing('source', 'first', [['First', 'first', 'first'], ['Second', 'second', 'second']])
        assertStructurallySame(encodeFragment(text, text.read('second')), ['ok', '#demo:example=second'])
        const mapped = recordSharing({ inside: 'a', output: 42 }, { outside: { default: 'a' } }, { outside: 'inside' })
        assertStructurallySame(mapped.read({ inside: 'b', output: 0 }), { outside: 'b' })
        assertStructurallySame(mapped.restore({ outside: 'b' }), { inside: 'b', output: 42 })
        const flat = recordSharing({ constructor: 'a' }, { constructor: { default: 'a' } })
        assertStructurallySame(flat.read({ constructor: 'b' }), { constructor: 'b' })
        assertStructurallySame(flat.restore({ constructor: 'b' }), { constructor: 'b' })
        const demo = withInputs({ init: { text: '', flag: false, choice: 'a', result: null }, update: state => () => pureOk(state), view: () => ['div'] }, ['text', 'flag', 'choice'], { choice: ['a', 'b'] })
        const contract = assertNotNullish(demo.sharing)
        assertStructurallySame(contract.read(demo.init), { text: '', flag: false, choice: 'a' })
        assertEq(contract.restore({ text: 'x', flag: true, choice: 'b' }).result, null)
        const html = htmlToString(sharingControls())
        assert(html.includes('data-demo-sharing="" hidden=""'))
        assert(html.includes('Copy demo link'))
        assert(html.includes('role="status"'))
        assert(htmlToString(earlyInputCapture).includes('data-demo-input-edited'))
    },
}
