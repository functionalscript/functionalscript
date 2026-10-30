/**
 * The operators the EDAG, FAST and the source AST share, as
 * [`graphOf`](../../website/demo/graph/module.f.mjs) shapes: one drawing
 * of them for every graph of the compiler's trees. The three spell an
 * operator with the same tuple — `fjs/js/ast/types.ts`'s `Operator<V>` —
 * except for the array and object tags, which a caller names in
 * {@link Tags}. Every form the vocabulary does not share is the caller's,
 * through the shape it passes for them.
 *
 * **It serves the compiler's stage pages**, as
 * [`stage_demo`](../stage_demo/module.f.mjs) does, and lives beside it: it
 * draws with the website's renderer and reads the parser's
 * `ResolvedModule`, which `fjs/js/ast` and `fjs/edag`, below the compiler
 * and the website, may not import.
 *
 * **A property read draws its key as a value.** `a.x` is a `.` node with
 * the receiver in its `obj` port and the key in its `key` port, `"x"`;
 * `a[5]` is the same `.` with the index in its `idx` port, `5`. A computed
 * index, `a[Number(i)]`, is an edge from `idx` to the node it is.
 *
 * **A method call is one node.** `o.f(x)` is a `.` carrying its call as a
 * continuation, `['.', o, 'f', ['|()', [x]]]`, not a `()` over a `.`: the
 * receiver stays live into the call rather than becoming a value of its
 * own, and a drawing with two nodes would show a value the tree never has.
 * So it draws as one node, **a table of its links**: a cell per link
 * holding its operator, beside that link's rows, each row a role and its
 * value or arrow, as every node's are. The `.` link has two, the receiver
 * in `obj` and the key `"f"` in `key`, as a plain `o.f` draws, and the `()`
 * link one, its arguments in `...`, an arrow to the array node they are
 * drawn as. A call's arguments are one node, as an array literal's items
 * are, rather than a port each: two calls in one chain would otherwise
 * both have a `0`. A plain call, `f(x)`, is the same one link, `callee` and
 * `...`. The node's label still spells the chain, `.f()`, and is what a
 * row of another node names it by.
 *
 * **An optional chain is one node too, and its region is on the edges.**
 * `a?.b.c?.(x)` is one `?.` node carrying its steps as its continuation —
 * `fjs/edag/README.md`, Chains — so it draws as one table: `?.` beside
 * `obj` and `key`, `.` beside `key`, `?.()` beside `...`. The first link
 * always takes two rows, receiver and key, as a plain `a.b` does; a guarded
 * call, `f?.(x)`, starts with `?.()` beside `callee` and `...`. A numbered
 * key is a value in its link's `idx` row and a computed one an arrow from
 * it. Everything after a `?.` is skipped when the value before it is
 * nullish, so those edges are broken: a guarded call's arguments and every
 * step's after it, and a guarded access's computed key. The receiver, a
 * plain method call's arguments and the arguments of a call whose
 * parentheses ended the region, `(a?.b)(x)`, run regardless and draw
 * solid; that call's link is `(?.)()`, since the parentheses are the one
 * thing that tells it from `a?.b(x)`.
 *
 * **An operand a node may never evaluate draws dashed**: both arms of `?:`,
 * which establishes its condition and then exactly one arm, and the chain
 * operands above. The mark is on the **edge** and not on the node it
 * reaches, because laziness is positional: a node reached from an eager
 * position elsewhere is evaluated there whatever reaches it here, and a
 * node is drawn once however many edges arrive.
 *
 * **A primitive draws inside the node that uses it**, a value in its
 * user's port beside the operand's role, and so does a leaf operator —
 * `entry`, `hasEntry`, an intrinsic or a static function — marked as the
 * terminal it is. Only a tree that is one of these and nothing else draws
 * one as a node, having no user to sit in.
 *
 * Reads a value by its runtime shape rather than its static type, so a
 * proof can hand it a tag no tree produces yet.
 *
 * **{@link fastGraph} draws a whole FAST module, and {@link sourceGraph}
 * the parser's resolved source**, each through this shape with its own
 * forms beside it: blocks, bindings, patterns, functions, conditionals,
 * loops and the exits that leave them.
 * [`fjs/compiler/sugar`](../sugar/demo.f.mjs) draws the two side
 * by side.
 *
 * @module
 *
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { Graph, Shape } from '../../website/demo/graph/types.ts'
 * @import { BindingId, Block, Exit, Function as AstFunction, Loop, Statement, Value } from '../../js/ast/types.ts'
 * @import { ExpansionPlan, Module, SourceBlock, SourceFunction, SourceLoop, SourceParameter } from '../../js/ast/sugar/types.ts'
 * @import { SourceCase, SourceSwitch } from '../../js/ast/sugar/source.ts'
 * @import { ResolvedModule } from '../parser/types.ts'
 * @import { Tags } from './types.ts'
 * @import { _Chain, _Child, _Definition, _DefinitionTask } from './private.ts'
 */

import { intrinsicIds, staticIds } from '../../edag/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { chunksText } from '../../text/marked/module.f.mjs'
import { graphOf } from '../../website/demo/graph/module.f.mjs'
import { hasEntry } from '../../types/object/entry/module.f.js'
import { assertNotNullish } from '../../asserts/module.f.js'
import { operatorOperands } from '../../js/ast/module.f.mjs'

// The operator tag groups `fjs/js/ast/types.ts` names, read here rather
// than reconstructed from the compiler's own runtime schemas: a drawing is
// allowed the loss of automatic drift-detection a schema import would buy,
// for a flat list of strings simple enough to check against the type file
// by eye. The static functions are the one group a later row grows, so
// they are the EDAG's own list.
const leaves = new Set(['entry', 'hasEntry', ...intrinsicIds, ...staticIds])
const op1 = new Set(['String', 'Number', '!', '~', 'typeof'])
const op2 = new Set([
    '===', '!==', '>', '>=', '<', '<=',
    '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
])
const op12 = new Set(['+', '-'])

/**
 * A key as a chain spells it: a name, a numbered index, or `[]` for a
 * computed one, whose value is an `idx` row of its own.
 *
 * @type {(index: unknown) => string}
 */
const keyLabel = index => typeof index === 'string' ? index : typeof index === 'number' ? `[${index}]` : '[]'

/** A plain access's spelling: `.x`, `[0]`, or `[]`. @type {(index: unknown) => string} */
const dotLabel = index => typeof index === 'string' ? `.${index}` : keyLabel(index)

/**
 * A node no shape describes, drawn as itself, labelled by its tag, rather
 * than silently dropped or wrongly drawn.
 *
 * @type {(exp: readonly unknown[]) => Shape<unknown>}
 */
export const unsupported = exp => ({ kind: 'unsupported', label: `${exp[0]} (not yet drawn)`, children: [] })

/** An edge, marked where its position is lazy. @type {(label: string, value: unknown, lazy: boolean) => _Child} */
const edge = (label, value, lazy) => lazy ? [label, value, 'lazy'] : [label, value]

/**
 * A link's key as its row, as a plain `.` node draws it: a name a
 * value in its `key` row, and an index, literal or computed, in its
 * `idx` row — a computed one an edge, lazy inside a region.
 *
 * @type {(index: unknown, lazy: boolean) => _Child}
 */
const keyRow = (index, lazy) =>
    edge(typeof index === 'string' ? 'key' : 'idx', index, lazy && index instanceof Array)

/**
 * The ports of an array node's items: one per item, named by its position,
 * a spread's marked `...`.
 *
 * @type {(items: unknown) => readonly _Child[]}
 */
const numbered = items => /** @type {readonly unknown[]} */ (items).map((item, i) =>
    item instanceof Array && item[0] === '...' ? [`...${i}`, item[1]] : [`${i}`, item])

/**
 * The operator shape of one vocabulary, with `other` for every tuple it
 * does not share.
 *
 * @type {(tags: Tags) => (other: (exp: readonly unknown[]) => Shape<unknown>) => (e: unknown) => Shape<unknown>}
 */
export const operatorShape = ({ array, object }) => other => {
    /**
     * A call's arguments as the one array node they are drawn as, in a
     * `...` row: a port per argument would give two calls in one chain the
     * same `0`, and a spread is the array's own.
     *
     * @type {(items: unknown, lazy: boolean) => _Child}
     */
    const argsRow = (items, lazy) => edge('...', [array, items], lazy)

    /**
     * A chain's steps, each a link of its own in the node its first link
     * began: one row, beside a cell holding the link's operator — `.` with
     * its key, `()` or `?.()` with its arguments, and `(?.)()` for a call
     * whose parentheses closed the region. The node's label spells the
     * chain for the rows that name it, `?.b.c()`.
     *
     * Once a `?.` has been passed, every operand after it is one a nullish
     * value skips and draws lazy — a guarded call's own arguments included
     * — until a closing call's parentheses end the region: its arguments
     * run regardless.
     *
     * @type {(chain: _Chain) => (step: unknown) => Shape<unknown>}
     */
    const steps = chain => step => {
        if (step === undefined) { return { kind: 'op', label: chain.label, children: chain.children, groups: chain.groups } }
        const [tag, x, next] = /** @type {readonly unknown[]} */ (step)
        /** @type {(op: string, label: string, row: _Child, lazy: boolean) => Shape<unknown>} */
        const link = (op, label, row, lazy) =>
            steps({ label, children: [...chain.children, row], groups: [...chain.groups, [op, 1]], lazy })(next)
        if (tag === '|.') { return link('.', chain.label + dotLabel(x), keyRow(x, chain.lazy), chain.lazy) }
        const guarded = tag === '|?.()'
        const closing = tag === '|!()'
        const lazy = !closing && (chain.lazy || guarded)
        const op = closing ? '(?.)()' : guarded ? '?.()' : '()'
        return link(op, closing ? `(${chain.label})()` : `${chain.label}${guarded ? '?.()' : '()'}`, argsRow(x, lazy), lazy)
    }

    /**
     * A chain — an access, plain or guarded, a guarded call, and the steps
     * any of them carries — drawn as the one node it is, a table of its
     * links, {@link steps}. The first link takes two rows, so that every
     * arrow has its name beside it: an access's receiver in `obj` and its
     * key, or a guarded call's callee in `callee` and its arguments.
     *
     * @type {(exp: readonly unknown[]) => Shape<unknown>}
     */
    const chain = exp => {
        const [tag, base, x, step] = exp
        if (tag === '?.()') {
            return steps({
                label: '?.()',
                children: [['callee', base], argsRow(x, true)],
                groups: [['?.()', 2]],
                lazy: true,
            })(step)
        }
        const guarded = tag === '?.'
        // A plain access with nothing after it is a `.` node of its own, its
        // key a value in its `key` row or its index in its `idx`.
        if (!guarded && step === undefined) {
            return { kind: 'op', label: '.', children: [['obj', base], keyRow(x, false)] }
        }
        return steps({
            label: guarded ? `?.${keyLabel(x)}` : dotLabel(x),
            children: [['obj', base], keyRow(x, guarded)],
            groups: [[guarded ? '?.' : '.', 2]],
            lazy: guarded,
        })(step)
    }

    return e => {
        if (e === null || typeof e !== 'object') { return { inline: chunksText(leafSerialize(/** @type {Primitive} */ (e))) } }
        const exp = /** @type {readonly unknown[]} */ (e)
        const tag = exp[0]
        if (tag === array) { return { kind: 'op', label: '[]', children: numbered(exp[1]) } }
        if (tag === object) {
            const props = /** @type {readonly (readonly unknown[])[]} */ (exp[1])
            return {
                kind: 'op', label: '{}',
                children: props.flatMap((p, i) => p[0] === '...'
                    ? [/** @type {_Child} */ ([`...${i}`, p[1]])]
                    : typeof p[1] === 'string'
                        ? [/** @type {_Child} */ ([p[1], p[2]])]
                        : [/** @type {_Child} */ ([`key${i}`, p[1]]), /** @type {_Child} */ ([`value${i}`, p[2]])]),
            }
        }
        if (tag === '.' || tag === '?.' || tag === '?.()') { return chain(exp) }
        if (tag === '()') { return { kind: 'op', label: '()', children: [['callee', exp[1]], argsRow(exp[2], false)] } }
        // a member check: the receiver and the key a plain access would
        // read, without reading it
        if (tag === 'memberPresent') { return { kind: 'op', label: 'memberPresent', children: [['obj', exp[1]], keyRow(exp[2], false)] } }
        if (tag === ',') {
            const items = /** @type {readonly unknown[]} */ (exp[1])
            // **A comma's operands are not alike, and numbering them says
            // they are.** `fjs/edag`'s own doc: it "establishes all of its
            // operands and takes the value of the last one; the earlier
            // operands exist for their throw-potential only — the anchors
            // of computations whose value nothing takes". Five edges
            // labelled `0` to `4` show five equals where one is the answer
            // and four only have to happen.
            //
            // The names carry that and the drawing carries the order, which
            // is what the numbers were really for: the operands sit left to
            // right as they were written.
            const last = items.length - 1
            return { kind: 'op', label: ',', children: items.map((item, i) => [i === last ? 'result' : 'anchor', item]) }
        }
        if (tag === '?:') {
            // The condition is established, then exactly one arm — so both
            // arms are lazy and neither is the operand that always runs.
            return { kind: 'op', label: '?:', children: [['cond', exp[1]], ['then', exp[2], 'lazy'], ['else', exp[3], 'lazy']] }
        }
        if (typeof tag === 'string' && leaves.has(tag)) { return { inline: tag, kind: 'terminal' } }
        if (typeof tag === 'string' && op1.has(tag)) { return { kind: 'op', label: tag, children: [['operand', exp[1]]] } }
        if (typeof tag === 'string' && op2.has(tag)) {
            return { kind: 'op', label: tag, children: [['left', exp[1]], ['right', exp[2]]] }
        }
        // an instance check: its one operand, and the constructor as part
        // of the label, a name the node carries rather than a child
        if (tag === 'instanceof') { return { kind: 'op', label: `instanceof ${exp[2]}`, children: [['operand', exp[1]]] } }
        // an entry check: its key as part of the label, a spelling the
        // node carries rather than a child, and its one operand
        if (tag === 'in') { return { kind: 'op', label: `${JSON.stringify(exp[1])} in`, children: [['operand', exp[2]]] } }
        if (typeof tag === 'string' && op12.has(tag)) {
            return exp.length === 2
                ? { kind: 'op', label: tag, children: [['operand', exp[1]]] }
                : { kind: 'op', label: tag, children: [['left', exp[1]], ['right', exp[2]]] }
        }
        return other(exp)
    }
}

/**
 * Every binding a module defines, in the order its definitions are
 * written, each with the edges its node draws: a `define`'s value, lazy
 * where the binding is, and a capture's value from the enclosing
 * function. Parameters, `rest`, `self`, loop parameters and results are
 * defined by their position and draw no edge.
 *
 * FAST carries no source names: a `BindingId`'s index is diagnostic, and
 * two bindings may share one. So a binding is named by its place in this
 * list.
 *
 * @type {(module: Module) => readonly _Definition[]}
 */
const definitions = ({ parameters, body }) => {
    /** @type {(id: BindingId) => _DefinitionTask} */
    const bare = id => ({ definition: [id, []] })
    /** @type {(value: Value) => readonly _DefinitionTask[]} */
    const value = v => [{ expand: () => {
        if (v === null || typeof v !== 'object' || v[0] === 'ref') { return [] }
        if (v[0] === 'function') {
            const { parameters, rest, self, captures, body } = v[1]
            return [
                ...parameters.map(bare),
                ...(rest === null ? [] : [bare(rest)]),
                ...(self === null ? [] : [bare(self)]),
                ...captures.flatMap(({ binding, value: c }) => [/** @type {_DefinitionTask} */ ({ definition: [binding, [['captured', c]]] }), ...value(c)]),
                ...block(body),
            ]
        }
        if (v[0] === 'block') { return block(v[1]) }
        if (v[0] === 'if') { return [...value(v[1]), ...block(v[2]), ...block(v[3])] }
        return operatorOperands(v).flatMap(value)
    } }]
    /** @type {(statement: Statement) => readonly _DefinitionTask[]} */
    const statement = s => {
        switch (s[0]) {
            case 'define': {
                const [, id, v, mode] = s
                return [{ definition: [id, [mode === 'lazy' ? ['value', v, 'lazy'] : ['value', v]]] }, ...value(v)]
            }
            case 'block': { return [...s[1].map(bare), ...block(s[2])] }
            case 'if': { return [...s[1].map(bare), ...value(s[2]), ...block(s[3]), ...block(s[4])] }
            default: {
                const { parameters, initial, results, body } = s[1]
                return [...parameters.map(bare), ...initial.flatMap(value), ...results.map(bare), ...block(body)]
            }
        }
    }
    /** @type {(exit: Exit) => readonly _DefinitionTask[]} */
    const exit = e => {
        switch (e[0]) {
            case 'yield': { return e[1].flatMap(value) }
            case 'continue':
            case 'break': { return e[2].flatMap(value) }
            case 'return': { return value(e[2]) }
            default: { return value(e[1]) }
        }
    }
    /** @type {(block: Block) => readonly _DefinitionTask[]} */
    const block = ({ statements, exit: e }) => [{ expand: () => [...statements.flatMap(statement), ...exit(e)] }]
    // Expand depth first without borrowing the host call stack. Tasks retain
    // the order of definitions, including captures before their values.
    let pending = [...parameters.map(bare), ...block(body)]
    /** @type {readonly _Definition[]} */
    let found = []
    while (pending.length !== 0) {
        const [task, ...rest] = pending
        if ('definition' in task) {
            found = [...found, task.definition]
            pending = rest
        } else {
            pending = [...task.expand(), ...rest]
        }
    }
    return found
}

/** An operand as its edge reaches it: a reference is an edge to the binding it names. @type {(v: unknown) => unknown} */
const deref = v => v instanceof Array && v[0] === 'ref' ? v[1] : v

/**
 * The edges of an exit that leaves to a target: an arrow back to the
 * function or loop it leaves, and the values it carries.
 *
 * @type {(label: string, target: unknown, values: readonly unknown[]) => Shape<unknown>}
 */
const transfer = (label, target, values) => ({
    kind: 'op', label,
    children: [['to', target], ...values.map((v, i) => /** @type {_Child} */ ([values.length === 1 ? 'value' : `value ${i}`, v]))],
})

/**
 * A block's rows: each statement, a `define` as an edge to the binding
 * it defines, and then its exit — a `yield` or a `throw` as the edges to
 * its values, and an exit that leaves to a target as a node of its own.
 *
 * @type {(block: Block) => Shape<unknown>}
 */
const blockShape = ({ statements, exit }) => {
    const [tag] = exit
    const exits = tag === 'yield'
        ? exit[1].map((v, i) => /** @type {_Child} */ ([exit[1].length === 1 ? 'yield' : `yield ${i}`, v]))
        : tag === 'throw' ? [/** @type {_Child} */ (['throw', exit[1]])] : [/** @type {_Child} */ ([tag, exit])]
    return {
        kind: 'block', label: 'block',
        children: [...statements.map(s => /** @type {_Child} */ ([s[0], s[0] === 'define' ? s[1] : s])), ...exits],
    }
}

/**
 * A function or loop target as the arrow back to the node it names: the
 * nearest enclosing function, `loop`, `while` or `switch` statement whose
 * target it is. Each of those is a tag and a record holding its target;
 * a `switch` exit is a longer tuple, which no exit names.
 *
 * @type {(target: unknown) => Shape<unknown>}
 */
const targetShape = target => ({
    owner: o => o instanceof Array && o.length === 2 && (o[0] === 'function' || o[0] === 'loop' || o[0] === 'while' || o[0] === 'switch') && o[1].target === target,
})

/** Each child of a node shape as its edge reaches it, {@link deref}. @type {(s: Shape<unknown>) => Shape<unknown>} */
const derefChildren = s => hasEntry(s, 'children')
    ? { ...s, children: s.children.map(([label, child, kind]) => kind === undefined ? [label, deref(child)] : [label, deref(child), kind]) }
    : s

/** A list of bindings as rows, `label i`. @type {(label: string, ids: readonly unknown[]) => readonly _Child[]} */
const rows = (label, ids) => ids.map((id, i) => [`${label} ${i}`, id])

/**
 * `module` as the graph it is: its blocks, statements and operators, and
 * **a binding as one node** however many references reach it, named
 * `$n` by its place among the module's definitions.
 *
 * **A binding's node holds what defines it**: a `define`'s value, dashed
 * when the binding is `lazy`, or a capture's value, read in the enclosing
 * function. A parameter, `rest`, `self`, a loop's parameters and a
 * statement's results are defined where they are listed and hold nothing.
 *
 * **A block is a node of rows**: each statement, a `define` as an edge to
 * its binding, and then its exit. `return`, `continue` and `break` are
 * nodes of their own, with an arrow back to the function or loop they
 * leave, beside the values they carry.
 *
 * **A function is a `=>` node** with its parameters, `rest`, `self` and
 * captures as bindings, and its body a dashed edge: making the function
 * does not run it. A conditional's arms are dashed too, as `?:`'s are.
 *
 * **A binding is drawn after its deepest use**, as every node is: the
 * renderer ranks by longest path, so every arrow points forward, and a
 * parameter's node lands right of the body that reads it. Placing a
 * binding beside the row that defines it was tried and rejected: the
 * renderer draws an arrow pointing back only as the dotted lane of
 * recursion and exits, so every use looked like recursion, and lanes into
 * one node merge, so the two reads of `x` in `x + x` looked like one.
 *
 * @type {(module: Module) => Graph}
 */
export const fastGraph = module => {
    const defined = definitions(module)
    /** @type {(v: unknown) => Shape<unknown>} */
    const record = v => {
        const r = /** @type {{ readonly [k in string]: unknown }} */ (v)
        if (hasEntry(r, 'statements')) { return blockShape(/** @type {Block} */ (v)) }
        if (hasEntry(r, 'body')) {
            const { parameters, body } = /** @type {Module} */ (v)
            return { kind: 'block', label: 'module', children: [...rows('import', parameters), ['body', body]] }
        }
        if (hasEntry(r, 'kind')) { return targetShape(v) }
        const position = defined.findIndex(([id]) => id === v)
        return { kind: 'binding', label: `$${position}`, children: assertNotNullish(defined[position])[1] }
    }
    const operators = operatorShape({ array: 'array', object: 'object' })(exp => {
        switch (exp[0]) {
            case 'function': {
                const { parameters, rest, self, captures, body } = /** @type {AstFunction} */ (exp[1])
                return {
                    kind: 'op', label: '=>',
                    children: [
                        ...rows('param', parameters),
                        ...(rest === null ? [] : [/** @type {_Child} */ (['rest', rest])]),
                        ...(self === null ? [] : [/** @type {_Child} */ (['self', self])]),
                        ...rows('capture', captures.map(c => c.binding)),
                        ['body', body, 'lazy'],
                    ],
                }
            }
            // a block statement binds its results; a block value is its rows
            case 'block': {
                return exp.length === 3
                    ? { kind: 'op', label: 'block', children: [...rows('result', /** @type {readonly unknown[]} */ (exp[1])), ['body', exp[2]]] }
                    : blockShape(/** @type {Block} */ (exp[1]))
            }
            case 'if': {
                const [, ids, cond, then, otherwise] = exp.length === 5 ? exp : ['if', [], ...exp.slice(1)]
                return {
                    kind: 'op', label: 'if',
                    children: [...rows('result', /** @type {readonly unknown[]} */ (ids)), ['cond', cond], ['then', then, 'lazy'], ['else', otherwise, 'lazy']],
                }
            }
            case 'loop': {
                const { parameters, initial, results, body } = /** @type {Loop} */ (exp[1])
                return {
                    kind: 'op', label: 'loop',
                    children: [...rows('param', parameters), ...rows('initial', initial), ...rows('result', results), ['body', body]],
                }
            }
            case 'return': { return transfer('return', exp[1], [exp[2]]) }
            case 'continue':
            case 'break': { return transfer(/** @type {string} */ (exp[0]), exp[1], /** @type {readonly unknown[]} */ (exp[2])) }
            default: { return unsupported(exp) }
        }
    })
    return graphOf(v => derefChildren(v !== null && typeof v === 'object' && !(v instanceof Array) ? record(v) : operators(v)))(module)
}

/**
 * How a pattern's read spells where it reads from: `=` for the value it
 * binds, `n.key` or `n[i]` for a key of read `n`, a static function's
 * name, and `...` before a read that copies an iterable first.
 *
 * @type {(read: ExpansionPlan['reads'][number]) => string}
 */
const readLabel = ({ source, spread }) => {
    const from = source === null ? '='
        : source.length === 1 ? source[0]
            : typeof source[1] === 'number' ? `${source[0]}[${source[1]}]` : `${source[0]}.${source[1]}`
    return spread ? `...${from}` : from
}

/** A pattern's reads as rows, each an edge to the binding it reads into. @type {(plan: ExpansionPlan) => readonly _Child[]} */
const planRows = ({ reads, ids }) => reads.map((read, i) => [readLabel(read), ids[i]])

/**
 * A pattern that binds one name to the whole value, with no default: the
 * one binding it is, rather than a node of one row.
 *
 * @type {(plan: ExpansionPlan) => BindingId | null}
 */
const simple = ({ reads, ids }) => reads.length === 1 && reads[0].source === null && !reads[0].spread ? ids[0] : null

/**
 * A source block's rows: each statement as a node, and then its exit — a
 * `yield` or a `throw` as the edge to its value, and every other exit as
 * a node of its own.
 *
 * @type {(block: SourceBlock) => Shape<unknown>}
 */
const sourceBlockShape = ({ statements, exit }) => ({
    kind: 'block', label: 'block',
    children: [
        ...statements.map(s => /** @type {_Child} */ ([s[0], s])),
        /** @type {_Child} */ (exit[0] === 'yield' || exit[0] === 'throw' ? [exit[0], exit[1]] : [exit[0], exit]),
    ],
})

/**
 * `module` — the parser's resolved source — as the graph it is: its
 * blocks, statements and operators, and **a binding as one node**
 * however many places declare, read or write it, named as the source
 * names it. A temporary the parser made has no name and is `$n`, by its
 * place among the module's bindings.
 *
 * **A pattern is rows of reads**: `=` for the whole value, `n.key` or
 * `n[i]` for a key of an earlier read, each an edge to the binding it
 * reads into. A parameter or `rest` that binds one name and has no
 * default is that binding.
 *
 * **Statements are nodes**: `initialize` with its pattern and value,
 * `write` with the binding it writes and the value, `if` with lazy arms,
 * `while` with its condition and a lazy body. `return`, `break` and
 * `continue` arrow back to the function, loop or `switch` they leave. A
 * `switch`, a statement in a loop or the exit that ends a block, has its
 * value and a lazy edge to each case and to `default`. The
 * logical operators `&&`, `||` and `??` are still themselves here, their
 * right operands lazy.
 *
 * @type {(module: ResolvedModule) => Graph}
 */
export const sourceGraph = module => {
    const { imports, body, origins } = module
    /** @type {(v: unknown) => Shape<unknown>} */
    const record = v => {
        const r = /** @type {{ readonly [k in string]: unknown }} */ (v)
        if (hasEntry(r, 'statements')) { return sourceBlockShape(/** @type {SourceBlock} */ (v)) }
        if (hasEntry(r, 'imports')) {
            return {
                kind: 'block', label: 'module',
                children: [...imports.map(i => /** @type {_Child} */ ([i.specifier, i.binding ?? i])), ['body', body]],
            }
        }
        // an import that binds no name: the module it loads, and nothing else
        if (hasEntry(r, 'specifier')) { return { inline: '{}', kind: 'terminal' } }
        if (hasEntry(r, 'reads')) { return { kind: 'op', label: 'pattern', children: planRows(/** @type {ExpansionPlan} */ (v)) } }
        if (hasEntry(r, 'plan')) {
            const { plan, default: d } = /** @type {SourceParameter} */ (v)
            return { kind: 'op', label: 'param', children: [...planRows(plan), ...(d === null ? [] : [/** @type {_Child} */ (['default', d.value, 'lazy'])])] }
        }
        // The first label runs on reaching the case. Later labels are
        // skipped after a match, and the body is skipped without a match.
        if (hasEntry(r, 'labels')) {
            const { labels, body } = /** @type {SourceCase} */ (v)
            return { kind: 'op', label: 'case', children: [...labels.map((label, i) => edge(`label ${i}`, label, i !== 0)), ['body', body, 'lazy']] }
        }
        if (hasEntry(r, 'kind')) { return targetShape(v) }
        const position = origins.findIndex(o => o.id === v)
        const { name } = assertNotNullish(origins[position])
        return { kind: 'binding', label: name ?? `$${position}`, children: [] }
    }
    const operators = operatorShape({ array: 'array', object: 'object' })(exp => {
        switch (exp[0]) {
            case '&&':
            case '||':
            case '??': { return { kind: 'op', label: exp[0], children: [['left', exp[1]], ['right', exp[2], 'lazy']] } }
            case 'function': {
                const { length, parameters, rest, self, body } = /** @type {SourceFunction} */ (exp[1])
                return {
                    kind: 'op', label: '=>',
                    children: [
                        ['length', length],
                        ...parameters.map((p, i) => /** @type {_Child} */ ([`param ${i}`, p.default === null ? simple(p.plan) ?? p : p])),
                        ...(rest === null ? [] : [/** @type {_Child} */ (['rest', simple(rest) ?? rest])]),
                        ...(self === null ? [] : [/** @type {_Child} */ (['self', self])]),
                        ['body', body, 'lazy'],
                    ],
                }
            }
            case 'block': { return sourceBlockShape(/** @type {SourceBlock} */ (exp[1])) }
            case 'initialize': { return { kind: 'op', label: 'initialize', children: [...planRows(/** @type {ExpansionPlan} */ (exp[1])), ['value', exp[2]]] } }
            case 'write': { return { kind: 'op', label: 'write', children: [['to', exp[1]], ['value', exp[2]]] } }
            case 'compound-write': {
                return { kind: 'op', label: `${exp[2]}=`, children: [['to', exp[1]], ['left', exp[1]],
                    edge('right', exp[3], exp[2] === '&&' || exp[2] === '||' || exp[2] === '??')] }
            }
            case 'if': { return { kind: 'op', label: 'if', children: [['cond', exp[1]], ['then', exp[2], 'lazy'], ['else', exp[3], 'lazy']] } }
            case 'while': {
                const { condition, body } = /** @type {SourceLoop} */ (exp[1])
                return { kind: 'op', label: 'while', children: [['cond', condition], ['body', body, 'lazy']] }
            }
            case 'terminal-loop': {
                const { condition, body } = /** @type {SourceLoop} */ (exp[1])
                return { kind: 'op', label: 'terminal while', children: [['cond', condition], ['body', body, 'lazy']] }
            }
            // a `switch` statement, which a `break` leaves, or a `switch`
            // exit, which ends its block: the same value, cases and default
            case 'switch': {
                const { discriminant, cases, otherwise } = exp.length === 2
                    ? /** @type {SourceSwitch} */ (exp[1])
                    : { discriminant: exp[1], cases: /** @type {readonly SourceCase[]} */ (exp[2]), otherwise: exp[3] }
                return {
                    kind: 'op', label: 'switch',
                    children: [['value', discriminant], ...cases.map((c, i) => /** @type {_Child} */ ([`case ${i}`, c, 'lazy'])), ['default', otherwise, 'lazy']],
                }
            }
            case 'return': { return transfer('return', exp[1], [exp[2]]) }
            case 'break':
            case 'continue': { return transfer(/** @type {string} */ (exp[0]), exp[1], []) }
            case 'throw': { return { kind: 'op', label: 'throw', children: [['value', exp[1]]] } }
            default: { return unsupported(exp) }
        }
    })
    return graphOf(v => derefChildren(v !== null && typeof v === 'object' && !(v instanceof Array) ? record(v) : operators(v)))(module)
}

