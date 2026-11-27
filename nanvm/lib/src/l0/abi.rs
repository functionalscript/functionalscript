//! L0's ABI over handles: step 2 of
//! [`todo/l0-interface.md`](../../todo/l0-interface.md).
//!
//! The functions a compiled program imports from `fjs:l0`, with the WASM
//! types of the [summary](../../../../doc/sasha-gil/wasm/l0-design.md#summary),
//! over [`super`], the typed L0. Natively it is tested here; step 3,
//! [`nanvm/l0-wasm`](../../../l0-wasm/src/lib.rs), exports it from a
//! `.wasm`.
//!
//! - **A value is an `i64` NaN box** of
//!   [Sergey's layout](../../../../doc/sergey-shandar/nanvm/README.md), as
//!   [`runtime-in-ir.md`](../../../../doc/sasha-gil/ir/runtime-in-ir.md)
//!   choices 1 and 2 say. A number is its own `f64` bits, with one NaN,
//!   and `undefined`, `null`, `false` and `true` are the four constants:
//!   these take no slot, `dup` answers them as they are and `drop` leaves
//!   them alone. Every other value is a reference,
//!   `0x7FF | kind << 48 | handle << 2`: `kind` is L0's kind, and the
//!   handle is an index into a table of `naive` values, 32 bits, with the
//!   slot's generation in the 14 above, so a handle used after its `drop`
//!   traps even when its slot holds a new value. A reference is one owned
//!   handle: `dup` makes a new one and `drop` frees one.
//! - **A builder is an `i32` handle,** an index into a table of open
//!   builders, with a generation the same way.
//! - **Bytes** cross through [`with_memory`], which stands in for the
//!   memory the loader makes, or through a host's own buffer:
//!   [`make_string_of`], [`read_units_into`], [`make_bigint_of`] and
//!   [`read_words_into`], as the `.wasm` reads its linear memory.
//! - **Code** is a [`Code`] in a table, [`add_code`], which stands in for
//!   the shared WASM table. A function L0 makes keeps its code index as the
//!   item `0` of its NaNVM frame, before the frame the program gave, so one
//!   Rust [`StaticCode`](crate::vm::StaticCode) runs every code index. An
//!   index past the table goes to the host's code, [`set_host_code`], as
//!   every index does in the `.wasm`.
//! - **A throw traps**
//!   ([`l0-throw-trap.md`](../../../../doc/sasha-gil/wasm/l0-throw-trap.md)).
//!   [`throw`] keeps the value and traps: in WASM it reaches `unreachable`,
//!   and here it panics with [`Thrown`]. A throw from NaNVM's own Rust code
//!   is an `Err`, turned into a [`throw`] only at the export, in [`call`],
//!   so nothing is borrowed or half made when it traps. The host reads it
//!   through [`has_thrown`], [`thrown`] and [`recover`], with [`enter`]
//!   and [`leave`] around each call, which are not L0
//!   imports. [`catch`] is a native host's whole sequence.
//!
//! A misuse traps as [`super`] does, with the text `l0.<name>: <reason>`,
//! including a handle that names no value, `not a value`, and bytes out of
//! the memory, `out of bounds`.

pub mod native;
#[cfg(test)]
mod test;

use std::{
    cell::{Cell, UnsafeCell},
    collections::HashMap,
    panic::{AssertUnwindSafe, catch_unwind, resume_unwind},
};

use super::{Builder, trap};
use crate::common::sized_index::SizedIndex;
use crate::{
    naive::Naive,
    vm::{Any, Array, Function, IVm, ToAny, ToArray},
};

type A = Naive;
type V = Any<A>;

/// The code of a function: `(param $self i64) (param $args i64) (result i64)`
/// ([`l0-design.md` §12](../../../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
/// It borrows both handles and answers an owned one, or calls [`throw`].
pub type Code = fn(self_: i64, args: i64) -> i64;

/// The code a host runs for a code index that is not in the table: the
/// index, then [`Code`]'s two handles, borrowed, and an owned result. A
/// WASM build, which cannot call into a table of another module, hands
/// every code index to the host this way.
pub type HostCode = fn(code: i32, self_: i64, args: i64) -> i64;

// The NaN box.

/// The exponent's bits: a float whose exponent is not all ones is finite.
const EXP: u64 = 0x7FF0_0000_0000_0000;
/// The bits that tell a non-finite number from the other scalars.
const TAG8: u64 = 0x7FF0_0000_0000_00FF;
/// The one NaN a number is boxed as.
const NAN: u64 = 0x7FF8_0000_0000_0000;
/// The bits that tell a counted reference, and what they are for one.
const REF_TAG: u64 = 0xFFF0_0000_0000_0003;
const DYN_REF: u64 = 0x7FF0_0000_0000_0002;
/// A handle's bits in a reference's payload: 32 of index, 14 of generation.
const INDEX_BITS: u32 = 32;
const GENERATION_BITS: u32 = 14;

/// The constant `undefined`.
pub const UNDEFINED: i64 = 0x7FF0_0000_0000_0020;
/// The constant `null`.
pub const NULL: i64 = 0x7FF0_0000_0000_0030;
/// The constant `false`.
pub const FALSE: i64 = 0x7FF0_0000_0000_0010;
/// The constant `true`.
pub const TRUE: i64 = 0xFFF0_0000_0000_0010_u64 as i64;

/// What a box holds: a value of its own bits, or a reference.
enum Boxed {
    Inline(V),
    Ref { handle: u64, kind: i32 },
}

/// A number's box: its bits, with every NaN the one NaN.
fn number(x: f64) -> i64 {
    (if x.is_nan() { NAN } else { x.to_bits() }) as i64
}

/// Whether `h` is a number's bits.
fn is_number(h: i64) -> bool {
    let x = h as u64;
    x & EXP != EXP || x & TAG8 == EXP
}

/// The kind of a box that holds its value, without making the value:
/// `None` for a reference or for bits that are no value.
fn inline_kind(h: i64) -> Option<super::Kind> {
    if is_number(h) {
        return Some(super::Kind::Number);
    }
    match h {
        UNDEFINED => Some(super::Kind::Undefined),
        NULL => Some(super::Kind::Null),
        FALSE | TRUE => Some(super::Kind::Boolean),
        _ => None,
    }
}

/// What `h` holds, or `None` for bits that are no value.
fn unbox(h: i64) -> Option<Boxed> {
    let x = h as u64;
    if is_number(h) {
        return Some(Boxed::Inline(super::from_f64(f64::from_bits(x))));
    }
    match h {
        UNDEFINED => return Some(Boxed::Inline(super::undefined())),
        NULL => return Some(Boxed::Inline(super::null())),
        FALSE | TRUE => return Some(Boxed::Inline(super::from_bool(h == TRUE))),
        _ => {}
    }
    (x & REF_TAG == DYN_REF).then_some(Boxed::Ref {
        handle: (x >> 2) & ((1 << (INDEX_BITS + GENERATION_BITS)) - 1),
        kind: ((x >> 48) & 0xF) as i32,
    })
}

/// The memory a fresh thread starts with: one WASM page.
const MEMORY: usize = 0x1_0000;

/// The payload of the panic [`throw`] causes in native code. The value is
/// kept apart, in the runtime, for [`thrown`].
#[derive(Debug)]
pub struct Thrown;

/// A table of handles. A handle is a slot's index in its low `bits` and the
/// slot's generation above, and freeing a slot moves its generation on, so
/// a handle freed before refers to nothing, even after its slot is reused.
/// A slot is retired after its last generation.
struct Slab<T> {
    slots: Vec<(u32, Option<T>)>,
    /// Each slot's birth: the runtime's count of handles made, when the
    /// slot's value was put.
    born: Vec<u64>,
    free: Vec<usize>,
    bits: u32,
    generations: u32,
}

impl<T> Slab<T> {
    fn new(bits: u32, generation_bits: u32) -> Self {
        Slab {
            slots: Vec::new(),
            born: Vec::new(),
            free: Vec::new(),
            bits,
            generations: u32::MAX >> (32 - generation_bits),
        }
    }

    /// The slot a handle names, while it holds a value.
    fn find(&self, h: u64) -> Option<usize> {
        let i = (h & ((1 << self.bits) - 1)) as usize;
        let generation = u32::try_from(h >> self.bits).ok()?;
        match self.slots.get(i) {
            Some((g, Some(_))) if *g == generation => Some(i),
            _ => None,
        }
    }

    fn get(&self, h: u64) -> Option<&T> {
        self.find(h).and_then(|i| self.slots[i].1.as_ref())
    }

    fn get_mut(&mut self, h: u64) -> Option<&mut T> {
        self.find(h).and_then(|i| self.slots[i].1.as_mut())
    }

    fn take(&mut self, h: u64) -> Option<T> {
        let i = self.find(h)?;
        let (generation, v) = &mut self.slots[i];
        // A slot whose generations are spent is retired, never reused, so
        // no handle ever names two values.
        if *generation < self.generations {
            *generation += 1;
            self.free.push(i);
        }
        v.take()
    }

    fn put(&mut self, name: &str, birth: u64, v: T) -> u64 {
        let i = match self.free.pop() {
            Some(i) => i,
            None => {
                if (self.slots.len() as u64) >> self.bits != 0 {
                    trap(name, "too many handles")
                }
                self.slots.push((0, None));
                self.born.push(0);
                self.slots.len() - 1
            }
        };
        self.slots[i].1 = Some(v);
        self.born[i] = birth;
        (u64::from(self.slots[i].0) << self.bits) | i as u64
    }

    /// Frees every slot whose birth is in `births`.
    fn free_born(&mut self, births: core::ops::RangeInclusive<u64>) {
        for i in 0..self.slots.len() {
            if births.contains(&self.born[i]) {
                let h = (u64::from(self.slots[i].0) << self.bits) | i as u64;
                self.take(h);
            }
        }
    }

    fn count(&self) -> usize {
        self.slots.iter().filter(|(_, v)| v.is_some()).count()
    }
}

struct State {
    values: Slab<V>,
    builders: Slab<Builder<A>>,
    memory: Vec<u8>,
    table: Vec<Code>,
    host: Option<HostCode>,
    texts: HashMap<Vec<u16>, &'static str>,
    /// The number of handles made so far, values and builders: the birth
    /// of the next one.
    births: u64,
    /// For each call of the host into the program, [`enter`], the births
    /// before it.
    marks: Vec<u64>,
    /// The value of the last [`throw`], and the births before it.
    thrown: Option<(V, u64)>,
}

impl State {
    fn birth(&mut self) -> u64 {
        self.births += 1;
        self.births
    }
}

impl State {
    fn new() -> Self {
        // A value handle is 32 bits of index and 14 of generation, the
        // payload of a box. A builder handle, an `i32`, is 16 and 15, so it
        // is never negative.
        State {
            values: Slab::new(INDEX_BITS, GENERATION_BITS),
            builders: Slab::new(16, 15),
            memory: core::iter::repeat_n(0, MEMORY).collect(),
            table: Vec::new(),
            host: None,
            texts: HashMap::new(),
            births: 0,
            marks: Vec::new(),
            thrown: None,
        }
    }
}

/// The state, and whether a change of it is under way. A `RefCell` would
/// do natively, where a panic unwinds and gives the borrow back, but under
/// `panic=abort` a trap ends the change without that, and every later call
/// would trap on the borrow: [`release`] ends it instead.
struct Shared {
    busy: Cell<bool>,
    state: UnsafeCell<State>,
}

thread_local! {
    static STATE: Shared = Shared { busy: Cell::new(false), state: UnsafeCell::new(State::new()) };
}

/// Ends a change of the state when it is left, by a return or an unwind.
struct Busy<'a>(&'a Cell<bool>);

impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.set(false)
    }
}

fn with<R>(f: impl FnOnce(&mut State) -> R) -> R {
    STATE.with(|s| {
        if s.busy.replace(true) {
            panic!("l0: a change of the state inside another")
        }
        let _busy = Busy(&s.busy);
        // SAFETY: `busy` was false, so no other reference to the state
        // lives, and it stays true until this one is gone, or until
        // `release` after a trap ended the change that held it.
        f(unsafe { &mut *s.state.get() })
    })
}

/// Ends the change of the state that a trap stopped, under `panic=abort`,
/// where nothing unwinds: a panic hook calls it, so the host can go on to
/// [`has_thrown`] and [`recover`].
///
/// # Safety
///
/// No reference into the state may be used after it: the caller is a
/// panic hook under `panic=abort`, where the trap that follows the panic
/// ends every call that holds one, and nothing touches the state between
/// the two.
pub unsafe fn release() {
    STATE.with(|s| s.busy.set(false))
}

// Handles. No borrow of the state is held while a typed L0 function or a
// code runs, so either may call back into the ABI.

/// The slot of a reference's handle, when it names a value of the box's kind.
fn slot(s: &State, handle: u64, kind: i32) -> Option<&V> {
    s.values
        .get(handle)
        .filter(|v| super::kind(v) as i32 == kind)
}

/// The value of a borrowed box.
fn get(name: &str, h: i64) -> V {
    match unbox(h) {
        Some(Boxed::Inline(v)) => Some(v),
        Some(Boxed::Ref { handle, kind }) => with(|s| slot(s, handle, kind).cloned()),
        None => None,
    }
    .unwrap_or_else(|| trap(name, "not a value"))
}

/// Runs `f` on the value of a box, which stays where it is: a read
/// that needs no copy of a referenced value, inside the state. `f` must
/// not reach the state itself; a trap inside it ends the change as any
/// trap does.
fn read<R>(name: &str, h: i64, f: impl FnOnce(&V) -> R) -> R {
    match unbox(h) {
        Some(Boxed::Inline(v)) => Some(f(&v)),
        Some(Boxed::Ref { handle, kind }) => with(|s| slot(s, handle, kind).map(f)),
        None => None,
    }
    .unwrap_or_else(|| trap(name, "not a value"))
}

/// [`read`] of two boxes at once.
fn read2<R>(name: &str, a: i64, b: i64, f: impl FnOnce(&V, &V) -> R) -> R {
    match (unbox(a), unbox(b)) {
        (Some(Boxed::Inline(x)), Some(Boxed::Inline(y))) => Some(f(&x, &y)),
        (Some(Boxed::Inline(x)), Some(Boxed::Ref { handle, kind })) => {
            with(|s| slot(s, handle, kind).map(|y| f(&x, y)))
        }
        (Some(Boxed::Ref { handle, kind }), Some(Boxed::Inline(y))) => {
            with(|s| slot(s, handle, kind).map(|x| f(x, &y)))
        }
        (
            Some(Boxed::Ref {
                handle: ha,
                kind: ka,
            }),
            Some(Boxed::Ref {
                handle: hb,
                kind: kb,
            }),
        ) => with(|s| match (slot(s, ha, ka), slot(s, hb, kb)) {
            (Some(x), Some(y)) => Some(f(x, y)),
            _ => None,
        }),
        _ => None,
    }
    .unwrap_or_else(|| trap(name, "not a value"))
}

/// The value of a box the function takes: a reference's handle is freed.
fn take(name: &str, h: i64) -> V {
    match unbox(h) {
        Some(Boxed::Inline(v)) => Some(v),
        Some(Boxed::Ref { handle, kind }) => with(|s| {
            slot(s, handle, kind)?;
            s.values.take(handle)
        }),
        None => None,
    }
    .unwrap_or_else(|| trap(name, "not a value"))
}

/// A new owned box: a number, `undefined`, `null` and the booleans are
/// their own bits, so they never take a slot.
fn put(v: V) -> i64 {
    let kind = super::kind(&v);
    match kind {
        super::Kind::Undefined => return UNDEFINED,
        super::Kind::Null => return NULL,
        super::Kind::Boolean => return from_bool(super::to_bool(&v) as i32),
        super::Kind::Number => return number(super::to_f64(&v)),
        _ => {}
    }
    let handle = with(|s| {
        let birth = s.birth();
        s.values.put("put", birth, v)
    });
    (DYN_REF | (kind as u64) << 48 | handle << 2) as i64
}

fn take_builder(name: &str, b: i32) -> Builder<A> {
    with(|s| s.builders.take(b as u32 as u64)).unwrap_or_else(|| trap(name, "not a builder"))
}

fn put_builder(name: &str, b: Builder<A>) -> i32 {
    with(|s| {
        let birth = s.birth();
        s.builders.put(name, birth, b)
    }) as i32
}

/// Runs `f` on an open builder, which stays open.
fn on_builder(name: &str, b: i32, f: impl FnOnce(&mut Builder<A>)) {
    with(|s| {
        let builder = s
            .builders
            .get_mut(b as u32 as u64)
            .unwrap_or_else(|| trap(name, "not a builder"));
        f(builder)
    })
}

/// A count, which an `i32` carries: a negative one traps.
fn count(name: &str, n: i32) -> u32 {
    u32::try_from(n).unwrap_or_else(|_| trap(name, "not a count"))
}

// Memory.

/// The host's access to the memory, as a loader writes the program's bytes.
pub fn with_memory<R>(f: impl FnOnce(&mut Vec<u8>) -> R) -> R {
    with(|s| f(&mut s.memory))
}

fn bytes(name: &str, ptr: i32, len: i32, size: usize) -> core::ops::Range<usize> {
    let start = ptr as u32 as usize;
    let n = (len as u32 as usize).checked_mul(size);
    match n.and_then(|n| start.checked_add(n)) {
        Some(end) if end <= with(|s| s.memory.len()) => start..end,
        _ => trap(name, "out of bounds"),
    }
}

fn load_units(name: &str, ptr: i32, len: i32) -> Vec<u16> {
    let r = bytes(name, ptr, len, 2);
    with(|s| {
        s.memory[r]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&c| u16::from_le_bytes(c))
            .collect()
    })
}

fn load_words(name: &str, ptr: i32, len: i32) -> Vec<u64> {
    let r = bytes(name, ptr, len, 8);
    with(|s| {
        s.memory[r]
            .as_chunks::<8>()
            .0
            .iter()
            .map(|&c| u64::from_le_bytes(c))
            .collect()
    })
}

fn store(name: &str, ptr: i32, len: i32, size: usize, data: &[u8]) {
    let r = bytes(name, ptr, len, size);
    with(|s| s.memory[r].copy_from_slice(data))
}

// Scalars.

/// L0 `kind`: a value of its own bits is read from them.
pub fn kind(v: i64) -> i32 {
    match inline_kind(v) {
        Some(k) => k as i32,
        None => read("kind", v, |x| super::kind(x) as i32),
    }
}

/// L0 `to_f64`: a number is its own bits.
pub fn to_f64(v: i64) -> f64 {
    if is_number(v) {
        f64::from_bits(v as u64)
    } else {
        read("to_f64", v, super::to_f64)
    }
}

/// L0 `from_f64`: the number's own bits.
pub fn from_f64(x: f64) -> i64 {
    number(x)
}

/// L0 `to_bool`: a boolean is its own bits.
pub fn to_bool(v: i64) -> i32 {
    match v {
        FALSE => return 0,
        TRUE => return 1,
        _ => {}
    }
    read("to_bool", v, |x| super::to_bool(x) as i32)
}

/// L0 `from_bool`: the constant `true` for any `b` but `0`.
pub fn from_bool(b: i32) -> i64 {
    if b == 0 { FALSE } else { TRUE }
}

// Bytes.

/// L0 `make_string`: `len` UTF-16 units at `ptr`.
pub fn make_string(ptr: i32, len: i32) -> i64 {
    make_string_of(&load_units("make_string", ptr, len))
}

/// L0 `make_string` of units a host has read from its own memory.
pub fn make_string_of(units: &[u16]) -> i64 {
    put(super::make_string(units))
}

/// L0 `read_units`: `len` units of `s` from `start`, written at `ptr`.
pub fn read_units(s: i64, start: i32, len: i32, ptr: i32) {
    bytes("read_units", ptr, len, 2);
    let mut out: Vec<u16> = core::iter::repeat_n(0, len as u32 as usize).collect();
    read_units_into(s, start, &mut out);
    let data: Vec<u8> = out.iter().flat_map(|u| u.to_le_bytes()).collect();
    store("read_units", ptr, len, 2, &data);
}

/// L0 `read_units` into a host's own buffer.
pub fn read_units_into(s: i64, start: i32, out: &mut [u16]) {
    read("read_units", s, |x| super::read_units(x, start as u32, out));
}

/// L0 `make_bigint`: a sign and `len` `u64` words at `ptr`.
pub fn make_bigint(sign: i32, ptr: i32, len: i32) -> i64 {
    make_bigint_of(sign, &load_words("make_bigint", ptr, len))
}

/// L0 `make_bigint` of words a host has read from its own memory.
pub fn make_bigint_of(sign: i32, words: &[u64]) -> i64 {
    put(super::make_bigint(sign, words))
}

/// L0 `sign`.
pub fn sign(b: i64) -> i32 {
    read("sign", b, super::sign)
}

/// L0 `read_words`: `len` words of `b`'s magnitude from `start`, written
/// at `ptr`.
pub fn read_words(b: i64, start: i32, len: i32, ptr: i32) {
    bytes("read_words", ptr, len, 8);
    let mut out: Vec<u64> = core::iter::repeat_n(0, len as u32 as usize).collect();
    read_words_into(b, start, &mut out);
    let data: Vec<u8> = out.iter().flat_map(|w| w.to_le_bytes()).collect();
    store("read_words", ptr, len, 8, &data);
}

/// L0 `read_words` into a host's own buffer.
pub fn read_words_into(b: i64, start: i32, out: &mut [u64]) {
    read("read_words", b, |x| super::read_words(x, start as u32, out));
}

// Strings.

/// L0 `unit`.
pub fn unit(s: i64, i: i32) -> i32 {
    read("unit", s, |x| super::unit(x, i as u32)).into()
}

/// L0 `from_unit`. A number that is not a UTF-16 unit traps.
pub fn from_unit(u: i32) -> i64 {
    let u = u16::try_from(u).unwrap_or_else(|_| trap("from_unit", "not a unit"));
    put(super::from_unit(u))
}

/// L0 `concat`.
pub fn concat(a: i64, b: i64) -> i64 {
    put(read2("concat", a, b, super::concat))
}

/// L0 `substring`.
pub fn substring(s: i64, start: i32, end: i32) -> i64 {
    put(read("substring", s, |x| {
        super::substring(x, start as u32, end as u32)
    }))
}

/// L0 `join`.
pub fn join(parts: i64, separator: i64) -> i64 {
    put(read2("join", parts, separator, super::join))
}

// Containers.

/// L0 `begin_array`.
pub fn begin_array(len: i32) -> i32 {
    put_builder("begin_array", super::begin_array(count("begin_array", len)))
}

/// L0 `begin_object`.
pub fn begin_object(len: i32) -> i32 {
    put_builder(
        "begin_object",
        super::begin_object(count("begin_object", len)),
    )
}

/// L0 `push`. It takes `v`.
pub fn push(b: i32, v: i64) {
    let v = take("push", v);
    on_builder("push", b, |b| b.push(v))
}

/// L0 `push_all`. It borrows `a`.
pub fn push_all(b: i32, a: i64) {
    let a = get("push_all", a);
    on_builder("push_all", b, |b| b.push_all(&a))
}

/// L0 `push_property`. It takes `key` and `v`.
pub fn push_property(b: i32, key: i64, v: i64) {
    let key = take("push_property", key);
    let v = take("push_property", v);
    on_builder("push_property", b, |b| b.push_property(key, v))
}

/// L0 `seal`. It consumes the builder.
pub fn seal(b: i32) -> i64 {
    put(take_builder("seal", b).seal())
}

/// L0 `length`.
pub fn length(v: i64) -> i32 {
    read("length", v, |x| super::length(x) as i32)
}

/// L0 `item`.
pub fn item(v: i64, i: i32) -> i64 {
    put(read("item", v, |x| super::item(x, i as u32)))
}

/// L0 `key`.
pub fn key(o: i64, i: i32) -> i64 {
    put(read("key", o, |x| super::key(x, i as u32)))
}

/// L0 `find`.
pub fn find(o: i64, key: i64) -> i32 {
    read2("find", o, key, super::find)
}

// Lifetime.

/// L0 `dup`.
pub fn dup(v: i64) -> i64 {
    match inline_kind(v) {
        Some(_) => v,
        None => put(get("dup", v)),
    }
}

/// L0 `drop`. It takes `v`.
pub fn drop(v: i64) {
    if inline_kind(v).is_none() {
        take("drop", v);
    }
}

// Functions.

/// The loader's step that puts a code in the table, answering its index.
pub fn add_code(code: Code) -> i32 {
    with(|s| {
        s.table.push(code);
        (s.table.len() - 1) as i32
    })
}

/// The loader's step that hands every code index past the table to
/// `host`.
pub fn set_host_code(host: HostCode) {
    with(|s| s.host = Some(host))
}

/// The one Rust code of every function L0 makes: it reads the code index
/// from the frame and runs that code on two handles it frees after.
fn run(self_: &<A as IVm>::InternalFunction, args: Array<A>) -> Result<V, V> {
    let index = super::to_f64(&A::frame(self_)[0]) as usize;
    let (code, host) = with(|s| (s.table.get(index).copied(), s.host));
    let handles = Handles([
        put(Function::<A>::new(self_.clone()).to_any()),
        put(args.to_any()),
    ]);
    let [f, a] = handles.0;
    let result = match (code, host) {
        (Some(code), _) => code(f, a),
        (None, Some(host)) => host(index as i32, f, a),
        (None, None) => trap("call", "not a code index"),
    };
    Ok(take("call", result))
}

/// Frees borrowed handles, also when a throw unwinds past them natively.
struct Handles([i64; 2]);

impl Drop for Handles {
    fn drop(&mut self) {
        for h in self.0 {
            take("call", h);
        }
    }
}

/// A function's text as NaNVM keeps it: one `&'static str` per distinct
/// text, made once. An unpaired surrogate becomes U+FFFD.
fn intern(text: &V) -> &'static str {
    let mut units: Vec<u16> = core::iter::repeat_n(0, super::length(text) as usize).collect();
    super::read_units(text, 0, &mut units);
    if let Some(t) = with(|s| s.texts.get(&units).copied()) {
        return t;
    }
    let t: &'static str = std::string::String::from_utf16_lossy(&units).leak();
    with(|s| s.texts.insert(units, t));
    t
}

/// L0 `make_function`. It takes `frame` and `text`, a string or
/// `undefined`.
pub fn make_function(code: i32, frame: i64, length: i32, text: i64) -> i64 {
    if !with(|s| usize::try_from(code).is_ok_and(|i| i < s.table.len() || s.host.is_some())) {
        trap("make_function", "not a code index")
    }
    let length = count("make_function", length);
    let frame = take("make_function", frame);
    let text = take("make_function", text);
    let text = match super::kind(&text) {
        super::Kind::Undefined => None,
        super::Kind::String => Some(intern(&text)),
        _ => trap("make_function", "not a string"),
    };
    let frame = super::as_array("make_function", &frame);
    let items: Vec<V> = core::iter::once(super::from_f64(code as f64))
        .chain(frame.index_iter())
        .collect();
    put(A::static_function(run, length, items.to_array(), text).to_any())
}

/// L0 `call`. A throw, from the code or from NaNVM's own, becomes
/// [`throw`] here.
pub fn call(f: i64, args: i64) -> i64 {
    let f = get("call", f);
    let args = get("call", args);
    match super::call(&f, &args) {
        Ok(v) => put(v),
        Err(e) => throw(put(e)),
    }
}

/// L0 `frame`: the item `i` of the frame the program gave
/// `make_function`, read through the running function, `self_`.
pub fn frame(self_: i64, i: i32) -> i64 {
    let f = super::as_function("frame", &get("frame", self_));
    let frame = A::frame(f.internal());
    let n = (frame.len() as u32).saturating_sub(1);
    put(frame[super::index("frame", i as u32, n) as usize + 1].clone())
}

/// L0 `text`.
pub fn text(f: i64) -> i64 {
    put(read("text", f, super::text))
}

/// L0 `throw`: keeps `v`, which it takes, and traps.
pub fn throw(v: i64) -> ! {
    let v = take("throw", v);
    with(|s| s.thrown = Some((v, s.births)));
    #[cfg(all(target_arch = "wasm32", panic = "abort"))]
    core::arch::wasm32::unreachable();
    #[cfg(not(all(target_arch = "wasm32", panic = "abort")))]
    std::panic::panic_any(Thrown)
}

// Identity.

/// L0 `same`.
pub fn same(a: i64, b: i64) -> i32 {
    read2("same", a, b, |x, y| super::same(x, y) as i32)
}

// References only: what Any, written in the IR, still calls NaNVM for.
// Each takes the box of a reference and traps on any other bits, as on a
// dropped or forged reference, so no misuse is answered.

/// Traps unless `h` is the box of a reference.
fn reference(name: &str, h: i64) {
    if !matches!(unbox(h), Some(Boxed::Ref { .. })) {
        trap(name, "not a reference")
    }
}

/// The kind of a live reference: its `tttt`, which NaNVM checks against
/// the kind it keeps for the handle.
pub fn kind_ref(v: i64) -> i32 {
    reference("kind_ref", v);
    read("kind_ref", v, |x| super::kind(x) as i32)
}

/// [`dup`] of a reference.
pub fn dup_ref(v: i64) -> i64 {
    reference("dup_ref", v);
    put(get("dup_ref", v))
}

/// [`drop`] of a reference. It takes `v`.
pub fn drop_ref(v: i64) {
    reference("drop_ref", v);
    take("drop_ref", v);
}

/// [`same`] where `a` or `b` is a reference: both are checked, even when
/// their bits are equal, so a dropped reference traps.
pub fn same_ref(a: i64, b: i64) -> i32 {
    if !matches!(unbox(a), Some(Boxed::Ref { .. })) {
        reference("same_ref", b);
    }
    read2("same_ref", a, b, |x, y| super::same(x, y) as i32)
}

// The host's side, not L0 imports.

/// `1` when a [`throw`] caused the last trap, else `0`: the trap was a
/// misuse.
pub fn has_thrown() -> i32 {
    with(|s| s.thrown.is_some()) as i32
}

/// The value the last [`throw`] kept, as an owned handle, or `undefined`.
pub fn thrown() -> i64 {
    with(|s| s.thrown.as_ref().map(|(v, _)| v.clone())).map_or(UNDEFINED, put)
}

/// Marks the start of a call of the host into the program, for
/// [`recover`]. Calls may nest, as when the host answers an effect.
pub fn enter() {
    with(|s| s.marks.push(s.births))
}

/// Ends the call [`enter`] marked, after it returned.
pub fn leave() {
    with(|s| s.marks.pop());
}

/// Makes the runtime ready to go on after a caught throw, and ends the
/// call [`enter`] marked. It frees every value handle and builder made
/// after that mark and before the [`throw`]: what the abandoned frames
/// held, since a program keeps no handle across a call of the host but its
/// literals, made before any. Then it clears [`has_thrown`]. A handle that
/// [`thrown`] made stays. After a trap of a misuse, which threw nothing, a
/// WASM host may go on the same way: it frees every handle made after the
/// mark. Without a mark it frees nothing.
pub fn recover() {
    with(|s| {
        let mark = s.marks.pop();
        // After a misuse nothing was thrown: every handle since the mark was abandoned.
        let at = s.thrown.as_ref().map_or(s.births, |(_, at)| *at);
        if let Some(mark) = mark {
            let births = mark + 1..=at;
            s.values.free_born(births.clone());
            s.builders.free_born(births);
        }
        s.thrown = None;
    })
}

/// A native host's call into the program: `Ok` with the result, or `Err`
/// with the thrown value, after [`recover`]. A misuse panics on. It needs
/// `panic = "unwind"`: with `abort`, every trap ends the process, and a
/// WASM host catches the trap itself.
pub fn catch(f: impl FnOnce() -> i64) -> Result<i64, i64> {
    enter();
    match catch_unwind(AssertUnwindSafe(f)) {
        Ok(v) => {
            leave();
            Ok(v)
        }
        Err(payload) => {
            if has_thrown() == 0 {
                resume_unwind(payload)
            }
            let e = thrown();
            recover();
            Err(e)
        }
    }
}

/// The number of references in use: for tests of ownership.
pub fn live() -> usize {
    with(|s| s.values.count())
}

/// `1` when `h` is a value, else `0`: for a host that keeps boxes of its
/// own across a [`recover`].
pub fn alive(h: i64) -> i32 {
    match unbox(h) {
        Some(Boxed::Inline(_)) => true,
        Some(Boxed::Ref { handle, kind }) => with(|s| slot(s, handle, kind).is_some()),
        None => false,
    }
    .into()
}

/// The number of builders that are open: for tests of ownership.
pub fn open_builders() -> usize {
    with(|s| s.builders.count())
}
