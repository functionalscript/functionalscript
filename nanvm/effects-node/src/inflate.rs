//! `inflate`: one zlib stream (RFC 1950) holding DEFLATE data (RFC 1951), to the
//! bytes it holds. The Rust twin of `inflate` in `fjs/effects/node/module.mjs`,
//! which is the reference: the answer is at most [`MAX_FILE_SIZE_BYTES`], a
//! stream that inflates to more is refused rather than cut short, and bytes
//! after the end of the stream are refused. A failure carries the code and the
//! message Node's zlib gives, so a program that branches on either sees one host.
//!
//! The decoder owns no state beyond the output, and takes no dependency.

use crate::files::{IoError, MAX_FILE_SIZE_BYTES};

/// Why a stream is refused. [`Fail::Data`] is zlib's own message.
enum Fail {
    /// The stream is not valid: `Z_DATA_ERROR`.
    Data(&'static str),
    /// The input ends before the stream does: `Z_BUF_ERROR`.
    Short,
    /// The stream asks for a preset dictionary: `Z_NEED_DICT`.
    NeedDict,
    /// The output would pass [`MAX_FILE_SIZE_BYTES`].
    TooLarge,
}

impl From<Fail> for IoError {
    fn from(fail: Fail) -> IoError {
        let (code, message) = match fail {
            Fail::Data(message) => ("Z_DATA_ERROR", message.to_string()),
            Fail::Short => ("Z_BUF_ERROR", "unexpected end of file".to_string()),
            Fail::NeedDict => ("Z_NEED_DICT", "Missing dictionary".to_string()),
            Fail::TooLarge => (
                "ERR_BUFFER_TOO_LARGE",
                format!("Cannot create a Buffer larger than {MAX_FILE_SIZE_BYTES} bytes"),
            ),
        };
        IoError {
            code: Some(code.to_string()),
            message,
        }
    }
}

/// Inflates `data`, which is one whole zlib stream.
pub fn inflate(data: &[u8]) -> Result<Vec<u8>, IoError> {
    let mut input = Input {
        data,
        pos: 0,
        bits: 0,
        count: 0,
    };
    let out = stream(&mut input)?;
    let trailing = data.len() - input.pos;
    if trailing != 0 {
        return Err(IoError {
            code: Some("ERR_TRAILING_BYTES".to_string()),
            message: format!("{trailing} bytes after the end of the zlib stream"),
        });
    }
    Ok(out)
}

fn stream(input: &mut Input) -> Result<Vec<u8>, Fail> {
    header(input)?;
    let mut out = Vec::new();
    loop {
        let last = input.take(1)? == 1;
        match input.take(2)? {
            0 => stored(input, &mut out)?,
            1 => codes(input, &mut out, &fixed_literals(), &fixed_distances())?,
            2 => {
                let (literals, distances) = dynamic(input)?;
                codes(input, &mut out, &literals, &distances)?
            }
            _ => return Err(Fail::Data("invalid block type")),
        }
        if last {
            break;
        }
    }
    input.align();
    let adler = u32::from_be_bytes([input.byte()?, input.byte()?, input.byte()?, input.byte()?]);
    if adler != adler32(&out) {
        return Err(Fail::Data("incorrect data check"));
    }
    Ok(out)
}

/// The two bytes of RFC 1950 §2.2, in the order zlib checks them.
fn header(input: &mut Input) -> Result<(), Fail> {
    let cmf = u16::from(input.byte()?);
    let flg = u16::from(input.byte()?);
    if (cmf << 8 | flg) % 31 != 0 {
        return Err(Fail::Data("incorrect header check"));
    }
    if cmf & 0xf != 8 {
        return Err(Fail::Data("unknown compression method"));
    }
    if (cmf >> 4) + 8 > 15 {
        return Err(Fail::Data("invalid window size"));
    }
    if flg & 0x20 != 0 {
        return Err(Fail::NeedDict);
    }
    Ok(())
}

fn adler32(data: &[u8]) -> u32 {
    const MOD: u32 = 65_521;
    let (a, b) = data.iter().fold((1, 0), |(a, b), &x| {
        let a = (a + u32::from(x)) % MOD;
        (a, (b + a) % MOD)
    });
    b << 16 | a
}

/// The input and its bit position. DEFLATE packs bits from the least
/// significant end of each byte; only whole bytes are ever taken from `data`,
/// as they are needed, so `pos` is exactly how much of it the stream used.
struct Input<'a> {
    data: &'a [u8],
    pos: usize,
    bits: u32,
    count: u32,
}

impl Input<'_> {
    /// The next `n` bits, `n` at most 16.
    fn take(&mut self, n: u32) -> Result<u32, Fail> {
        while self.count < n {
            let byte = *self.data.get(self.pos).ok_or(Fail::Short)?;
            self.pos += 1;
            self.bits |= u32::from(byte) << self.count;
            self.count += 8;
        }
        let value = self.bits & ((1 << n) - 1);
        self.bits >>= n;
        self.count -= n;
        Ok(value)
    }

    /// Drops the bits left of the byte being read.
    fn align(&mut self) {
        self.bits = 0;
        self.count = 0;
    }

    /// The next whole byte, once aligned.
    fn byte(&mut self) -> Result<u8, Fail> {
        let byte = *self.data.get(self.pos).ok_or(Fail::Short)?;
        self.pos += 1;
        Ok(byte)
    }
}

/// A block of bytes copied as they are: `LEN`, its complement, then `LEN` bytes.
fn stored(input: &mut Input, out: &mut Vec<u8>) -> Result<(), Fail> {
    input.align();
    let len = u16::from_le_bytes([input.byte()?, input.byte()?]);
    let complement = u16::from_le_bytes([input.byte()?, input.byte()?]);
    if len != !complement {
        return Err(Fail::Data("invalid stored block lengths"));
    }
    let len = usize::from(len);
    let bytes = input
        .data
        .get(input.pos..input.pos + len)
        .ok_or(Fail::Short)?;
    if out.len() + len > MAX_FILE_SIZE_BYTES as usize {
        return Err(Fail::TooLarge);
    }
    out.extend_from_slice(bytes);
    input.pos += len;
    Ok(())
}

/// A canonical Huffman code, as `puff` holds one: how many codes there are of
/// each length, and the symbols in code order.
struct Code {
    count: [u16; 16],
    symbol: Vec<u16>,
    /// Not every bit string is a code: the lone one-bit code, or none at all.
    incomplete: bool,
}

impl Code {
    /// The code a list of lengths names, or `None` where zlib refuses it: more
    /// codes of a length than that length has, or fewer than all of them. The
    /// one incomplete code zlib takes is a single code of one bit, which is how
    /// a stream spells a lone distance; `complete` says an incomplete code is
    /// refused even so, as the code-lengths code is.
    fn new(lengths: &[u8], complete: bool) -> Option<Code> {
        let mut count = [0u16; 16];
        for &length in lengths {
            count[usize::from(length)] += 1;
        }
        let used = lengths.len() - usize::from(count[0]);
        let mut left = 1i32;
        for &n in &count[1..] {
            left = (left << 1) - i32::from(n);
            if left < 0 {
                return None;
            }
        }
        let longest = count.iter().rposition(|&n| n != 0).unwrap_or(0);
        if left > 0 && used != 0 && (complete || longest != 1) {
            return None;
        }
        let mut offset = [0u16; 16];
        for length in 1..15 {
            offset[length + 1] = offset[length] + count[length];
        }
        let mut symbol = vec![0u16; used];
        for (s, &length) in lengths.iter().enumerate() {
            if length != 0 {
                symbol[usize::from(offset[usize::from(length)])] = s as u16;
                offset[usize::from(length)] += 1;
            }
        }
        Some(Code {
            count,
            symbol,
            incomplete: left > 0,
        })
    }

    /// The next symbol, or `None` where the bits are no code of this one.
    fn decode(&self, input: &mut Input) -> Result<Option<u16>, Fail> {
        let (mut code, mut first, mut index) = (0i32, 0i32, 0i32);
        for length in 1..16 {
            code |= input.take(1)? as i32;
            let count = i32::from(self.count[length]);
            if code - count < first {
                return Ok(Some(self.symbol[(index + (code - first)) as usize]));
            }
            index += count;
            first = (first + count) << 1;
            code <<= 1;
            // zlib refuses an incomplete code after one bit, not after all
            // fifteen.
            if self.incomplete {
                break;
            }
        }
        Ok(None)
    }
}

fn fixed_literals() -> Code {
    let mut lengths = [8u8; 288];
    lengths[144..256].fill(9);
    lengths[256..280].fill(7);
    Code::new(&lengths, true).expect("the fixed literal code is complete")
}

/// 32 codes of five bits, the last two of which name no distance.
fn fixed_distances() -> Code {
    Code::new(&[5u8; 32], true).expect("the fixed distance code is complete")
}

/// The order the lengths of the code-lengths code come in, RFC 1951 §3.2.7.
const CODE_LENGTH_ORDER: [usize; 19] = [
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

/// The literal/length and distance codes a dynamic block states.
fn dynamic(input: &mut Input) -> Result<(Code, Code), Fail> {
    let literals = input.take(5)? as usize + 257;
    let distances = input.take(5)? as usize + 1;
    let lengths_count = input.take(4)? as usize + 4;
    if literals > 286 || distances > 30 {
        return Err(Fail::Data("too many length or distance symbols"));
    }
    let mut order = [0u8; 19];
    for &slot in &CODE_LENGTH_ORDER[..lengths_count] {
        order[slot] = input.take(3)? as u8;
    }
    let lengths_code = Code::new(&order, true).ok_or(Fail::Data("invalid code lengths set"))?;
    let mut lengths = [0u8; 286 + 30];
    let total = literals + distances;
    let mut at = 0;
    while at < total {
        // zlib reads a length of 0 for each bit of a code-lengths code that
        // has no symbol, and fails later for the end-of-block it lacks.
        let symbol = if lengths_code.symbol.is_empty() {
            input.take(1)?;
            0
        } else {
            lengths_code
                .decode(input)?
                .ok_or(Fail::Data("invalid code lengths set"))?
        };
        if symbol < 16 {
            lengths[at] = symbol as u8;
            at += 1;
            continue;
        }
        let (value, repeat) = match symbol {
            16 => {
                if at == 0 {
                    return Err(Fail::Data("invalid bit length repeat"));
                }
                (lengths[at - 1], 3 + input.take(2)? as usize)
            }
            17 => (0, 3 + input.take(3)? as usize),
            _ => (0, 11 + input.take(7)? as usize),
        };
        if at + repeat > total {
            return Err(Fail::Data("invalid bit length repeat"));
        }
        lengths[at..at + repeat].fill(value);
        at += repeat;
    }
    if lengths[256] == 0 {
        return Err(Fail::Data("invalid code -- missing end-of-block"));
    }
    let literals_code =
        Code::new(&lengths[..literals], false).ok_or(Fail::Data("invalid literal/lengths set"))?;
    let distances_code =
        Code::new(&lengths[literals..total], false).ok_or(Fail::Data("invalid distances set"))?;
    Ok((literals_code, distances_code))
}

/// The base and the extra bits of the length symbols 257 to 285.
const LENGTHS: [(u16, u32); 29] = [
    (3, 0),
    (4, 0),
    (5, 0),
    (6, 0),
    (7, 0),
    (8, 0),
    (9, 0),
    (10, 0),
    (11, 1),
    (13, 1),
    (15, 1),
    (17, 1),
    (19, 2),
    (23, 2),
    (27, 2),
    (31, 2),
    (35, 3),
    (43, 3),
    (51, 3),
    (59, 3),
    (67, 4),
    (83, 4),
    (99, 4),
    (115, 4),
    (131, 5),
    (163, 5),
    (195, 5),
    (227, 5),
    (258, 0),
];

/// The base and the extra bits of the distance symbols 0 to 29.
const DISTANCES: [(u16, u32); 30] = [
    (1, 0),
    (2, 0),
    (3, 0),
    (4, 0),
    (5, 1),
    (7, 1),
    (9, 2),
    (13, 2),
    (17, 3),
    (25, 3),
    (33, 4),
    (49, 4),
    (65, 5),
    (97, 5),
    (129, 6),
    (193, 6),
    (257, 7),
    (385, 7),
    (513, 8),
    (769, 8),
    (1025, 9),
    (1537, 9),
    (2049, 10),
    (3073, 10),
    (4097, 11),
    (6145, 11),
    (8193, 12),
    (12289, 12),
    (16385, 13),
    (24577, 13),
];

/// A block of literals and back references, up to its end-of-block symbol.
fn codes(
    input: &mut Input,
    out: &mut Vec<u8>,
    literals: &Code,
    distances: &Code,
) -> Result<(), Fail> {
    loop {
        let symbol = literals
            .decode(input)?
            .ok_or(Fail::Data("invalid literal/length code"))?;
        match symbol {
            0..=255 => {
                if out.len() >= MAX_FILE_SIZE_BYTES as usize {
                    return Err(Fail::TooLarge);
                }
                out.push(symbol as u8);
            }
            256 => return Ok(()),
            _ => {
                let &(base, extra) = LENGTHS
                    .get(usize::from(symbol - 257))
                    .ok_or(Fail::Data("invalid literal/length code"))?;
                let length = usize::from(base) + input.take(extra)? as usize;
                let symbol = distances
                    .decode(input)?
                    .ok_or(Fail::Data("invalid distance code"))?;
                let &(base, extra) = DISTANCES
                    .get(usize::from(symbol))
                    .ok_or(Fail::Data("invalid distance code"))?;
                let distance = usize::from(base) + input.take(extra)? as usize;
                if distance > out.len() {
                    return Err(Fail::Data("invalid distance too far back"));
                }
                if out.len() + length > MAX_FILE_SIZE_BYTES as usize {
                    return Err(Fail::TooLarge);
                }
                // One byte at a time: a distance shorter than the length
                // copies bytes this very copy wrote.
                for _ in 0..length {
                    out.push(out[out.len() - distance]);
                }
            }
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn bytes(hex: &str) -> Vec<u8> {
        (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect()
    }

    /// `(code, message)` of a refused stream.
    fn refused(data: &[u8]) -> (String, String) {
        let IoError { code, message } = inflate(data).unwrap_err();
        (code.unwrap(), message)
    }

    fn data_error(data: &[u8], message: &str) {
        assert_eq!(refused(data), ("Z_DATA_ERROR".into(), message.into()));
    }

    /// `n` zero bytes as stored blocks, so the stream is valid for any size.
    fn zeros(n: usize) -> Vec<u8> {
        let mut data = vec![0x78, 0x01];
        let mut left = n;
        loop {
            let len = left.min(0xffff);
            left -= len;
            data.push(u8::from(left == 0));
            data.extend_from_slice(&(len as u16).to_le_bytes());
            data.extend_from_slice(&(!(len as u16)).to_le_bytes());
            data.resize(data.len() + len, 0);
            if left == 0 {
                break;
            }
        }
        data.extend_from_slice(&adler32(&vec![0; n]).to_be_bytes());
        data
    }

    // The vectors below are `zlib.deflateSync` output of Node, and the errors
    // are what `zlib.inflateSync` answers for the same input.

    #[test]
    fn stored_block() {
        assert_eq!(
            inflate(&bytes("7801010300fcff616263024d0127")),
            Ok(b"abc".to_vec())
        );
    }

    #[test]
    fn fixed_block() {
        assert_eq!(
            inflate(&bytes("7801cb48cdc9c957c8402701680308b1")),
            Ok(b"hello hello hello hello".to_vec())
        );
    }

    #[test]
    fn dynamic_block() {
        let data = bytes(
            "789c2bc94855282ccd4cce56482aca2fcf5348cbaf50c82acd2d2856c82f4b2d5228014ae72456552aa4e4a7eb8179a38a47158f2aa6aa6200e521459c",
        );
        assert_eq!(
            inflate(&data),
            Ok("the quick brown fox jumps over the lazy dog. "
                .repeat(20)
                .into_bytes())
        );
    }

    /// A distance shorter than the length copies what the copy has written.
    #[test]
    fn overlapping_copy() {
        assert_eq!(
            inflate(&bytes("789c4b4ca43d00007a4725e5")),
            Ok(vec![b'a'; 100])
        );
    }

    #[test]
    fn empty_stream() {
        assert_eq!(inflate(&bytes("789c030000000001")), Ok(Vec::new()));
    }

    /// The bound is the size itself: one byte more is refused, not cut short.
    #[test]
    fn bound() {
        let cap = MAX_FILE_SIZE_BYTES as usize;
        assert_eq!(inflate(&zeros(cap)), Ok(vec![0; cap]));
        let message = format!("Cannot create a Buffer larger than {cap} bytes");
        assert_eq!(
            refused(&zeros(cap + 1)),
            ("ERR_BUFFER_TOO_LARGE".into(), message)
        );
    }

    #[test]
    fn bound_in_a_block_of_codes() {
        // Fixed-Huffman: a literal, then a copy of 258 bytes at distance 1,
        // over and over: the output passes the bound inside a copy.
        let mut stream = vec![0x78, 0x01];
        let mut bits = Vec::<bool>::new();
        let mut put = |value: u32, n: u32, msb_first: bool| {
            for i in 0..n {
                let shift = if msb_first { n - 1 - i } else { i };
                bits.push(value >> shift & 1 == 1);
            }
        };
        put(1, 1, false); // last
        put(1, 2, false); // fixed
        put(0x30, 8, true); // literal 0
        for _ in 0..600 {
            put(0xc0 + 285 - 280, 8, true); // symbol 285, length 258
            put(0, 5, true); // distance symbol 0, distance 1
        }
        put(0, 7, true); // end of block
        for chunk in bits.chunks(8) {
            stream.push(
                chunk
                    .iter()
                    .enumerate()
                    .fold(0u8, |b, (i, &x)| b | u8::from(x) << i),
            );
        }
        stream.extend_from_slice(&[0; 4]);
        assert_eq!(refused(&stream).0, "ERR_BUFFER_TOO_LARGE");
    }

    /// The bound reached by a literal: `n` zero bytes in stored blocks, then a
    /// last block of fixed codes holding one literal and the end of the block.
    /// The stored blocks and the copies each guard their own bound, so only this
    /// pins the literal's: with `>` in place of `>=` the stream of `cap` bytes
    /// answers `cap + 1`, where Node refuses it.
    #[test]
    fn bound_at_a_literal() {
        let stream = |n: usize| {
            let mut data = vec![0x78, 0x01];
            let mut left = n;
            while left > 0 {
                let len = left.min(0xffff);
                left -= len;
                data.push(0);
                data.extend_from_slice(&(len as u16).to_le_bytes());
                data.extend_from_slice(&(!(len as u16)).to_le_bytes());
                data.resize(data.len() + len, 0);
            }
            // BFINAL, fixed, the literal 0 (00110000), the end of the block (0000000)
            data.extend_from_slice(&[0x63, 0x00, 0x00]);
            data.extend_from_slice(&adler32(&vec![0; n + 1]).to_be_bytes());
            data
        };
        let cap = MAX_FILE_SIZE_BYTES as usize;
        assert_eq!(inflate(&stream(cap - 1)), Ok(vec![0; cap]));
        assert_eq!(refused(&stream(cap)).0, "ERR_BUFFER_TOO_LARGE");
    }

    /// A stored block that declares a byte it does not carry is a short input,
    /// even where that byte would pass the bound: zlib reads before it counts.
    #[test]
    fn short_stored_block_at_the_bound() {
        let mut data = vec![0x78, 0x01];
        let cap = MAX_FILE_SIZE_BYTES as usize;
        let mut left = cap;
        while left > 0 {
            let len = left.min(0xffff);
            left -= len;
            data.push(0);
            data.extend_from_slice(&(len as u16).to_le_bytes());
            data.extend_from_slice(&(!(len as u16)).to_le_bytes());
            data.resize(data.len() + len, 0);
        }
        // BFINAL stored, LEN 1, its complement, and no byte.
        data.extend_from_slice(&[1, 1, 0, 0xfe, 0xff]);
        assert_eq!(
            refused(&data),
            ("Z_BUF_ERROR".into(), "unexpected end of file".into())
        );
    }

    #[test]
    fn trailing_bytes() {
        let mut data = bytes("7801cb48cdc9c957c8402701680308b1");
        data.extend_from_slice(&[1, 2, 3]);
        assert_eq!(
            refused(&data),
            (
                "ERR_TRAILING_BYTES".into(),
                "3 bytes after the end of the zlib stream".into()
            )
        );
    }

    #[test]
    fn header() {
        data_error(&[0x78, 0x9d], "incorrect header check");
        data_error(&[0x00, 0x00], "unknown compression method");
        data_error(&[0x88, 0x1c], "invalid window size");
        assert_eq!(
            refused(&[0x78, 0xbb, 0, 0, 0, 0]),
            ("Z_NEED_DICT".into(), "Missing dictionary".into())
        );
    }

    #[test]
    fn blocks() {
        data_error(&[0x78, 0x9c, 0x07], "invalid block type");
        data_error(
            &[0x78, 0x9c, 0x01, 0x01, 0x00, 0x00, 0x00, 0x61],
            "invalid stored block lengths",
        );
        // A copy of 3 at distance 1, with nothing before it.
        data_error(
            &[0x78, 0x9c, 0x03, 0x02, 0x00],
            "invalid distance too far back",
        );
    }

    #[test]
    fn checksum() {
        let mut data = bytes("7801cb48cdc9c957c8402701680308b1");
        *data.last_mut().unwrap() ^= 1;
        data_error(&data, "incorrect data check");
    }

    /// Input that ends before the stream does, wherever it ends.
    #[test]
    fn truncated() {
        let whole = bytes(
            "789c2bc94855282ccd4cce56482aca2fcf5348cbaf50c82acd2d2856c82f4b2d5228014ae72456552aa4e4a7eb8179a38a47158f2aa6aa6200e521459c",
        );
        for end in 0..whole.len() {
            assert_eq!(
                refused(&whole[..end]),
                ("Z_BUF_ERROR".into(), "unexpected end of file".into()),
                "{end}"
            );
        }
        assert_eq!(
            refused(&[0x78, 0x9c, 0x01, 0x03, 0x00, 0xfc, 0xff, 0x61]).0,
            "Z_BUF_ERROR"
        );
    }

    /// Malformed dynamic blocks, one for each way the code is stated wrongly.
    #[test]
    fn dynamic_header() {
        // Bits of a dynamic block header, packed least significant first.
        fn block(fields: &[(u32, u32)]) -> Vec<u8> {
            let mut data = vec![0x78, 0x9c];
            let (mut byte, mut used) = (0u32, 0u32);
            for &(value, n) in fields {
                for i in 0..n {
                    byte |= (value >> i & 1) << used;
                    used += 1;
                    if used == 8 {
                        data.push(byte as u8);
                        (byte, used) = (0, 0);
                    }
                }
            }
            if used != 0 {
                data.push(byte as u8);
            }
            data.extend_from_slice(&[0; 8]);
            data
        }
        let head = [(1, 1), (2, 2)];
        // 287 literal/length symbols: HLIT is 30 over the 257.
        data_error(
            &block(&[head[0], head[1], (30, 5), (0, 5), (0, 4)]),
            "too many length or distance symbols",
        );
        // All 19 code-length symbols given length 1: over-subscribed.
        let mut over = vec![head[0], head[1], (0, 5), (0, 5), (15, 4)];
        over.extend(std::iter::repeat_n((1, 3), 19));
        data_error(&block(&over), "invalid code lengths set");
        // Symbols 16 and 0 have one bit each, a complete code; the first
        // symbol read is 16, a repeat of a length there is none of.
        let repeat = [
            head[0],
            head[1],
            (0, 5),
            (0, 5),
            (0, 4),
            (1, 3),
            (0, 3),
            (0, 3),
            (1, 3),
            (1, 1),
            (0, 2),
        ];
        data_error(&block(&repeat), "invalid bit length repeat");
    }

    /// A stream with no end-of-block symbol, and codes that are not codes.
    #[test]
    fn code_sets() {
        // Fixed block ending in the unused literal/length symbol 286.
        data_error(
            &[0x78, 0x9c, 0x1b, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00],
            "invalid literal/length code",
        );
    }

    /// A code-lengths code with no symbol reads a length of 0 per bit, in zlib:
    /// the input ends first, or the block lacks its end-of-block symbol.
    #[test]
    fn empty_code_lengths_code() {
        let short = [0x78, 0xda, 0x6d, 0, 0, 0, 0, 0x01];
        assert_eq!(
            refused(&short),
            ("Z_BUF_ERROR".into(), "unexpected end of file".into())
        );
        let mut long = short.to_vec();
        long.extend_from_slice(&[0; 80]);
        data_error(&long, "invalid code -- missing end-of-block");
    }

    #[test]
    fn adler32_of_known_text() {
        assert_eq!(adler32(b"Wikipedia"), 0x11e6_0398);
    }
}
