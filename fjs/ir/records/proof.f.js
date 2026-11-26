/**
 * Proofs of the records pass: hand-written plain IR, the same IR again
 * where an object that a function builds is only read back by its keys,
 * as text, and the same text where something else keeps the object.
 *
 * @import { Fn, Term } from '../types.ts'
 */

import { assertEq, assertOk } from '../../asserts/module.f.js'
import { any, string } from '../l0/module.f.js'
import { add, block, bool, br, call, call_ref, codeOf, constant, f64, field, fn, get, if_, let_, lit, loop, make, match, n, next, only, trap, trunc_sat, u, variant } from '../module.f.js'
import { checkPlain } from '../check/module.f.js'
import { print } from '../print/module.f.js'
import { records as l0 } from '../testlib.f.js'
import { records } from './module.f.js'

/** A string literal. @type {(s: string) => Term} */
const s = v => lit(string, v)

/** The calls that the lowering writes to build an object of these keys and values, before `seal`. @type {(pairs: readonly (readonly [string, Term])[]) => Term} */
const pushes = pairs => pairs.reduce((b, [k, x]) => call('Containers', 'push_property', [b, s(k), x]), call('Containers', 'begin_object', [n(BigInt(pairs.length))]))

/** An object of these keys and values, as the lowering builds one. @type {(pairs: readonly (readonly [string, Term])[]) => Term} */
const object = pairs => match(call('Containers', 'seal', [pushes(pairs)]), [[['object'], 'o', get('o')], [null, null, trap('not object')]])

/** A read of a key by the module's own `get`. @type {(x: Term, key: string) => Term} */
const read = (x, key) => call('self', 'get', [x, s(key)])

/** Something that does something. @type {(x: Term) => Term} */
const effect = x => call('Any', 'effect', [x])

/** A function of `any`s. @type {(body: Term) => Fn} */
const f_ = body => fn([['a', any], ['b', any], ['c', any]], any, body)

/** The text of a function after the pass. @type {(body: Term) => string} */
const after = body => print({ imports: [], functions: records('get')({ imports: [], functions: [['f', f_(body)]], exports: [] }).functions, exports: [] })

/** The pass writes the function as this text. @type {(body: Term, lines: readonly string[]) => void} */
const golden = (body, lines) => assertEq(after(body), lines.map(line => `${line}\n`).join(''))

/** The pass leaves the function as it is. @type {(body: Term) => void} */
const same = body => assertEq(after(body), print({ imports: [], functions: [['f', f_(body)]], exports: [] }))

const a = get('a')
const b = get('b')
const c = get('c')

export const proof = {
    splitLet: () => golden(
        let_('r', object([['x', a], ['y', b]]), read(get('r'), 'y')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    let r.y = b',
            '    r.y',
        ],
    ),
    direct: () => golden(
        read(object([['x', a]]), 'x'),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    a',
        ],
    ),
    impure: () => golden(
        let_('r', object([['x', a], ['y', effect(b)]]), read(get('r'), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    let r.y =',
            '        block W: any',
            '            Any.effect(b)',
            '    r.x',
        ],
    ),
    missing: () => same(let_('r', object([['x', a]]), read(get('r'), 'z'))),
    arms: () => golden(
        read(if_(c, object([['x', a]]), object([['x', b]])), 'x'),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    if c then a else b',
        ],
    ),
    armBinder: () => golden(
        read(match(c, [[['object'], 'q', object([['x', get('q')]])], [null, null, object([['x', b]])]]), 'x'),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    match c',
            '      object as q =>',
            '        block W: any',
            '            q',
            '      else =>',
            '        b',
        ],
    ),
    chainSplit: () => golden(
        let_('s', let_('t', object([['a', a]]), object([['p', read(get('t'), 'a')]])), read(get('s'), 'p')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let s/t.a = a',
            '    let s.p =',
            '        block W: any',
            '            s/t.a',
            '    s.p',
        ],
    ),
    chainKept: () => golden(
        let_('s', let_('t', effect(a), object([['p', get('t')]])), read(get('s'), 'p')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let s/t = Any.effect(a)',
            '    let s.p =',
            '        block W: any',
            '            s/t',
            '    s.p',
        ],
    ),
    alias: () => golden(
        let_('r', object([['x', a]]), let_('q', get('r'), read(get('q'), 'x'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    let q.x =',
            '        block W: any',
            '            r.x',
            '    q.x',
        ],
    ),
    param: () => same(read(a, 'x')),
    free: () => same(read(get('zz'), 'x')),
    loopSplit: () => golden(
        loop('L', [['s', any, object([['i', a], ['acc', b]])]], s_ => if_(read(s_, 'i'), next('L', [['s', object([['i', read(s_, 'acc')], ['acc', read(s_, 'i')]])]]), read(s_, 'acc'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (s.i: any = a, s.acc: any = b)',
            '        if s.i then br L { s.i: s.acc, s.acc: s.i } else s.acc',
        ],
    ),
    loopReorder: () => same(loop('L', [['s', any, object([['i', a], ['acc', b]])]], s_ => if_(read(s_, 'i'), next('L', [['s', object([['acc', read(s_, 'i')], ['i', read(s_, 'acc')]])]]), read(s_, 'acc')))),
    loopTwo: () => golden(
        loop('L', [['s', any, object([['i', a]])], ['k', any, effect(b)]], (s_, k) => if_(read(s_, 'i'), next('L', [['s', object([['i', k]])], ['k', k]]), read(s_, 'i'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (s.i: any = a, k: any = Any.effect(b))',
            '        if s.i then br L { s.i: k, k: k } else s.i',
        ],
    ),
    loopTwoPure: () => golden(
        loop('L', [['s', any, object([['i', a]])], ['k', any, b]], (s_, k) => if_(read(s_, 'i'), next('L', [['k', effect(k)], ['s', object([['i', k]])]]), read(s_, 'i'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (s.i: any = a, k: any = b)',
            '        if s.i then br L { k: Any.effect(k), s.i: k } else s.i',
        ],
    ),
    loopKeep: () => same(loop('L', [['s', any, object([['i', a]])], ['k', any, b]], (s_, k) => if_(read(s_, 'i'), next('L', [['s', object([['i', k]])], ['k', k]]), s_))),
    loopValue: () => same(let_('r', loop('L', [['s', any, object([['i', a]])]], s_ => s_), read(get('r'), 'i'))),
    brOther: () => same(block('B', any, br('B', object([['x', a]])))),
    brNotMake: () => same(loop('L', [['s', any, object([['i', a]])]], s_ => if_(read(s_, 'i'), br('L', get('m')), read(s_, 'i')))),
    brField: () => golden(
        loop('L', [['s', any, object([['i', a]])]], s_ => if_(read(s_, 'i'), next('L', [['s', object([['i', a]])], ['zz', object([['j', a]])]]), read(s_, 'i'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (s.i: any = a)',
            '        if s.i',
            '        then',
            '            br L',
            '                {',
            '                    s.i: a,',
            '                    zz:',
            '                        match Containers.seal(Containers.push_property(Containers.begin_object(1), "j", a))',
            '                          object as o =>',
            '                            o',
            '                          else =>',
            "                            trap('not object')",
            '                }',
            '        else',
            '            s.i',
        ],
    ),
    opaqueDef: () => same(let_('r', effect(a), read(get('r'), 'x'))),
    terms: () => golden(
        let_('r', object([['x', a], ['y', b]]), make([
        ['o', trunc_sat(u(8), read(get('r'), 'x'))], ['p', add(read(get('r'), 'y'), lit(f64, 1))], ['q', call_ref(codeOf('g'), [read(get('r'), 'x')])],
        ['f', field(make([['k', read(get('r'), 'y')]]), 'k')], ['v', variant(any, 'v', read(get('r'), 'x'))], ['c', constant('self', 'k')], ['t', trap('t')],
        ['b', block('B', any, read(get('r'), 'x'))], ['m', match(read(get('r'), 'y'), [[null, 'w', get('w')]])],
      ])),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    let r.y = b',
            '    {',
            '        o: trunc_sat(u(8), r.x),',
            '        p: add(r.y, 1.0 as f64),',
            '        q: call_ref(code(g), r.x),',
            '        f: { k: r.y }.k,',
            '        v: v(r.x),',
            '        c: self.k,',
            "        t: trap('t'),",
            '        b:',
            '            block B: any',
            '                r.x,',
            '        m:',
            '            match r.y',
            '              else as w =>',
            '                w',
            '    }',
        ],
    ),
    kept: () => same(let_('r', object([['x', a]]), object([['k', read(get('r'), 'x')], ['all', object([['x', get('r')]])]]))),
    directImpure: () => same(read(object([['x', a], ['y', effect(b)]]), 'x')),
    // A string literal is any.only(string); get answers any, so a block widens it.
    stringLit: () => golden(
        let_('r', object([['x', s('hi')]]), read(get('r'), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x =',
            '        block W: any',
            '            "hi"',
            '    r.x',
        ],
    ),
    stringLitDirect: () => golden(
        read(object([['x', s('hi')]]), 'x'),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    block W: any',
            '        "hi"',
        ],
    ),
    // A value that is already a block of full any is not wrapped again.
    alreadyAnyBlock: () => golden(
        let_('r', object([['x', block('B', any, s('hi'))]]), read(get('r'), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x =',
            '        block B: any',
            '            "hi"',
            '    r.x',
        ],
    ),
    // A non-literal string-typed value (if of two string lits) also widens,
    // so a later match may still name number (get would have answered any).
    stringIf: () => {
        const body = let_('r', object([['x', if_(c, s('a'), s('b'))]]), match(read(get('r'), 'x'), [[['number'], 'n', get('n')], [null, null, a]]))
        const f = fn([['a', any], ['b', any], ['c', bool]], any, body)
        const afterF = records('get')({ imports: [], functions: [['f', f]], exports: [] }).functions[0][1]
        assertEq(print({ imports: [], functions: [['f', afterF]], exports: [] }), [
            'fn f(a: any, b: any, c: bool) -> any =',
            '    let r.x =',
            '        block W: any',
            '            if c then "a" else "b"',
            '    match r.x',
            '      number as n =>',
            '        n',
            '      else =>',
            '        a',
        ].map(line => `${line}\n`).join(''))
        assertOk(checkPlain({
            imports: l0.imports,
            functions: [...l0.functions.filter(([k]) => k !== 'f'), ['f', afterF]],
            exports: ['f'],
        }))
    },
    // An open label W forces the widen block onto W_.
    stringLitInBlockW: () => golden(
        block('W', any, read(object([['x', s('hi')]]), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    block W: any',
            '        block W_: any',
            '            "hi"',
        ],
    ),
    stringLitInLoopW: () => golden(
        loop('W', [['i', any, a]], () => read(object([['x', s('hi')]]), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop W (i: any = a)',
            '        block W_: any',
            '            "hi"',
        ],
    ),
    // A br target with no local declaration still reserves the label, so the
    // widen block does not capture the branch.
    brWidenTarget: () => golden(
        let_('r', object([['x', br('W', a)]]), read(get('r'), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x =',
            '        block W_: any',
            '            br W a',
            '    r.x',
        ],
    ),
    // Disjoint if arms may each bind r.x; claims do not collide across arms.
    disjointArms: () => golden(
        if_(c, let_('r', object([['x', a]]), read(get('r'), 'x')), let_('r', object([['x', b]]), read(get('r'), 'x'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    if c',
            '    then',
            '        let r.x = a',
            '        r.x',
            '    else',
            '        let r.x = b',
            '        r.x',
        ],
    ),
    loopBad: () => same(loop('L', [['s', any, object([['i', effect(a)]])], ['k', any, effect(b)]], (s_, k) => if_(read(s_, 'i'), next('L', [['s', object([['i', k]])], ['k', k]]), read(s_, 'i')))),
    brBad: () => same(loop('L', [['s', any, object([['i', a]])], ['k', any, b]], (s_, k) => if_(read(s_, 'i'), next('L', [['s', object([['i', effect(k)]])], ['k', effect(k)]]), read(s_, 'i')))),
    notPushed: () => same(let_('r', match(call('Containers', 'seal', [get('m')]), [[['object'], 'o', get('o')], [null, null, trap('not object')]]), read(get('r'), 'x'))),
    otherModule: () => same(let_('r', match(call('Containers', 'seal', [call('Any', 'push_property', [pushes([]), s('x'), a])]), [[['object'], 'o', get('o')], [null, null, trap('not object')]]), read(get('r'), 'x'))),
    count: () => same(let_('r', match(call('Containers', 'seal', [call('Containers', 'push_property', [call('Containers', 'begin_object', [n(2n)]), s('x'), a])]), [[['object'], 'o', get('o')], [null, null, trap('not object')]]), read(get('r'), 'x'))),
    otherCall: () => same(let_('r', match(call('Containers', 'seal', [call('Containers', 'push_item', [pushes([]), a])]), [[['object'], 'o', get('o')], [null, null, trap('not object')]]), read(get('r'), 'x'))),
    keyed: () => same(let_('r', match(call('Containers', 'seal', [call('Containers', 'push_property', [pushes([]), b, a])]), [[['object'], 'o', get('o')], [null, null, trap('not object')]]), read(get('r'), 'x'))),
    twice: () => same(let_('r', object([['x', a], ['x', b]]), read(get('r'), 'x'))),
    readKey: () => same(let_('r', object([['x', a]]), call('self', 'get', [get('r'), b]))),
    chosen: () => same(let_('r', if_(c, object([['x', a]]), match(b, [[null, 'w', object([['x', get('w')]])]])), read(get('r'), 'x'))),
    unknownLabel: () => golden(
        let_('r', object([['x', a]]), make([['x', read(get('r'), 'x')], ['z', br('Z', make([['k', a]]))], ['zz', get('zz')]])),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    { x: r.x, z: br Z { k: a }, zz: zz }',
        ],
    ),
    brPlain: () => golden(
        let_('r', object([['x', a]]), make([['x', read(get('r'), 'x')], ['l', loop('L', [['s', any, a]], () => br('L', get('m')))], ['b', block('B', any, br('B', a))]])),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    {',
            '        x: r.x,',
            '        l:',
            '            loop L (s: any = a)',
            '                br L m,',
            '        b:',
            '            block B: any',
            '                br B a',
            '    }',
        ],
    ),
    dotted: () => golden(
        let_('r', object([['p', object([['q', a]])], ['p.q', b], ['s/\\', c]]), make([['x', read(read(get('r'), 'p'), 'q')], ['y', read(get('r'), 'p.q')], ['z', read(get('r'), 's/\\')]])),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.p.q = a',
            '    let r.p\\.q = b',
            '    let r.s\\/\\\\ = c',
            '    { x: r.p.q, y: r.p\\.q, z: r.s\\/\\\\ }',
        ],
    ),
    // Cast-style binders no longer block an unrelated object: the pass still
    // splits, and only a generated name that reuses an existing binder keeps
    // the object (collide below).
    reservedLet: () => golden(
        let_('r.x', a, read(object([['x', get('r.x')]]), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    block W: any',
            '        r.x',
        ],
    ),
    reservedLoop: () => golden(
        loop('L', [['s/', any, a]], () => read(object([['x', a]]), 'x')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (s/: any = a)',
            '        a',
        ],
    ),
    reservedArm: () => golden(
        match(c, [[null, 'w\\', read(object([['x', a]]), 'x')]]),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    match c',
            '      else as w\\ =>',
            '        a',
        ],
    ),
    collide: () => same(let_('r.x', b, let_('r', object([['x', a]]), read(get('r'), 'x')))),
    // Two origins that escape to the same spelling (`r`+`x.y` and `r.x\`+`y`
    // both want `r.x\.y`): keep both objects.
    collideGenerated: () => same(let_('r.x\\', object([['y', b]]), let_('r', object([['x.y', a]]), make([
        ['first', read(get('r'), 'x.y')],
        ['second', read(get('r.x\\'), 'y')],
    ])))),
    // Outer `r`+`x.y` around a match arm with `r.x\`+`y`: part binders are
    // claimed before the body, so the arm collision still refuses (does not
    // emit nested `r.x\.y` twice).
    collideArmGenerated: () => same(let_('r', object([['x.y', a]]), match(c, [
        [['true'], null, let_('r.x\\', object([['y', b]]), make([
            ['first', read(get('r'), 'x.y')],
            ['second', read(get('r.x\\'), 'y')],
        ]))],
        [['false'], null, a],
    ]))),
    // Loop parameter `s`+`x.y` vs arm `s.x\`+`y`: claim params before the body.
    collideLoopArmGenerated: () => same(loop('L', [['s', any, object([['x.y', a]])]], s_ => match(c, [
        [['true'], null, let_('s.x\\', object([['y', b]]), make([
            ['first', read(s_, 'x.y')],
            ['second', read(get('s.x\\'), 'y')],
        ]))],
        [['false'], null, next('L', [['s', object([['x.y', a]])]])],
    ]))),
    // A user-authored block B around a site is not peeled: br B stays inside.
    userBlockSite: () => same(let_('r', block('B', any, object([['x', match(c, [
        [['true'], null, br('B', a)],
        [['false'], null, b],
    ])]])), read(get('r'), 'x'))),
    // Ownership is not the W spelling: a user-authored block W must not be
    // peeled even though the pass prefers that label for widen blocks.
    userWidenLabelSite: () => same(let_('r', block('W', any, object([['x', match(c, [
        [['true'], null, br('W', a)],
        [['false'], null, b],
    ])]])), read(get('r'), 'x'))),
    // Nested widens in one rewrite: inner string lit needs a block W; outer
    // if wraps with W_ so checkPlain does not see W inside W.
    nestedWiden: () => {
        const body = let_('r', object([['x', if_(c, read(object([['y', s('hi')]]), 'y'), b)]]), read(get('r'), 'x'))
        const f = fn([['a', any], ['b', any], ['c', bool]], any, body)
        const afterF = records('get')({ imports: [], functions: [['f', f]], exports: [] }).functions[0][1]
        assertEq(print({ imports: [], functions: [['f', afterF]], exports: [] }), [
            'fn f(a: any, b: any, c: bool) -> any =',
            '    let r.x =',
            '        block W_: any',
            '            if c',
            '            then',
            '                block W: any',
            '                    "hi"',
            '            else',
            '                b',
            '    r.x',
        ].map(line => `${line}\n`).join(''))
        assertOk(checkPlain({
            imports: l0.imports,
            functions: [...l0.functions.filter(([k]) => k !== 'f'), ['f', afterF]],
            exports: ['f'],
        }))
    },
    // Sibling product fields each bind r.x in their own expression scope;
    // claims do not collide across fields.
    siblingFields: () => golden(
        make([
            ['first', let_('r', object([['x', a]]), read(get('r'), 'x'))],
            ['second', let_('r', object([['x', b]]), read(get('r'), 'x'))],
        ]),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    {',
            '        first:',
            '            let r.x = a',
            '            r.x,',
            '        second:',
            '            let r.x = b',
            '            r.x',
            '    }',
        ],
    ),
    // Sibling call arguments likewise isolate claims.
    siblingArgs: () => golden(
        call('Any', 'pair', [
            let_('r', object([['x', a]]), read(get('r'), 'x')),
            let_('r', object([['x', b]]), read(get('r'), 'x')),
        ]),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    Any.pair(',
            '        let r.x = a',
            '        r.x,',
            '        let r.x = b',
            '        r.x',
            '    )',
        ],
    ),
    // Non-split let: initializer and body each bind r.x; body starts from
    // parent claims so they do not false-collide.
    letInitClaims: () => golden(
        let_('u', let_('r', object([['x', a]]), read(get('r'), 'x')), let_('r', object([['x', b]]), read(get('r'), 'x'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let u =',
            '        let r.x = a',
            '        r.x',
            '    let r.x = b',
            '    r.x',
        ],
    ),
    // Match operand and an arm each bind r.x; arms start from parent claims.
    matchOperandClaims: () => golden(
        match(let_('r', object([['x', a]]), read(get('r'), 'x')), [
            [['true'], null, let_('r', object([['x', b]]), read(get('r'), 'x'))],
            [null, null, c],
        ]),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    match',
            '        let r.x = a',
            '        r.x',
            '      true =>',
            '        let r.x = b',
            '        r.x',
            '      else =>',
            '        c',
        ],
    ),
    // Non-split loop initializer and body each bind r.x; init does not see
    // the body's claims.
    loopInitClaims: () => golden(
        loop('L', [['k', any, let_('r', object([['x', a]]), read(get('r'), 'x'))]], () => let_('r', object([['x', b]]), read(get('r'), 'x'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (',
            '        k: any =',
            '            let r.x = a',
            '            r.x',
            '    )',
            '        let r.x = b',
            '        r.x',
        ],
    ),
    // Sibling non-split loop initializers each bind r.x; claims do not collide.
    loopSiblingInits: () => golden(
        loop('L', [
            ['k', any, let_('r', object([['x', a]]), read(get('r'), 'x'))],
            ['m', any, let_('r', object([['x', b]]), read(get('r'), 'x'))],
        ], (k, m) => if_(k, next('L', [['k', k], ['m', m]]), m)),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (',
            '        k: any =',
            '            let r.x = a',
            '            r.x,',
            '        m: any =',
            '            let r.x = b',
            '            r.x',
            '    )',
            '        if k then br L { k: k, m: m } else m',
        ],
    ),
    // Split loop param `s` claims `s.x` for the body; an initializer-local
    // `s` that also splits to `s.x` must not see that claim (params are not
    // in scope in their initializers).
    loopInitPartClaims: () => golden(
        loop('L', [['s', any, object([['x', let_('s', object([['x', a]]), read(get('s'), 'x'))]])]], s_ => if_(read(s_, 'x'), next('L', [['s', object([['x', b]])]]), read(s_, 'x'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    loop L (',
            '        s.x: any =',
            '            let s.x = a',
            '            s.x',
            '    )',
            '        if s.x then br L { s.x: b } else s.x',
        ],
    ),
    // Initial and br both write `let t` under split local `s`: claiming
    // `s/t` (and `s.x` as both a let and a loop parameter) twice would bind
    // them in nested scopes, so the objects stay.
    loopChain: () => same(
        let_('s', let_('t', a, object([['x', get('t')]])), loop('L', [['s', any, get('s')]], () => br('L', make([['s', let_('t', b, object([['x', get('t')]]))]])))),
    ),
    // Same shape with a cast binder present: still refuses, does not emit
    // checkPlain-invalid nested `s/t` / `s.x` bindings.
    loopChainDotted: () => same(
        let_('p0.string', a, let_('s', let_('t', a, object([['x', get('t')]])), loop('L', [['s', any, get('s')]], () => br('L', make([['s', let_('t', b, object([['x', get('t')]]))]]))))),
    ),
    castBinderSplit: () => golden(
        let_('p0.string', a, let_('r', object([['x', b]]), read(get('r'), 'x'))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let p0.string = a',
            '    let r.x = b',
            '    r.x',
        ],
    ),
    aliased: () => golden(
        let_('r', object([['x', a]]), let_('v', read(get('r'), 'x'), let_('w', get('b'), make([['v', get('v')], ['w', get('w')]])))),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.x = a',
            '    let w = b',
            '    { v: r.x, w: w }',
        ],
    ),
    nested: () => golden(
        let_('r', object([['p', object([['q', a]])], ['k', b]]), read(read(get('r'), 'p'), 'q')),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.p.q = a',
            '    let r.k = b',
            '    r.p.q',
        ],
    ),
    // Outer get's argument is a `let` that yields the nested field (as
    // from_fast lowers `r.p.q`): round one wraps the nested site as
    // `block W: #0`, round two must still see through that widen and split.
    nestedViaLet: () => golden(
        read(let_('r', object([['p', object([['q', a]])], ['k', b]]), read(get('r'), 'p')), 'q'),
        [
            'fn f(a: any, b: any, c: any) -> any =',
            '    let r.p.q = a',
            '    let r.k = b',
            '    r.p.q',
        ],
    ),
    // A narrowed parameter standing in for get must widen to full any, so a
    // later number arm still type-checks (get would have answered any).
    typedLocal: () => {
        const body = let_('r', object([['x', get('v')]]), match(read(get('r'), 'x'), [[['number'], 'k', get('k')], [null, null, get('n')]]))
        const f = fn([['v', only(any, 'string')], ['n', any]], any, body)
        const afterF = records('get')({ imports: [], functions: [['f', f]], exports: [] }).functions[0][1]
        assertEq(print({ imports: [], functions: [['f', afterF]], exports: [] }), [
            'fn f(v: any.only(string), n: any) -> any =',
            '    let r.x =',
            '        block W: any',
            '            v',
            '    match r.x',
            '      number as k =>',
            '        k',
            '      else =>',
            '        n',
        ].map(line => `${line}\n`).join(''))
        assertOk(checkPlain({
            imports: l0.imports,
            functions: [...l0.functions.filter(([k]) => k !== 'f'), ['f', afterF]],
            exports: ['f'],
        }))
    },
    // A nested object site substituted for get is kind object; widen it so a
    // number arm still type-checks, while a later round can still split it
    // (see nested above).
    nestedObjectMatch: () => {
        const body = let_('r', object([['x', object([['y', a]])]]), match(read(get('r'), 'x'), [[['number'], 'k', get('k')], [null, null, get('n')]]))
        const f = fn([['a', any], ['n', any]], any, body)
        const afterF = records('get')({ imports: [], functions: [['f', f]], exports: [] }).functions[0][1]
        assertEq(print({ imports: [], functions: [['f', afterF]], exports: [] }), [
            'fn f(a: any, n: any) -> any =',
            '    let r.x =',
            '        block W: any',
            '            match Containers.seal(Containers.push_property(Containers.begin_object(1), "y", a))',
            '              object as o =>',
            '                o',
            '              else =>',
            "                trap('not object')",
            '    match r.x',
            '      number as k =>',
            '        k',
            '      else =>',
            '        n',
        ].map(line => `${line}\n`).join(''))
        assertOk(checkPlain({
            imports: l0.imports,
            functions: [...l0.functions.filter(([k]) => k !== 'f'), ['f', afterF]],
            exports: ['f'],
        }))
    },
}
