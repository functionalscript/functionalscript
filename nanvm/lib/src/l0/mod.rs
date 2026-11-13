//! L0, the core of the WASM runtime interface
//! ([`l0-design.md`](../../../../doc/sasha-gil/wasm/l0-design.md)), as typed
//! Rust over [`Any`].
//!
//! One function per L0 function, under its L0 name, generic over [`IVm`].
//! The types are Rust's, not the ABI's: an index is a `u32`, the bytes of
//! a string or a bigint are a slice, a container is built through a
//! [`Builder`], and [`call`] answers a `Result`. `dup` and `drop` are
//! `Clone` and `Drop`, and an argument is borrowed unless the design says
//! the function takes it.
//!
//! Where WASM traps, a function here panics, with the text the
//! FunctionalScript view of L0 throws, `l0.<name>: <reason>`, so the tests
//! below and that view's proofs check the same preconditions.
//!
//! An object answers its properties as [`Object::own_entries`] lists them:
//! each key once, array-index keys first, as a JavaScript host and the
//! FunctionalScript view do. NaNVM keeps an object's properties as they
//! were written, so a read computes that view each time.

pub mod abi;

#[cfg(test)]
mod test;

use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{
        Any, Array, BigInt, Function, IFunction, IVm, Nullish, Number, Object, Property,
        StaticCode, String, ToAny, ToArray, ToObject, ToString, Unpacked,
    },
};

/// A value's kind, as L0 `kind` answers it. The tags are part of the ABI
/// version.
#[repr(u8)]
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Kind {
    Undefined = 0,
    Null = 1,
    Boolean = 2,
    Number = 3,
    String = 4,
    BigInt = 5,
    Array = 6,
    Object = 7,
    Function = 8,
}

/// The panic of a broken precondition: what traps in WASM.
fn trap(name: &str, reason: &str) -> ! {
    panic!("l0.{name}: {reason}")
}

fn unpack<A: IVm>(v: &Any<A>) -> Unpacked<A> {
    v.clone().into()
}

/// L0 `kind`.
pub fn kind<A: IVm>(v: &Any<A>) -> Kind {
    match unpack(v) {
        Unpacked::Nullish(Nullish::Undefined) => Kind::Undefined,
        Unpacked::Nullish(Nullish::Null) => Kind::Null,
        Unpacked::Boolean(_) => Kind::Boolean,
        Unpacked::Number(_) => Kind::Number,
        Unpacked::String(_) => Kind::String,
        Unpacked::BigInt(_) => Kind::BigInt,
        Unpacked::Array(_) => Kind::Array,
        Unpacked::Object(_) => Kind::Object,
        Unpacked::Function(_) => Kind::Function,
    }
}

// Casts: the typed value inside an `any` of a known kind, or the trap.

fn as_string<A: IVm>(name: &str, v: &Any<A>) -> String<A> {
    v.clone()
        .try_into()
        .unwrap_or_else(|_| trap(name, "not a string"))
}

fn as_bigint<A: IVm>(name: &str, v: &Any<A>) -> BigInt<A> {
    v.clone()
        .try_into()
        .unwrap_or_else(|_| trap(name, "not a bigint"))
}

fn as_array<A: IVm>(name: &str, v: &Any<A>) -> Array<A> {
    v.clone()
        .try_into()
        .unwrap_or_else(|_| trap(name, "not an array"))
}

fn as_object<A: IVm>(name: &str, v: &Any<A>) -> Object<A> {
    v.clone()
        .try_into()
        .unwrap_or_else(|_| trap(name, "not an object"))
}

fn as_function<A: IVm>(name: &str, v: &Any<A>) -> Function<A> {
    v.clone()
        .try_into()
        .unwrap_or_else(|_| trap(name, "not a function"))
}

/// `i` when it indexes `n` positions.
fn index(name: &str, i: u32, n: u32) -> u32 {
    if i >= n {
        trap(name, "not an index")
    }
    i
}

// Scalars.

/// L0 `undefined`.
pub fn undefined<A: IVm>() -> Any<A> {
    Any::undefined()
}

/// L0 `null`.
pub fn null<A: IVm>() -> Any<A> {
    Nullish::Null.to_any()
}

/// L0 `to_f64`.
pub fn to_f64<A: IVm>(v: &Any<A>) -> f64 {
    let n: Number = v
        .clone()
        .try_into()
        .unwrap_or_else(|_| trap("to_f64", "not a number"));
    n.into()
}

/// L0 `from_f64`. A `NaN` loses its payload.
pub fn from_f64<A: IVm>(x: f64) -> Any<A> {
    Number::from(x).to_any()
}

/// L0 `to_bool`.
pub fn to_bool<A: IVm>(v: &Any<A>) -> bool {
    v.clone()
        .try_into()
        .unwrap_or_else(|_| trap("to_bool", "not a boolean"))
}

/// L0 `from_bool`, which also makes the constants `true` and `false`.
pub fn from_bool<A: IVm>(b: bool) -> Any<A> {
    b.to_any()
}

// Bytes.

/// L0 `make_string`: a string of UTF-16 units.
pub fn make_string<A: IVm>(units: &[u16]) -> Any<A> {
    fits("make_string", units.len() as u64);
    units.iter().copied().to_string().to_any()
}

/// L0 `read_units`: the units of `s` from `start`, as many as `out` holds.
pub fn read_units<A: IVm>(s: &Any<A>, start: u32, out: &mut [u16]) {
    let s = as_string("read_units", s);
    let range = range("read_units", start, out.len(), s.length());
    for (o, i) in out.iter_mut().zip(range) {
        *o = s[i];
    }
}

/// L0 `make_bigint`: a sign, `0`, `1` or `-1`, and a magnitude in `u64`
/// words, least significant first, in its canonical form only: no leading
/// zero word, and the sign `0` for zero alone
/// ([`l0-design.md` §19](../../../../doc/sasha-gil/wasm/l0-design.md#19-bigints-are-canonical)).
pub fn make_bigint<A: IVm>(sign: i32, words: &[u64]) -> Any<A> {
    let sign = match (sign, words.last()) {
        (0, None) => Sign::Positive,
        (1, Some(&w)) if w != 0 => Sign::Positive,
        (-1, Some(&w)) if w != 0 => Sign::Negative,
        _ => trap("make_bigint", "not canonical"),
    };
    BigInt::<A>::normalize_new(sign, words.iter().copied()).to_any()
}

/// L0 `sign`: `0` for zero, `1` for a positive bigint and `-1` for a
/// negative one.
pub fn sign<A: IVm>(b: &Any<A>) -> i32 {
    let b = as_bigint("sign", b);
    if b.length() == 0 {
        return 0;
    }
    match b.sign() {
        Sign::Positive => 1,
        Sign::Negative => -1,
    }
}

/// L0 `read_words`: the words of `b`'s magnitude from `start`, as many as
/// `out` holds.
pub fn read_words<A: IVm>(b: &Any<A>, start: u32, out: &mut [u64]) {
    let b = as_bigint("read_words", b);
    let range = range("read_words", start, out.len(), b.length());
    for (o, i) in out.iter_mut().zip(range) {
        *o = b[i];
    }
}

/// The positions `start..start + len` when they lie inside `n`.
fn range(name: &str, start: u32, len: usize, n: u32) -> core::ops::Range<u32> {
    match u32::try_from(len)
        .ok()
        .and_then(|len| start.checked_add(len))
    {
        Some(end) if end <= n => start..end,
        _ => trap(name, "not a range"),
    }
}

// Strings.

/// A string's length is a `u32`: a longer one traps, as running out of
/// memory does, rather than wrap.
fn fits(name: &str, len: u64) {
    if len > u64::from(u32::MAX) {
        trap(name, "too long")
    }
}

/// L0 `unit`: the UTF-16 unit `i` of a string.
pub fn unit<A: IVm>(s: &Any<A>, i: u32) -> u16 {
    let s = as_string("unit", s);
    s[index("unit", i, s.length())]
}

/// L0 `from_unit`: the string of one UTF-16 unit.
pub fn from_unit<A: IVm>(u: u16) -> Any<A> {
    [u].to_string().to_any()
}

/// L0 `concat`: two strings joined.
pub fn concat<A: IVm>(a: &Any<A>, b: &Any<A>) -> Any<A> {
    let a = as_string("concat", a);
    let b = as_string("concat", b);
    fits("concat", u64::from(a.length()) + u64::from(b.length()));
    a.index_iter().chain(b.index_iter()).to_string().to_any()
}

/// L0 `substring`: the units of `s` from `start` up to `end`, where
/// `start <= end <= length`. It neither clamps nor counts from the end.
pub fn substring<A: IVm>(s: &Any<A>, start: u32, end: u32) -> Any<A> {
    let s = as_string("substring", s);
    let end = index("substring", end, s.length() + 1);
    let start = index("substring", start, end + 1);
    (start..end).map(|i| s[i]).to_string().to_any()
}

/// L0 `join`: the strings of an array joined, with `separator` between two
/// of them ([`l0-design.md` §22](../../../../doc/sasha-gil/wasm/l0-design.md#22-building-in-one-pass)).
/// Each item and the separator must be strings.
pub fn join<A: IVm>(parts: &Any<A>, separator: &Any<A>) -> Any<A> {
    let parts = as_array("join", parts);
    let separator = as_string("join", separator);
    let parts: Vec<String<A>> = parts.index_iter().map(|p| as_string("join", &p)).collect();
    let len = parts.iter().map(|p| u64::from(p.length())).sum::<u64>()
        + u64::from(separator.length()) * parts.len().saturating_sub(1) as u64;
    fits("join", len);
    let mut units: Vec<u16> = Vec::with_capacity(len as usize);
    for (i, p) in parts.into_iter().enumerate() {
        if i > 0 {
            units.extend(separator.clone().index_iter());
        }
        units.extend(p.index_iter());
    }
    units.to_string().to_any()
}

// Containers.

/// An open container: what L0's `begin_array` and `begin_object` answer,
/// filled by `push` or `push_property` with exactly the number of items it
/// was begun with, then sealed.
pub struct Builder<A: IVm> {
    len: u32,
    items: Items<A>,
}

enum Items<A: IVm> {
    Array(Vec<Any<A>>),
    Object(Vec<Property<A>>),
}

impl<A: IVm> Builder<A> {
    fn count(&self) -> usize {
        match &self.items {
            Items::Array(items) => items.len(),
            Items::Object(properties) => properties.len(),
        }
    }

    fn has_room(&self, name: &str) {
        if self.count() >= self.len as usize {
            trap(name, "full")
        }
    }

    /// L0 `push`: the next item of an array. It takes `v`.
    pub fn push(&mut self, v: Any<A>) {
        self.has_room("push");
        match &mut self.items {
            Items::Array(items) => items.push(v),
            Items::Object(_) => trap("push", "not an array builder"),
        }
    }

    /// L0 `push_property`: the next property of an object. It takes `key`,
    /// which must be a string, and `v`.
    pub fn push_property(&mut self, key: Any<A>, v: Any<A>) {
        self.has_room("push_property");
        let key = as_string("push_property", &key);
        match &mut self.items {
            Items::Object(properties) => properties.push((key, v)),
            Items::Array(_) => trap("push_property", "not an object builder"),
        }
    }

    /// L0 `seal`: the container. An object keeps each key once, at its
    /// first position with its last value, as the literal `{ a: 1, a: 2 }`
    /// does.
    pub fn seal(self) -> Any<A> {
        if self.count() != self.len as usize {
            trap("seal", "not full")
        }
        match self.items {
            Items::Array(items) => items.to_array().to_any(),
            Items::Object(properties) => {
                let o: Object<A> = properties.to_object();
                o.own_entries().to_object().to_any()
            }
        }
    }
}

/// L0 `begin_array`: a builder of an array of `len` items.
pub fn begin_array<A: IVm>(len: u32) -> Builder<A> {
    Builder {
        len,
        items: Items::Array(Vec::with_capacity(len as usize)),
    }
}

/// L0 `begin_object`: a builder of an object of `len` properties, before
/// repeated keys merge.
pub fn begin_object<A: IVm>(len: u32) -> Builder<A> {
    Builder {
        len,
        items: Items::Object(Vec::with_capacity(len as usize)),
    }
}

/// L0 `length`
/// ([`l0-design.md` §18](../../../../doc/sasha-gil/wasm/l0-design.md#18-what-length-item-and-key-mean-for-each-kind)):
/// a string's UTF-16 units, a bigint's `u64` words, an array's items, an
/// object's properties, and a function's declared parameters.
pub fn length<A: IVm>(v: &Any<A>) -> u32 {
    match unpack(v) {
        Unpacked::String(s) => s.length(),
        Unpacked::BigInt(b) => b.length(),
        Unpacked::Array(a) => a.length(),
        Unpacked::Object(o) => o.own_entries().len() as u32,
        Unpacked::Function(f) => f.length(),
        _ => trap(
            "length",
            "not a string, a bigint, an array, an object or a function",
        ),
    }
}

/// L0 `item`: the item `i` of an array, or the value of the property `i`
/// of an object.
pub fn item<A: IVm>(v: &Any<A>, i: u32) -> Any<A> {
    match unpack(v) {
        Unpacked::Array(a) => a[index("item", i, a.length())].clone(),
        Unpacked::Object(o) => property("item", &o, i).1,
        _ => trap("item", "not an array or an object"),
    }
}

/// L0 `key`: the key of the property `i` of an object.
pub fn key<A: IVm>(o: &Any<A>, i: u32) -> Any<A> {
    property("key", &as_object("key", o), i).0.to_any()
}

fn property<A: IVm>(name: &str, o: &Object<A>, i: u32) -> Property<A> {
    let mut entries = o.own_entries();
    let i = index(name, i, entries.len() as u32);
    entries.swap_remove(i as usize)
}

/// L0 `find`: the index of the property `key` of an object, or `-1`. The
/// key must be a string.
pub fn find<A: IVm>(o: &Any<A>, key: &Any<A>) -> i32 {
    let o = as_object("find", o);
    let key = as_string("find", key);
    o.own_entries()
        .iter()
        .position(|(k, _)| *k == key)
        .map_or(-1, |i| i as i32)
}

// Functions.

/// L0 `make_function`: a function of `code` over `frame`, a sealed array,
/// declaring `length` parameters. NaNVM keeps a function's text as a
/// `&'static str`, where L0 passes a string value.
pub fn make_function<A: IVm>(
    code: StaticCode<A>,
    frame: Any<A>,
    length: u32,
    text: Option<&'static str>,
) -> Any<A> {
    let frame = as_array("make_function", &frame);
    A::static_function(code, length, frame, text).to_any()
}

/// L0 `call`: `f` called with `args`, a sealed array. `Err` is a thrown
/// value, status 1 in the ABI.
pub fn call<A: IVm>(f: &Any<A>, args: &Any<A>) -> Result<Any<A>, Any<A>> {
    let f = as_function("call", f);
    f.call(as_array("call", args))
}

/// L0 `frame`: the item `i` of the frame of the function whose code is
/// running, read through the code's `self_`.
pub fn frame<A: IVm>(self_: &A::InternalFunction, i: u32) -> Any<A> {
    let frame = A::frame(self_);
    frame[index("frame", i, frame.length())].clone()
}

/// L0 `text`: a function's text, or `undefined` for a function that has
/// none.
pub fn text<A: IVm>(f: &Any<A>) -> Any<A> {
    as_function("text", f)
        .internal()
        .text()
        .map_or_else(Any::undefined, Any::from)
}

// Identity.

/// L0 `same`: whether two arrays, objects or functions are the same value.
/// A primitive traps: L1 compares those by content.
pub fn same<A: IVm>(a: &Any<A>, b: &Any<A>) -> bool {
    match (unpack(a), unpack(b)) {
        (Unpacked::Array(a), Unpacked::Array(b)) => a == b,
        (Unpacked::Object(a), Unpacked::Object(b)) => a == b,
        (Unpacked::Function(a), Unpacked::Function(b)) => a == b,
        (
            Unpacked::Array(_) | Unpacked::Object(_) | Unpacked::Function(_),
            Unpacked::Array(_) | Unpacked::Object(_) | Unpacked::Function(_),
        ) => false,
        _ => trap("same", "not an array, an object or a function"),
    }
}
