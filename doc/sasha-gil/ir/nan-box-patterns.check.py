# The layout check of doc/sasha-gil/ir/type-system.md, run on the NaN box of
# doc/sergey-shandar/nanvm/README.md: 23 patterns over 64 bits.
#
# A prototype that accompanies nan-box-patterns.md.
# Run: python3 -I nan-box-patterns.check.py
import itertools
import random

ALL = (1 << 64) - 1


def parse(pattern, widths):
    """Expand a pattern to its 64 characters.

    '0' and '1' are fixed bits, a letter is a bit of the field with that
    name, '_' is a separator, and '…' repeats the character before it. A
    field's width comes from `widths`, so at most one fill of fixed bits is
    left to count."""
    s = pattern.replace('_', '')
    items = []  # [character, count], and the count of a fill starts as None
    i = 0
    while i < len(s):
        c = s[i]
        if i + 1 < len(s) and s[i + 1] == '…':
            items.append([c, None])
            i += 2
            if i < len(s) and s[i] == c:  # `c…c`: the closing character
                i += 1
        else:
            items.append([c, 1])
            i += 1
    # a field's fill is what its width leaves
    for name, width in widths.items():
        own = [it for it in items if it[0] == name]
        fills = [it for it in own if it[1] is None]
        written = sum(it[1] for it in own if it[1] is not None)
        assert len(fills) <= 1, f'two fills of one field: {pattern}'
        if fills:
            fills[0][1] = width - written
            assert fills[0][1] >= 1, pattern
        else:
            assert written == width, f'field {name}: {written} bits written, {width} in its type: {pattern}'
    for c, _ in items:
        assert c in '01' or c in widths, f'field {c} has no type: {pattern}'
    # the one fill of fixed bits is what the 64 bits leave
    fixed = [it for it in items if it[0] in '01' and it[1] is None]
    assert len(fixed) <= 1, f'two fills of fixed bits: {pattern}'
    if fixed:
        fixed[0][1] = 64 - sum(it[1] for it in items if it[1] is not None)
        assert fixed[0][1] >= 1, pattern
    bits = ''.join(c * n for c, n in items)
    assert len(bits) == 64, f'{len(bits)} bits: {pattern}'
    return bits


def mask_value(bits):
    """A value x is in the pattern when x & mask == value."""
    m = v = 0
    for i, c in enumerate(bits):
        if c in '01':
            m |= 1 << (63 - i)
            v |= int(c) << (63 - i)
    return m, v


def hx(x):
    s = f'{x:016X}'
    return '0x' + '_'.join(s[i:i + 4] for i in range(0, 16, 4))


EXP = 0x7FF0_0000_0000_0000
FRACTION = 0x000F_FFFF_FFFF_FFFF
CANONICAL_NAN = 0x7FF8_0000_0000_0000


def outside_f64c(m, v):
    """Every value of the pattern is a NaN other than the canonical one."""
    if m & EXP != EXP or v & EXP != EXP:
        return False  # it may be a finite number
    if v & FRACTION == 0:
        return False  # it may be an infinity
    return m & (v ^ CANONICAL_NAN) != 0  # a fixed bit differs from the NaN


def disjoint(a, b):
    """Some bit is fixed in both patterns and differs."""
    (ma, va), (mb, vb) = a, b
    return ma & mb & (va ^ vb) != 0


# The 23 patterns. A name maps to its pattern and the widths of its fields.
box = {
    'boolean':      ('b111_1111_1111_0…0_0001_0000', {'b': 1}),
    'undefined':    ('0111_1111_1111_0…0_0010_0000', {}),
    'null':         ('0111_1111_1111_0…0_0011_0000', {}),
    'string.empty': ('0111_1111_1111_0…0_0000_1000', {}),
    'string.s1x16': ('0111_1111_1111_0…0_u…u_0001_1000', {'u': 1 * 16}),
    'string.s2x16': ('0111_1111_1111_0…0_u…u_0010_1000', {'u': 2 * 16}),
    'string.s4x7':  ('0111_1111_1111_0…0_u…u_0100_1000', {'u': 4 * 7}),
    'string.s5x7':  ('0111_1111_1111_0…0_u…u_0101_1000', {'u': 5 * 7}),
    'string.s6x7':  ('0111_1111_1111_0…0_u…u_0110_1000', {'u': 6 * 7}),
    'string.s3x16': ('0111_1111_1111_u…u_0100', {'u': 3 * 16}),
    'string.s8x6':  ('0111_1111_1111_u…u_1100', {'u': 8 * 6}),
    'string.s7x7':  ('1111_1111_1111_u…u_100', {'u': 7 * 7}),
    'bigint.short': ('v111_1111_1111_v…v_1', {'v': 52}),
}
# The reference kinds and their type tags. The README has the first four.
kinds = {'object': '0011', 'string': '0100', 'bigint': '0101', 'function': '0110', 'array': '0111'}
for kind, tag in kinds.items():
    box[f'{kind}.heap'] = (f'0111_1111_1111_{tag}_p…p_10', {'p': 46})
    box[f'{kind}.lit'] = (f'1111_1111_1111_{tag}_p…p_10', {'p': 46})
assert len(box) == 23


def match(name, x):
    m, v = mv[name]
    return x & m == v


# 1. Width: `parse` asserts it. 2. Not a number.
mv = {}
for name, (pattern, widths) in box.items():
    bits = parse(pattern, widths)
    mv[name] = mask_value(bits)
    assert outside_f64c(*mv[name]), name
    print(f'{name:14} ' + '_'.join(bits[i:i + 4] for i in range(0, 64, 4)))
print()
for name, (m, v) in mv.items():
    print(f'{name:14} mask {hx(m)}  value {hx(v)}')
print()
print('1, 2. every pattern is 64 bits and outside f64c')

# 3. No overlap.
pairs = list(itertools.combinations(mv, 2))
overlaps = [(a, b) for a, b in pairs if not disjoint(mv[a], mv[b])]
assert overlaps == [], overlaps
print(f'3. no overlap in {len(pairs)} pairs')

# 4. The README's constants.
assert match('boolean', 0x7FF0_0000_0000_0010)    # FALSE
assert match('boolean', 0xFFF0_0000_0000_0010)    # TRUE
assert match('undefined', 0x7FF0_0000_0000_0020)  # UNDEFINED
assert match('null', 0x7FF0_0000_0000_0030)       # NULL
assert match('string.empty', 0x7FF0_0000_0000_0008)  # EMPTY_STRING
numbers = [
    0x7FF0_0000_0000_0000,  # Infinity
    0xFFF0_0000_0000_0000,  # -Infinity
    CANONICAL_NAN,
    0x3FF0_0000_0000_0000,  # 1.0
    0x0000_0000_0000_0000,  # 0
    0x8000_0000_0000_0000,  # -0
]
for x in numbers:
    assert not any(match(n, x) for n in mv), hx(x)
print('4. the README constants are in their patterns, and six numbers are in none')

# 5. The test for a counted reference, derived from the `heap` patterns.
counted = [n for n in mv if n.endswith('.heap')]
others = [n for n in mv if n not in counted]
m = ALL
for n in counted:
    m &= mv[n][0]                           # bits that every one of them fixes
for n in counted:
    m &= ~(mv[n][1] ^ mv[counted[0]][1])    # and on which they agree
v = mv[counted[0]][1] & m
assert all(disjoint((m, v), mv[n]) for n in others)
print(f'5. counted, merged:    x & {hx(m)} == {hx(v)}')
# A bit pattern that no variant uses is junk, so a test may accept it. Drop
# every bit that the test does not need to refuse a variant or a number.
for k in range(64):
    b = 1 << k
    if m & b:
        m2, v2 = m & ~b, v & ~b
        if outside_f64c(m2, v2) and all(disjoint((m2, v2), mv[n]) for n in others):
            m, v = m2, v2
print(f'   counted, minimized: x & {hx(m)} == {hx(v)}')
REF_TAG = 0xFFF0_0000_0000_0003
DYN_REF = 0x7FF0_0000_0000_0002
assert (m, v) == (REF_TAG, DYN_REF)  # the README's is_dyn_ref

# The README's functions.
TAG8 = 0x7FF0_0000_0000_00FF
NON_FINITE = 0x7FF0_0000_0000_0000
BOOL = 0x7FF0_0000_0000_0010
TAG2 = 0x7FF0_0000_0000_0003
SCALAR = 0x7FF0_0000_0000_0000
REF = 0x7FF0_0000_0000_0002
SHORT_BIGINT = 0x7FF0_0000_0000_0001


def is_finite(x):
    return x & EXP != EXP


def is_number(x):
    return is_finite(x) or x & TAG8 == NON_FINITE


def is_bool(x):
    return x & TAG8 == BOOL


def is_short_string(x):
    return x & TAG2 == SCALAR and x & 0xC != 0


def is_ref(x):
    return x & TAG2 == REF


def is_dyn_ref(x):
    return x & REF_TAG == DYN_REF


def is_short_bigint(x):
    return x & SHORT_BIGINT == SHORT_BIGINT


def typeof_(x):
    if is_finite(x):
        return 0
    if x & 1 == 1:
        return 5
    if x & 2 == 2:
        return (x >> 48) & 0xF
    if x & 0xC != 0:
        return 4
    return (x >> 4) & 0xF


# What the README's functions must return for a pattern, by its name.
type_of = {'boolean': 1, 'undefined': 2, 'null': 3, 'string': 4, 'bigint': 5,
           'object': 3, 'function': 6, 'array': 7}
refs = {n for n in mv if n.endswith(('.heap', '.lit'))}
short_strings = {n for n in mv if n.startswith('string.')} - refs
expected = {
    is_finite: set(),
    is_number: set(),
    is_bool: {'boolean'},
    is_short_string: short_strings,
    is_ref: refs,
    is_dyn_ref: set(counted),
    is_short_bigint: {'bigint.short'},
}

# 6, 7. Both ends of each pattern and 2,000 random values of it.
random.seed(1)
count = 0
for name, (m, v) in mv.items():
    samples = [v, v | (~m & ALL)] + [(random.getrandbits(64) & ~m) | v for _ in range(2000)]
    for x in samples:
        count += 1
        assert [n for n in mv if match(n, x)] == [name], (name, hx(x))
        assert typeof_(x) == type_of[name.split('.')[0]], (name, hx(x))
        for f, names in expected.items():
            assert f(x) == (name in names), (f.__name__, name, hx(x))
for x in numbers:
    assert is_number(x) and typeof_(x) == 0, hx(x)
    assert not any(f(x) for f in (is_bool, is_short_string, is_ref, is_dyn_ref, is_short_bigint)), hx(x)
print(f'6. {count} values: each is in its own pattern alone, and typeof_ agrees')
print('7. the same values: the seven is_* functions agree')
