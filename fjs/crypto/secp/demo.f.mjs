/**
 * Elliptic Curve Playground: discrete prime-field arithmetic, a separate
 * real-number geometric analogy, and client-side named-curve public keys.
 * A graph beside controls departs from the usual linear demo layout so inputs
 * and geometric constructions can be compared directly; mobile retains linear order.
 * @module
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Point, Point2D } from './types.ts'
 * @import { State, RealPoint, Construction } from '../../website/demo/secp/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { inputField, caption, refusal } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { toy, points, pointText, pointOf, scalar, sequence, modularLine, addition, negative, realPoint, construction, namedCurves, publicKey } from '../../website/demo/secp/module.f.mjs'

/** @type {(name: string, label: string, options: readonly string[], value: string) => Element} */
const select = (name, label, options, value) => ['p', ['label', { for: `secp-${name}` }, `${label} `],
    ['select', { id: `secp-${name}`, name }, ...options.map(/** @returns {Element} */ o => ['option', { value: o, ...(o === value ? { selected: '' } : {}) }, o])]]

/** Two choices stay visible, with native radio-group keyboard behavior.
 * @type {(name: string, label: string, options: readonly { readonly value: string, readonly label: string }[], value: string) => Element}
 */
const radios = (name, label, options, value) => ['fieldset', { 'data-secp-radios': '' },
    ['legend', label],
    ['div', ...options.map(/** @returns {Element} */ option => ['label', { for: `secp-${name}-${option.value}` },
        ['input', { type: 'radio', id: `secp-${name}-${option.value}`, name, value: option.value, ...(option.value === value ? { checked: '' } : {}) }],
        option.label,
    ])],
]

/** @type {(name: string, label: string, disabled?: boolean) => Element} */
const button = (name, label, disabled = false) => ['button', { type: 'button', name, ...(disabled ? { disabled: '' } : {}) }, label]

/** @type {(p: Point2D) => string} */
const pointValue = p => `${p[0]},${p[1]}`
const pointOptions = /** @type {const} */ (['O', ...points.map(pointValue)])

/** @type {(text: string) => Element} */
const paragraph = text => ['p', text]

/** @type {(text: string) => Element} */
const pre = text => ['pre', text]

/** @type {(name: string, label: string, value: string) => Element} */
const pointSelect = (name, label, value) => ['p', ['label', { for: `secp-${name}` }, `${label} `],
    ['select', { id: `secp-${name}`, name }, ...pointOptions.map(/** @returns {Element} */ o => ['option', { value: o, ...(value === o ? { selected: '' } : {}) }, pointText(pointOf(o) ?? null)])]]

/** @type {(state: State, event: DemoEvent) => State} */
export const transition = (state, event) => {
    if (event.kind === 'start') { return state }
    if (event.kind === 'input') {
        const { name, value } = event
        if (name === 'view') { return { ...state, view: value } }
        if (name === 'operation') { return { ...state, operation: value } }
        if (name === 'k') { return { ...state, k: value } }
        if (name === 'p' || name === 'q') { return { ...state, [name]: value } }
        if (name === 'target') { return { ...state, target: value } }
        if (name === 'realP' || name === 'realQ' || name === 'branchP' || name === 'branchQ') { return { ...state, [name]: value } }
        if (name === 'curve' || name === 'privateKey') { return { ...state, [name]: value, generated: null } }
        return state
    }
    const { name } = event
    if (name === 'generate') {
        const result = publicKey(state.curve, state.privateKey)
        return { ...state, generated: result[0] === 'ok' ? result[1] : null }
    }
    if (name.startsWith('point:')) {
        const value = name.slice(6)
        return pointOf(value) === undefined ? state : { ...state, [state.target === 'Q' ? 'q' : 'p']: value }
    }
    return state
}

/** @type {(p: Point, label: string, role: string) => readonly Element[]} */
const finiteMark = (p, label, role) => p === null ? [] : [
    ['circle', { cx: String(40 + Number(p[0]) * 20), cy: String(480 - Number(p[1]) * 20), r: '9', 'data-secp-point': role, 'pointer-events': 'none', fill: 'none', 'stroke-width': '3' }],
    ['text', { x: String(51 + Number(p[0]) * 20), y: String(475 - Number(p[1]) * 20), 'data-secp-label': role, 'pointer-events': 'none' }, label],
]

/** SVG buttons have textual, keyboard and native select equivalents.
 * @type {(state: State, p: Point, q: Point, result: Point, third: Point, line: readonly Point2D[]) => Element}
 */
const finiteGraph = (state, p, q, result, third, line) => ['svg', { viewBox: '0 0 530 530', 'data-secp-graph': '', role: 'group', 'aria-label': 'Finite field grid: y² = x³ + x + 4 modulo 23' },
    ['title', 'Discrete points over F₂₃; no continuous curve or Euclidean secants'],
    ...Array.from({ length: 23 }, /** @returns {Element} */ (_, i) => ['g',
        ['path', { d: `M${40 + i * 20} 40V480M40 ${480 - i * 20}H480`, 'data-secp-grid': '', fill: 'none' }],
        ['text', { x: String(40 + i * 20), y: '502', 'text-anchor': 'middle' }, String(i)],
        ['text', { x: '25', y: String(484 - i * 20), 'text-anchor': 'end' }, String(i)],
    ]),
    ['text', { x: '505', y: '485' }, 'X'], ['text', { x: '30', y: '25' }, 'Y'],
    ...line.map(/** @returns {Element} */ ([x, y]) => ['rect', { x: String(36 + Number(x) * 20), y: String(476 - Number(y) * 20), width: '8', height: '8', 'data-secp-modular-line': '', 'pointer-events': 'none' }]),
    ...points.map(/** @returns {Element} */ ([x, y]) => ['circle', {
        cx: String(40 + Number(x) * 20), cy: String(480 - Number(y) * 20), r: '7',
        'data-demo-click': `point:${x},${y}`, tabindex: '0', role: 'button',
        'aria-label': `Select ${state.target} = (${x}, ${y})`, 'data-secp-dot': '',
    }, ['title', `(${x}, ${y})`]]),
    ...(state.operation === 'kG' ? finiteMark(toy.g, 'G', 'base') : finiteMark(p, 'P', 'input')), ...finiteMark(q, 'Q', 'base'),
    ...finiteMark(third, 'S', 'third'), ...finiteMark(result, state.operation === 'kG' ? 'kG' : state.operation === '−P' ? '−P' : 'R', 'result'),
]

/** @type {(state: State) => Element} */
const finiteView = state => {
    const p = pointOf(state.p)
    const q = pointOf(state.q)
    const k = scalar(state.k, 29n)
    if (p === undefined || q === undefined) { return ['div', refusal('Select a point on the curve or O.')] }
    const frames = k[0] === 'ok' ? sequence(k[1]) : []
    const multiplication = state.operation === 'kG'
    const calculation = state.operation === '−P' ? negative(p)
        : state.operation === '2P' ? addition(p, p)
            : multiplication ? addition(frames[Math.max(0, frames.length - 2)] ?? null, frames.length > 1 ? toy.g : null)
                : addition(p, q)
    const shownP = multiplication ? toy.g : p
    const shownQ = state.operation === 'P + Q' ? q : null
    const chordQ = state.operation === '2P' ? p : shownQ
    const line = chordQ === null ? [] : modularLine(shownP, chordQ)
    const third = line.length === 0 ? null : negative(calculation.result).result
    return ['div',
        ['p', 'y² = x³ + x + 4 mod 23 · p = 23 · a = 1 · b = 4 · G = (0, 2) · n = 29'],
        ['p', 'These are discrete field elements. A smooth curve or ordinary secant would be misleading here.'],
        ['div', { 'data-secp-layout': '' },
            ['div', finiteGraph(state, shownP, shownQ, calculation.result, third, line),
                ['p', 'Legend: orange squares (modular line), P (orange), Q/G (purple), S (fuchsia), result (blue). O has no XY coordinates.']],
            ['div',
                select('operation', 'Operation', ['kG', 'P + Q', '2P', '−P'], state.operation),
                ...(multiplication ? [inputField({ name: 'k', label: 'Scalar k (decimal, 0–29)' }, state.k)] : [
                    pointSelect('p', 'Point P', state.p),
                    ...(state.operation === 'P + Q' ? [pointSelect('q', 'Point Q', state.q), radios('target', 'Graph click sets', [{ value: 'P', label: 'P' }, { value: 'Q', label: 'Q' }], state.target)] : []),
                ]),
                ...(multiplication && k[0] === 'error' ? [refusal(k[1])] : [
                    caption(multiplication ? `Public key Q = ${state.k}G:` : 'Result:'),
                    codeBlock(pointText(calculation.result), 'Copy result'),
                    paragraph(multiplication
                        ? 'The grid shows G and kG. Show Math lists the repeated additions; production multiplication can use faster algorithms such as double-and-add.'
                        : line.length === 0 ? `The result is ${pointText(calculation.result)}.`
                            : 'The squares satisfy the modular secant or tangent equation. S is the third curve intersection, and R = −S.'),
                ]),
            ],
        ],
        ['details', ['summary', 'Show Math'],
            ['p', 'A modular inverse of t is a number u with t·u mod p = 1. Multiplication by u replaces division by t. Zero has no inverse.'],
            ...(multiplication && k[0] === 'error' ? [] : [
                pre(calculation.lines.join('\n')),
                ...(multiplication ? [paragraph(state.k === '0' ? '0G = O (identity).' : `${state.k}G = ${pointText(calculation.result)}. 29G = O because G has order 29.`),
                    pre(frames.map((p, i) => `${i}G = ${pointText(p)}`).join('\n'))] : []),
            ]),
        ],
    ]
}

/** @type {(p: RealPoint) => readonly [string, string]} */
const realXY = ([x, y]) => [String(40 + (x + 1.5) * 88), String(260 - y * 44)]

/** @type {(p: RealPoint, label: string, role: string, drag?: string) => readonly Element[]} */
const realMark = (p, label, role, drag) => {
    const [cx, cy] = realXY(p)
    return [
        ['circle', { cx, cy, r: '8', 'data-secp-point': role, ...(drag === undefined ? {} : { 'data-demo-drag': drag }), 'aria-label': `${label} (${p[0]}, ${p[1]})` }, ['title', `${label} (${p[0].toFixed(3)}, ${p[1].toFixed(3)})`]],
        ['text', { x: String(Number(cx) + 12), y: String(Number(cy) - 12), 'data-secp-label': role }, label],
    ]
}

/** @type {(p: RealPoint) => boolean} */
const visible = ([x, y]) => x >= -1.5 && x <= 3.5 && y >= -5 && y <= 5

// The sampled interval is inside the real curve's domain.
const realSamples = Array.from({ length: 481 }, (_, i) => assertNotNullish(realPoint(-1.324 + i * 4.824 / 480, 1)))
/** @type {(branch: number) => string} */
const curvePath = branch => realSamples.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${realXY([x, branch * y]).join(' ')}`).join(' ')

/** @type {(operation: string, p: RealPoint, q: RealPoint, c: Construction) => Element} */
const realGraph = (operation, p, q, c) => ['svg', { viewBox: '0 0 530 530', 'data-secp-graph': '', 'data-demo-x-min': '-1.5', 'data-demo-x-max': '3.5', 'data-demo-x-left': '40', 'data-demo-x-right': '480', role: 'img', 'aria-label': 'Real-number curve, secant or tangent, third intersection and reflection' },
    ['title', 'Geometric analogy over the real numbers: y² = x³ − x + 1'],
    ['defs', ['clipPath', { id: 'secp-real-clip' }, ['rect', { x: '40', y: '40', width: '440', height: '440' }]]],
    ['g', { 'clip-path': 'url(#secp-real-clip)' },
        ...Array.from({ length: 11 }, /** @returns {Element} */ (_, i) => ['path', { d: `M40 ${40 + i * 44}H480`, 'data-secp-grid': '' }]),
        ['path', { d: 'M40 260H480M172 40V480', stroke: 'currentColor' }],
        ['path', { d: curvePath(1), 'data-secp-real-curve': '', fill: 'none' }],
        ['path', { d: curvePath(-1), 'data-secp-real-curve': '', fill: 'none' }],
        ...(c.kind !== 'refused' ? [c.kind === 'infinity'
            ? /** @type {Element} */ (['path', { d: `M${realXY(p)[0]} 40V480`, 'data-secp-line': '' }])
            : /** @type {Element} */ (['path', { d: `M${realXY([-1.5, c.slope * (-1.5 - p[0]) + p[1]]).join(' ')}L${realXY([3.5, c.slope * (3.5 - p[0]) + p[1]]).join(' ')}`, 'data-secp-line': '' }])] : []),
        ...(c.kind === 'finite' ? [...realMark(c.third, 'S', 'third'), /** @type {Element} */ (['path', { d: `M${realXY(c.third).join(' ')}L${realXY(c.result).join(' ')}`, 'data-secp-reflection': '' }]), ...realMark(c.result, 'R = −S', 'result')] : []),
        ...realMark(p, 'P', 'input', 'realP'),
        ...(operation === '2P' ? [] : realMark(q, 'Q', 'base', 'realQ')),
    ],
    ['text', { x: '486', y: '264' }, 'X'], ['text', { x: '176', y: '30' }, 'Y'],
    ...[-1, 0, 1, 2, 3].map(/** @returns {Element} */ x => ['text', { x: realXY([x, 0])[0], y: '500' }, String(x)]),
    ...[-4, -2, 0, 2, 4].map(/** @returns {Element} */ y => ['text', { x: '12', y: realXY([0, y])[1] }, String(y)]),
]

/** @type {(name: string, label: string, value: string) => Element} */
const range = (name, label, value) => ['p', ['label', { for: `secp-${name}` }, `${label}: ${value} `],
    ['input', { id: `secp-${name}`, name, type: 'range', min: '-1.324', max: '3.5', step: '0.001', value }]]

/** @type {(state: State) => Element} */
const geometricView = state => {
    const p = realPoint(Number(state.realP), Number(state.branchP))
    const q = state.operation === '2P' ? p : realPoint(Number(state.realQ), Number(state.branchQ))
    if (p === null || q === null) { return ['div', refusal('Select points on the real curve.')] }
    const c = construction(p, q)
    return ['div',
        ['p', 'y² = x³ − x + 1 over the real numbers. This geometric analogy uses a different field and curve from the finite-field toy example.'],
        ['div', { 'data-secp-layout': '' },
            ['div', realGraph(state.operation, p, q, c), ['p', 'Drag P/Q horizontally along their branch, or use the keyboard-accessible sliders. The complete construction updates immediately.']],
            ['div',
                select('operation', 'Construction', ['P + Q', '2P'], state.operation === '2P' ? '2P' : 'P + Q'),
                range('realP', 'P x', state.realP), radios('branchP', 'P branch', [{ value: '1', label: 'Upper' }, { value: '-1', label: 'Lower' }], state.branchP),
                ...(state.operation === '2P' ? [] : [range('realQ', 'Q x', state.realQ), radios('branchQ', 'Q branch', [{ value: '1', label: 'Upper' }, { value: '-1', label: 'Lower' }], state.branchQ)]),
                ['p', `P = (${p.map(v => v.toFixed(3)).join(', ')}), Q = (${q.map(v => v.toFixed(3)).join(', ')})`],
                ...(c.kind === 'refused' ? [refusal(c.message)] : c.kind === 'infinity' ? [paragraph('Vertical line: the result is O (point at infinity), with no XY coordinates.')]
                    : [caption('Sum R:'), paragraph(`(${c.result.map(v => v.toFixed(6)).join(', ')})`),
                        ...(!visible(c.result) || !visible(c.third) ? [paragraph('The third intersection and result are outside these graph bounds. Their coordinates are reported; the drawing is clipped.')] : [])]),
            ],
        ],
        ['details', ['summary', 'Show Math'],
            ['p', state.operation === '2P' ? 'Tangent slope m = (3x₁² − 1) / (2y₁)' : 'Secant slope m = (y₂ − y₁) / (x₂ − x₁)'],
            ...(c.kind === 'finite' ? [pre(`m = ${c.slope}\nx₃ = m² − ${p[0]} − ${q[0]} = ${c.result[0]}\nS = (${c.third.join(', ')})\nR = −S = (${c.result.join(', ')})`)] : [paragraph('A vertical line gives O; an unstable calculation is refused.')]),
        ],
    ]
}

/** @type {(state: State) => Element} */
const productionView = state => {
    const selected = namedCurves.find(c => c.name === state.curve)
    const validation = selected === undefined ? scalar('', 0n) : scalar(state.privateKey, selected.curve.nf.p - 1n)
    const valid = validation[0] === 'ok' && validation[1] > 0n && selected !== undefined
    return ['div',
        ['p', 'Private key d → Scalar multiplication dG → Public key Q'],
        ['p', 'Demo-only keys. Do not enter real wallet keys or private secrets. Computation stays in your browser.'],
        select('curve', 'Curve', namedCurves.map(c => c.name), state.curve),
        inputField({ name: 'privateKey', label: 'Demo private scalar d (decimal)' }, state.privateKey),
        ...(selected === undefined ? [refusal('Select a supported curve.')] : [paragraph(`Valid range: 1 ≤ d < n, where n = ${selected.curve.nf.p}.`)]),
        ...(!valid ? [refusal(validation[0] === 'error' ? validation[1] : 'The private scalar must satisfy 1 ≤ d < n.')] : []),
        button('generate', 'Generate Public Key', !valid),
        ...(state.generated === null ? [] : [caption('Public key Q = dG, hexadecimal (SEC 1 validated):'), codeBlock(state.generated, 'Copy public key')]),
        ['p', 'Production coordinates remain BigInt values. They are too large to plot as a full grid or safely convert to JavaScript Number.'],
    ]
}

/** @type {Demo<State, DemoEvent>} */
export const demo = {
    init: { view: 'Geometric View', operation: 'kG', k: '3', p: '4,7', q: '13,12', target: 'P', realP: '0', realQ: '1', branchP: '1', branchQ: '1', curve: 'secp256k1', privateKey: '3', generated: null },
    update: state => event => pureOk(transition(state, event)),
    view: state => ['div', { 'data-secp-playground': '' },
        caption('Elliptic Curve Playground'),
        ['p', 'Explore point addition, scalar multiplication, and public key generation.'],
        select('view', 'View', ['Geometric View', 'Finite Field View', 'Real Curves'], state.view),
        state.view === 'Real Curves' ? productionView(state) : state.view === 'Geometric View' ? geometricView(state) : finiteView(state),
        ['p', ['a', { href: 'https://github.com/functionalscript/functionalscript/blob/main/fjs/crypto/secp/README.md' }, 'Read the crypto/secp documentation']],
    ],
}
