# Runs nan-box-in-ir.check.mjs on deliberate mistakes in nan-box-in-ir.box.mjs
# and nan-box-in-ir.edsl.mjs, one at a time. It accompanies section 4 of
# nan-box-in-ir.md. Run in this folder: python3 -I nan-box-in-ir.mutants.py
import subprocess, shutil, os, tempfile
dst = tempfile.mkdtemp()
box = open('nan-box-in-ir.box.mjs', encoding='utf-8').read()
ir = open('nan-box-in-ir.edsl.mjs', encoding='utf-8').read()
mutants = [
    ('box', "code6(sub(c, 0x36n))", "code6(sub(c, 0x35n))"),
    ('box', "4: () => s7(4, p),", "4: () => s16(3, p),"),
    ('box', "short: ({ v }) => if_(lt(v, 0n), -1n, if_(eq(v, 0n), 0n, 1n)),", "short: ({ v }) => if_(lt(v, 0n), 1n, if_(eq(v, 0n), 0n, -1n)),"),
    ('box', "        array: () => 6n,\n        object: () => 7n,", "        array: () => 7n,\n        object: () => 6n,"),
    ('box', "const tag = { object: '0011', string: '0100',", "const tag = { object: '0011', string: '0101',"),
    ('box', "            s8x6: ({ u }) => fromId6(u.at(i)),\n", ""),
    ('box', "        empty: () => 0n,\n        short: each(string.short, ({ u }) => u.length),", "        empty: () => 1n,\n        short: each(string.short, ({ u }) => u.length),"),
    ('box', "s3x16: tag100('0_u…u_0', { u: array(u16, 3) }),", "s3x16: tag100('0_u…u_1', { u: array(u16, 3) }),"),
    ('box', "none: () => string.long.heap({ p: freeze(d) }),", "none: () => string.long.heap({ p: d }),"),
    ('box', "if_(lt(i, length(s)),", "if_(le(i, length(s)),"),
    ('box', "match_(try_narrow(i(52), n), {", "match_(try_narrow(i(53), n), {"),
    ('box', "const abs = n => if_(lt(n, 0n), sub(0n, n), n)", "const abs = n => n"),
    ('box', "export const from_f64 = fn({ x: f64 }, frame.only('number'), ({ x }) => frame.number(canon(x)))", "export const from_f64 = fn({ x: f64 }, frame.only('number'), ({ x }) => frame.number(x))"),
    ('box', "boolean: ['b111_1111_1111_0…0_0001_0000', { b: bool }],", "boolean: ['b111_1111_1111_0…0_0010_0000', { b: bool }],"),
    ('box', "        short: ['x111_1111_1111_x…x_1', { x: u(52) }],", "        short: ['x111_1111_1111_x…x_0', { x: u(52) }],"),
    ('box', "7: () => s7(7, p),", "7: () => none,"),
    ('box', "if_(eq(c, 0x5Fn), code6(37n),", "if_(eq(c, 0x5Fn), code6(64n),"),
    ('box', "const fromId6 = fn({ c: Id6 }, u16, ({ c }) => alphabet.at(as(u(6), c)))", "const fromId6 = fn({ c: Id6 }, u16, ({ c }) => as(u(6), c))"),
    ('box', "        8: () => all(indices(8).map(k => toId6(p.units.at(k))), u => some(string.short.s8x6({ u }))),", "        8: () => all(indices(8).map(k => try_narrow(u(6), p.units.at(k))), u => some(string.short.s8x6({ u }))),"),
    ('box', "        tag100: ['x111_1111_1111_x…x_100', { x: u(50) }],", "        tag100: ['x111_1111_1111_x…x_110', { x: u(50) }],"),
    ('box', "    long: reference('bigint', BigObj),", "    long: reference('string', BigObj),"),
    ('box', "    short: slot('bigint.short')('v…v', { v: i(52) }),", "    short: slot('string.tag100')('v…v_0', { v: i(49) }),"),
    ('ir', "case 'bool': return v ? 1n : 0n", "case 'bool': return v ? 0n : 1n"),
    ('ir', "const scatter = (positions, x) => positions.reduce(\n    (acc, bit, k) => acc | (x >> BigInt(positions.length - 1 - k) & 1n) << bit, 0n)", "const scatter = (positions, x) => positions.reduce(\n    (acc, bit, k) => acc | (x >> BigInt(k) & 1n) << bit, 0n)"),
    ('ir', "        case 'reference': return v.obj.address >> 2n", "        case 'reference': return v.obj.address"),
    ('ir', "export const disjoint = (a, b) => (a.mask & b.mask & (a.value ^ b.value)) !== 0n", "export const disjoint = (a, b) => true"),
    ('ir', "    return hidden ? `holds a ${resolve(hidden.type).mode} where the other has none` : undefined", "    return undefined"),
    ('ir', "            if (m === undefined || !isRef(m) || resolve(m.type).mode !== want.mode) {", "            if (m === undefined || !isRef(m)) {"),
    ('ir', "const within = (l, f) => (f.mask & ~l.mask) === 0n && (l.value & f.mask) === f.value", "const within = (l, f) => (l.value & f.mask) === f.value"),
]
killed = 0
for k, (which, old, new) in enumerate(mutants):
    b, r = box, ir
    if which == 'box':
        assert b.count(old) == 1, old
        b = b.replace(old, new)
    else:
        assert r.count(old) == 1, old
        r = r.replace(old, new)
    for f in ('nan-box-in-ir.flat.mjs', 'nan-box-in-ir.check.mjs'):
        shutil.copy(f, os.path.join(dst, f))
    open(os.path.join(dst, 'nan-box-in-ir.box.mjs'), 'w', encoding='utf-8').write(b)
    open(os.path.join(dst, 'nan-box-in-ir.edsl.mjs'), 'w', encoding='utf-8').write(r)
    out = subprocess.run(['node', 'nan-box-in-ir.check.mjs'], cwd=dst, capture_output=True, text=True)
    dead = out.returncode != 0
    killed += dead
    lines = out.stderr.splitlines()
    kind = 'Refused' if any('Refused' in l for l in lines) else 'Trap' if any(l.startswith('Trap') for l in lines) else 'value' if any('AssertionError' in l for l in lines) else 'other'
    msg = next((l for l in lines if l.startswith(('Refused', 'Trap', 'TypeError'))), '')
    print(('killed  ' if dead else 'SURVIVED') + f' {k:2} {kind:8} {new[:60]!r}', '|', msg[:100])
print(killed, 'of', len(mutants))
