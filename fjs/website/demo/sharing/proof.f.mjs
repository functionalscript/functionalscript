/** @import { Fields, Inputs, Sharing } from './types.ts' */
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { queryLimit, defaultsOf, validateInputs, decodeQuery, restoreInputs, encodeQuery, textSharing, recordSharing, withInputs, sharingStatus, earlyInputCapture } from './module.f.mjs'
import { unwrap } from '../../../types/result/module.f.js'
import { pureOk } from '../../../effects/module.f.mjs'

/** @type {Fields} */
const fields = { text: { default: 'hello' }, choice: { default: 'one', choices: ['one', 'two'] }, checked: { default: true }, empty: { default: '' }, amount: { default: 3 } }
const initial = { ...defaultsOf(fields), output: 'not an input' }
const sharing = recordSharing(initial, fields, {}, [{ id: 'hello&雪', inputs: { text: 'example' } }])
/** @type {(search: string, contract?: Sharing<any>) => import('../../../types/result/types.ts').Result<Inputs, string>} */
const restore = (search, contract = sharing) => {
    const query = decodeQuery(search)
    assert(query[0] === 'ok' && query[1] !== null)
    return restoreInputs(contract, query[1])
}
/** @type {(inputs: Inputs) => Inputs} */
const roundtrip = inputs => {
    const encoded = encodeQuery(sharing, inputs)
    assert(encoded[0] === 'ok')
    const restored = restore(encoded[1] === '#demo' ? '' : encoded[1].slice(0, -5))
    assert(restored[0] === 'ok')
    return restored[1]
}
export const proof = {
    roundtrip: () => {
        const inputs = { text: 'Hello 🌍 % & = +\n\u0000', choice: 'two', checked: false, empty: '', amount: -2.5 }
        assertStructurallySame(roundtrip(inputs), inputs)
        assertStructurallySame(roundtrip({}), defaultsOf(fields))
        assertStructurallySame(encodeQuery(sharing, defaultsOf(fields)), ['ok', '#demo'])
        assertStructurallySame(encodeQuery(sharing, { text: 'example' }), ['ok', '?example=hello%26%E9%9B%AA#demo'])
        assertStructurallySame(restore('?example=hello%26%E9%9B%AA&text=override&checked=false'), ['ok', { ...defaultsOf(fields), text: 'override', checked: false }])
        const encoded = encodeQuery(textSharing('compiler', ''), { compiler: 'export default "41";' })
        assertStructurallySame(encoded, ['ok', '?compiler=export%20default%20%2241%22%3B#demo'])
        assertEq(unwrap(restore('?text=a+b%2Bc')).text, 'a b+c')
        assertEq(unwrap(restore('?amount=1e3')).amount, 1000)
        assertEq(unwrap(restore('?checked=true')).checked, true)
    },
    emptyQueries: () => {
        assertStructurallySame(decodeQuery(''), ['ok', { kind: 'defaults' }])
        assertStructurallySame(decodeQuery('?'), ['ok', { kind: 'defaults' }])
        assertStructurallySame(restore(''), ['ok', defaultsOf(fields)])
        assertStructurallySame(decodeQuery('?text=x'), ['ok', { kind: 'inputs', values: { text: 'x' } }])
        assertStructurallySame(encodeQuery(recordSharing({}, {}), {}), ['ok', '#demo'])
    },
    invalidParameters: () => {
        for (const query of ['text=x', '?text', '?=x', '?text=%xx', '?text=%ff', '?text=a&text=b', '?text=a&%74ext=b', '?text=a&', '?text=a&&checked=true']) {
            assertEq(decodeQuery(query)[0], 'error')
        }
        for (const query of ['?unknown=x', '?constructor=x', '?state=anything', '?example=', '?example=retired', '?choice=other', '?checked=0', '?checked=', '?amount=', '?amount=01', '?amount=1e999', '?amount=null', '?amount=[]', '?amount=true', '?amount=%223%22', '?amount=NaN']) {
            assertEq(restore(query)[0], 'error')
        }
    },
    examplesAndFields: () => {
        const contract = recordSharing({ example: 'first', text: 'A' }, { example: { default: 'first', choices: ['first', 'second', ''] }, text: { default: 'A' } }, {}, [
            { id: 'first', inputs: { example: 'first', text: 'A' } }, { id: 'second', inputs: { example: 'second', text: 'B' } },
        ])
        assertStructurallySame(restore('?example=second', contract), ['ok', { example: 'second', text: 'B' }])
        assertStructurallySame(restore('?example=second&text=custom', contract), ['ok', { example: 'second', text: 'custom' }])
        assertStructurallySame(restore('?example=&text=', contract), ['ok', { example: '', text: '' }])
        assertEq(restore('?example=retired', contract)[0], 'error')
        assertStructurallySame(encodeQuery(contract, { example: 'second', text: 'B' }), ['ok', '?example=second#demo'])
        assertStructurallySame(encodeQuery(contract, { example: 'second', text: 'custom' }), ['ok', '?example=second&text=custom#demo'])
        const collision = { ...contract, examples: [{ id: 'alias', inputs: { example: 'second', text: 'B' } }] }
        assertStructurallySame(encodeQuery(collision, { example: 'second', text: 'B' }), ['ok', '?example=second&text=B#demo'])
        const ordinary = recordSharing({ example: 'value' }, { example: { default: 'value' } })
        assertStructurallySame(restore('?example=other', ordinary), ['ok', { example: 'other' }])
    },
    validation: () => {
        for (const inputs of [{ unknown: 'x' }, { text: true }, { choice: 'invalid' }, { checked: '' }, { amount: Infinity }, { amount: NaN }, { constructor: 'not declared' }]) {
            assertEq(validateInputs(fields, inputs)[0], 'error')
            assertEq(encodeQuery(sharing, inputs)[0], 'error')
        }
        const constrained = { ...sharing, validate: (/** @type {Inputs} */ inputs) => inputs.choice === 'two' ? 'Incompatible input set' : null }
        assertEq(restore('?choice=two', constrained)[0], 'error')
        assertEq(encodeQuery(constrained, { choice: 'two' })[0], 'error')
        assertEq(restore('', constrained)[0], 'ok')
        const badExample = { ...sharing, examples: [{ id: 'bad', inputs: { unknown: 'x' } }] }
        assertEq(restore('?example=bad', badExample)[0], 'error')
    },
    sizeLimit: () => {
        assertEq(queryLimit, 16_384)
        const text = 'a'.repeat(queryLimit - '?source=#demo'.length)
        const contract = textSharing('source', '')
        assertEq(encodeQuery(contract, { source: text })[0], 'ok')
        assertEq(encodeQuery(contract, { source: text + 'a' })[0], 'error')
        assertEq(decodeQuery('?source=' + text)[0], 'ok')
        assertEq(decodeQuery('?source=' + text + 'a')[0], 'error')
        const id = 'a'.repeat(queryLimit - '?example=#demo'.length)
        assertEq(encodeQuery(textSharing('source', 'b', [['A', 'a', id]]), { source: 'a' })[0], 'ok')
        assertEq(encodeQuery(textSharing('source', 'b', [['A', 'a', id + 'a']]), { source: 'a' })[0], 'error')
        assertEq(encodeQuery(sharing, { text: 'a'.repeat(queryLimit + 1) })[0], 'error')
        assertEq(encodeQuery(sharing, { text: '🌍'.repeat(1500) })[0], 'error')
        assertEq(encodeQuery(sharing, { text: 'a'.repeat(10_000), empty: 'b'.repeat(10_000) })[0], 'error')
    },
    adapters: () => {
        const plain = textSharing('source', '')
        assertStructurallySame(plain.read(''), { source: '' })
        assertEq(plain.restore({ source: 'new' }), 'new')
        const text = textSharing('source', 'first', [['First', 'first', 'first'], ['Second', 'second', 'second']])
        assertStructurallySame(encodeQuery(text, text.read('second')), ['ok', '?example=second#demo'])
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
        const html = htmlToString(sharingStatus())
        assert(html.includes('data-demo-link-status=""'))
        assert(html.includes('hidden=""'))
        assert(html.includes('role="status"'))
        assert(htmlToString(earlyInputCapture).includes('data-demo-input-edited'))
    },
}
