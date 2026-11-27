//! Short-string pack / unpack for the L0 NaN-box ABI
//! ([short-strings.md](../../../../../doc/sasha-gil/ir/short-strings.md) S2).
//! Patterns match
//! [nan-box-patterns.md](../../../../../doc/sasha-gil/ir/nan-box-patterns.md)
//! and `fjs/ir/runtime/string/short.f.js`.

/// Non-finite exponent bits shared by every scalar NaN box.
const EXP: u64 = 0x7FF0_0000_0000_0000;
/// Tag-2 mask: non-finite scalars vs references.
const TAG2: u64 = 0x7FF0_0000_0000_0003;
/// Scalar family under TAG2.
const SCALAR: u64 = 0x7FF0_0000_0000_0000;
/// Empty-string box.
pub const EMPTY: u64 = 0x7FF0_0000_0000_0008;

/// Sergey scalar short-string encodings, in the same order as
/// `fjs/ir/runtime/string/short.f.js` `allTags` (bit `i` of an emit mask).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Tag {
    Empty = 0,
    S1x16 = 1,
    S2x16 = 2,
    S3x16 = 3,
    S4x7 = 4,
    S5x7 = 5,
    S6x7 = 6,
    S7x7 = 7,
    S8x6 = 8,
}

/// Every Sergey tag, index = emit-mask bit.
pub const ALL_TAGS: &[Tag] = &[
    Tag::Empty,
    Tag::S1x16,
    Tag::S2x16,
    Tag::S3x16,
    Tag::S4x7,
    Tag::S5x7,
    Tag::S6x7,
    Tag::S7x7,
    Tag::S8x6,
];

/// v1 enabled set for NaN variants B/C.
pub const V1_ENABLED: &[Tag] = &[Tag::Empty, Tag::S1x16, Tag::S2x16];

/// Emit mask for [`V1_ENABLED`]: bits 0–2.
pub const V1_MASK: u32 =
    (1 << Tag::Empty as u32) | (1 << Tag::S1x16 as u32) | (1 << Tag::S2x16 as u32);

/// Tags whose bits are set in `mask` (bit `i` = [`ALL_TAGS`]`[i]`).
pub fn tags_from_mask(mask: u32) -> Vec<Tag> {
    ALL_TAGS
        .iter()
        .copied()
        .filter(|&t| mask & (1 << t as u32) != 0)
        .collect()
}

/// Emit mask for an enabled-tag list.
pub fn mask_of(tags: &[Tag]) -> u32 {
    tags.iter().fold(0u32, |m, &t| m | (1 << t as u32))
}

/// Unit count a tag encodes, when it fits.
pub fn tag_len(tag: Tag) -> usize {
    match tag {
        Tag::Empty => 0,
        Tag::S1x16 => 1,
        Tag::S2x16 => 2,
        Tag::S3x16 => 3,
        Tag::S4x7 => 4,
        Tag::S5x7 => 5,
        Tag::S6x7 => 6,
        Tag::S7x7 => 7,
        Tag::S8x6 => 8,
    }
}

/// Longest unit count any tag in `enabled` can hold, or `None` if empty.
pub fn max_enabled_len(enabled: &[Tag]) -> Option<usize> {
    enabled.iter().map(|&t| tag_len(t)).max()
}

/// `$`, `0`–`9`, `A`–`Z`, `_`, `a`–`z` — the 6-bit short-string alphabet.
const ALPHABET: [u16; 64] = [
    0x24, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x41, 0x42, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55,
    0x56, 0x57, 0x58, 0x59, 0x5a, 0x5f, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a,
    0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a,
];

/// Fixed mask/value pairs: `b & mask == value` for a known tag.
const PATTERNS: &[(Tag, u64, u64)] = &[
    (Tag::Empty, 0xFFFF_FFFF_FFFF_FFFF, EMPTY),
    (Tag::S1x16, 0xFFFF_FFFF_FF00_00FF, 0x7FF0_0000_0000_0018),
    (Tag::S2x16, 0xFFFF_FF00_0000_00FF, 0x7FF0_0000_0000_0028),
    (Tag::S4x7, 0xFFFF_FFF0_0000_00FF, 0x7FF0_0000_0000_0048),
    (Tag::S5x7, 0xFFFF_F800_0000_00FF, 0x7FF0_0000_0000_0058),
    (Tag::S6x7, 0xFFFC_0000_0000_00FF, 0x7FF0_0000_0000_0068),
    (Tag::S3x16, 0xFFF0_0000_0000_000F, 0x7FF0_0000_0000_0004),
    (Tag::S8x6, 0xFFF0_0000_0000_000F, 0x7FF0_0000_0000_000C),
    (Tag::S7x7, 0xFFF0_0000_0000_0007, 0xFFF0_0000_0000_0004),
];

/// Whether bits are in the short-string scalar family (README `is_short_string`).
pub fn is_short(b: u64) -> bool {
    b & TAG2 == SCALAR && b & 0xC != 0
}

/// Which short tag `b` uses, when it matches a full mask/value pattern.
pub fn tag_of(b: u64) -> Option<Tag> {
    if !is_short(b) {
        return None;
    }
    PATTERNS
        .iter()
        .find(|&&(_, mask, value)| b & mask == value)
        .map(|&(tag, _, _)| tag)
}

fn pack_units(units: &[u16], w: u32) -> u64 {
    units
        .iter()
        .enumerate()
        .fold(0u64, |acc, (i, &c)| acc | (u64::from(c) << (i as u32 * w)))
}

fn unpack_units(payload: u64, n: usize, w: u32) -> Vec<u16> {
    let mask = (1u64 << w) - 1;
    (0..n)
        .map(|i| ((payload >> (i as u32 * w)) & mask) as u16)
        .collect()
}

fn fits7(units: &[u16]) -> bool {
    units.iter().all(|&c| c <= 0x7f)
}

fn to_id6(c: u16) -> Option<u16> {
    match c {
        0x24 => Some(0),
        0x30..=0x39 => Some(c - 0x2f),
        0x41..=0x5a => Some(c - 0x36),
        0x5f => Some(37),
        0x61..=0x7a => Some(c - 0x3b),
        _ => None,
    }
}

/// Pack UTF-16 units into a short-string box when a Sergey tag fits.
pub fn pack(units: &[u16]) -> Option<u64> {
    match units.len() {
        0 => Some(EMPTY),
        1 => Some(EXP | (u64::from(units[0]) << 8) | 0x18),
        2 => Some(EXP | (u64::from(units[0]) << 8) | (u64::from(units[1]) << 24) | 0x28),
        3 => Some(EXP | (pack_units(units, 16) << 4) | 0x4),
        4 if fits7(units) => Some(EXP | (pack_units(units, 7) << 8) | 0x48),
        5 if fits7(units) => Some(EXP | (pack_units(units, 7) << 8) | 0x58),
        6 if fits7(units) => Some(EXP | (pack_units(units, 7) << 8) | 0x68),
        7 if fits7(units) => Some(0xFFF0_0000_0000_0004 | (pack_units(units, 7) << 3)),
        8 => {
            let codes: Option<Vec<u16>> = units.iter().copied().map(to_id6).collect();
            codes.map(|c| EXP | (pack_units(&c, 6) << 4) | 0xC)
        }
        _ => None,
    }
}

/// Pack only when the natural tag is in `enabled`.
pub fn pack_enabled(units: &[u16], enabled: &[Tag]) -> Option<u64> {
    let bits = pack(units)?;
    let tag = tag_of(bits)?;
    enabled.contains(&tag).then_some(bits)
}

/// Unpack a short-string box to its UTF-16 units.
pub fn unpack(b: u64) -> Option<Vec<u16>> {
    match tag_of(b)? {
        Tag::Empty => Some([].to_vec()),
        Tag::S1x16 => Some([((b >> 8) & 0xffff) as u16].to_vec()),
        Tag::S2x16 => Some([((b >> 8) & 0xffff) as u16, ((b >> 24) & 0xffff) as u16].to_vec()),
        Tag::S3x16 => Some(unpack_units(b >> 4, 3, 16)),
        Tag::S4x7 => Some(unpack_units(b >> 8, 4, 7)),
        Tag::S5x7 => Some(unpack_units(b >> 8, 5, 7)),
        Tag::S6x7 => Some(unpack_units(b >> 8, 6, 7)),
        Tag::S7x7 => Some(unpack_units(b >> 3, 7, 7)),
        Tag::S8x6 => {
            let codes = unpack_units(b >> 4, 8, 6);
            Some(codes.into_iter().map(|c| ALPHABET[c as usize]).collect())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_round_trip() {
        assert_eq!(unpack(EMPTY), Some([].to_vec()));
        assert_eq!(pack(&[]), Some(EMPTY));
        assert_eq!(tag_of(EMPTY), Some(Tag::Empty));
    }

    #[test]
    fn s1_s2_round_trip() {
        let a = pack(&[0x61]).unwrap();
        assert_eq!(unpack(a), Some([0x61].to_vec()));
        let ab = pack(&[0x61, 0x62]).unwrap();
        assert_eq!(unpack(ab), Some([0x61, 0x62].to_vec()));
        assert!(pack_enabled(&[0x61], V1_ENABLED).is_some());
        assert!(pack_enabled(&[0x61, 0x62, 0x63], V1_ENABLED).is_none());
        assert!(pack(&[0x61, 0x62, 0x63]).is_some());
        assert_eq!(V1_MASK, mask_of(V1_ENABLED));
        assert_eq!(tags_from_mask(V1_MASK), V1_ENABLED.to_vec());
        assert!(tags_from_mask(0).is_empty());
        assert_eq!(max_enabled_len(V1_ENABLED), Some(2));
        assert_eq!(max_enabled_len(&[]), None);
        assert_eq!(max_enabled_len(ALL_TAGS), Some(8));
    }

    #[test]
    fn junk_short_family_is_not_a_tag() {
        let junk = 0x7FF0_0000_0000_00E8;
        assert!(is_short(junk));
        assert_eq!(tag_of(junk), None);
        assert_eq!(unpack(junk), None);
    }
}
