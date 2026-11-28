//! NaNVM as a `.wasm` that exports `fjs:l0`: step 3 of
//! [`todo/l0-interface.md`](../../lib/todo/l0-interface.md), in the cut of
//! [slice 12](../../../fjs/ir/todo/slices.md).
//!
//! Each export is a function of [`nanvm_lib::l0::abi`] under its L0 name,
//! so a loader passes this module's exports to a program as its `fjs:l0`
//! imports. Beside them are the host's side, `has_thrown`, `thrown`,
//! `enter`, `leave`, `recover` and `live`, and three of this build's own:
//!
//! - **`reserve(size) -> ptr`** gives the loader `size` bytes of this
//!   module's memory, which it exports as `memory`, for a program's data
//!   segments at `data_base`, or for bytes the host passes. The bytes that
//!   `read_units` and `read_words` write must lie in one reserved region,
//!   and those that `make_string` and `make_bigint` read, which they copy
//!   out at once, in the memory, wherever in it they are, as a block of the
//!   IR heap is ([long-strings.md, choice 1](../../../doc/sasha-gil/ir/long-strings.md#1-whether-nanvm-holds-references-into-the-ir-heap)),
//!   or they trap with `out of bounds`.
//! - **A code index goes to the host.** WASM cannot call into another
//!   module's table, so a function's code index is handed to the import
//!   `fjs:host` `invoke(code, self, args) -> any`, which runs it, borrowing
//!   both handles and answering an owned one.
//!
//! - **`trap_text_length() -> i32`** answers how many UTF-16 units the
//!   last trap's text has, `l0.<name>: <reason>` for a misuse, or `-1`
//!   where nothing trapped since `enter`, and **`trap_text_into(ptr)`**
//!   writes them at `ptr`, in a reserved region, and takes the text. Under
//!   `panic=abort` a panic's message is lost, so a panic hook keeps it for
//!   the host. The hook also ends the change of NaNVM's state that the
//!   panic stopped ([`abi::release`]), so the host goes on to `has_thrown`
//!   and `recover`.
//!
//! `kind_ref`, `dup_ref`, `drop_ref` and `same_ref` are NaNVM's own
//! exports for Any written in the IR
//! ([runtime-in-ir.md](../../../doc/sasha-gil/ir/runtime-in-ir.md)): each
//! takes the box of a reference and traps on any other bits.
//!
//! L1's native rows, the `fjs:l1-native` imports, are exports too, under
//! their row names (`bigintAdd`, `numberToString`, ...), from
//! [`abi::native`].
//!
//! Every `i64` is a NaN box ([`abi`]): the four constants are their boxes,
//! which `constant_box` answers and a loader makes the program's immutable
//! `i64` globals. The code is all for `wasm32`:
//! natively the crate is empty.

#![cfg(target_arch = "wasm32")]

use core::cell::RefCell;
use nanvm_lib::l0::abi::{self, native};

#[link(wasm_import_module = "fjs:host")]
unsafe extern "C" {
    /// Runs the code at an index on the function and its arguments, both
    /// borrowed, and answers an owned result, or traps after a `throw`.
    #[link_name = "invoke"]
    fn host_invoke(code: i32, self_: i64, args: i64) -> i64;
}

fn invoke(code: i32, self_: i64, args: i64) -> i64 {
    // SAFETY: the import takes and answers plain numbers.
    unsafe { host_invoke(code, self_, args) }
}

thread_local! {
    /// The reserved regions, each an address and a size, never freed.
    static REGIONS: RefCell<Vec<(usize, usize)>> = const { RefCell::new(Vec::new()) };
}

thread_local! {
    /// What the last panic said, which `trap_text_into` takes.
    static TRAP: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Sets the panic hook that keeps a panic's message in [`TRAP`], once.
fn hook() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        std::panic::set_hook(Box::new(|info| {
            let text = info
                .payload_as_str()
                .map_or_else(|| "panic".to_string(), str::to_string);
            // `try_with`: a panic while the thread's locals are gone keeps nothing.
            let _ = TRAP.try_with(|t| t.replace(Some(text)));
            // SAFETY: under `panic=abort` the trap that follows ends the
            // change of the state that panicked, and this hook touches
            // nothing else of it. An unwind gives the change back itself.
            #[cfg(panic = "abort")]
            unsafe {
                abi::release()
            };
        }))
    });
}

/// How many UTF-16 units the last trap's text has, or `-1` for none.
#[unsafe(export_name = "trap_text_length")]
pub extern "C" fn trap_text_length() -> i32 {
    TRAP.with_borrow(|t| {
        t.as_ref()
            .map_or(-1, |text| text.encode_utf16().count() as i32)
    })
}

/// Writes the last trap's text at `ptr`, the low byte of each unit first,
/// and takes it.
#[unsafe(export_name = "trap_text_into")]
pub extern "C" fn trap_text_into(ptr: i32) {
    let units: Vec<u16> = TRAP
        .with_borrow_mut(Option::take)
        .unwrap_or_else(|| panic!("l0.trap_text_into: no text"))
        .encode_utf16()
        .collect();
    let bytes = region("trap_text_into", ptr, units.len() as i32, 2);
    for (pair, u) in bytes.as_chunks_mut::<2>().0.iter_mut().zip(units) {
        *pair = u.to_le_bytes();
    }
}

/// Gives `size` zeroed bytes of the memory and answers their address.
#[unsafe(export_name = "reserve")]
pub extern "C" fn reserve(size: i32) -> i32 {
    hook();
    let size = usize::try_from(size).unwrap_or_else(|_| panic!("l0.reserve: not a count"));
    let bytes: Box<[u8]> = core::iter::repeat_n(0, size).collect();
    let ptr = Box::into_raw(bytes) as *mut u8 as usize;
    REGIONS.with_borrow_mut(|r| r.push((ptr, size)));
    ptr as i32
}

/// The bytes of `len` items of `size` at `ptr`, which a write fills: they
/// must lie in one reserved region.
fn region(name: &str, ptr: i32, len: i32, size: usize) -> &'static mut [u8] {
    let start = ptr as u32 as usize;
    let n = (len as u32 as usize).checked_mul(size);
    let end = n.and_then(|n| start.checked_add(n));
    let inside = |&(base, bytes): &(usize, usize)| {
        end.is_some_and(|end| base <= start && end <= base + bytes)
    };
    if !REGIONS.with_borrow(|r| r.iter().any(inside)) {
        panic!("l0.{name}: out of bounds")
    }
    let n = n.unwrap_or(0);
    // SAFETY: the bytes lie in a region `reserve` leaked, which nothing in
    // Rust borrows but this slice, while it lives.
    unsafe { core::slice::from_raw_parts_mut(start as *mut u8, n) }
}

/// The bytes of `len` items of `size` at `ptr`, which a read copies out
/// at once: they must lie in the memory, wherever in it they are, as the
/// pages that the IR heap grew do.
fn readable(name: &str, ptr: i32, len: i32, size: usize) -> &'static [u8] {
    let start = ptr as u32 as usize;
    let n = (len as u32 as usize).checked_mul(size);
    let end = n.and_then(|n| start.checked_add(n));
    let memory = core::arch::wasm32::memory_size(0) * 0x1_0000;
    if !end.is_some_and(|end| end <= memory) {
        panic!("l0.{name}: out of bounds")
    }
    match n {
        Some(n) if n > 0 => {
            // SAFETY: the bytes lie in the memory, and the caller copies them
            // out before Rust runs anything else, so no borrow of them that
            // Rust holds is live while this slice is.
            unsafe { core::slice::from_raw_parts(start as *const u8, n) }
        }
        _ => &[],
    }
}

// Scalars.

/// Any's constant `k` (0 `undefined`, 1 `null`, 2 `false`, 3 `true`), as
/// NaNVM boxes it, so a host builds its constant globals from NaNVM and the
/// two cannot disagree. Any other `k` traps.
#[unsafe(export_name = "constant_box")]
pub extern "C" fn constant_box(k: i32) -> i64 {
    match k {
        0 => abi::UNDEFINED,
        1 => abi::NULL,
        2 => abi::FALSE,
        3 => abi::TRUE,
        _ => panic!("constant_box: no constant {k}"),
    }
}

#[unsafe(export_name = "kind")]
pub extern "C" fn kind(v: i64) -> i32 {
    abi::kind(v)
}

#[unsafe(export_name = "to_f64")]
pub extern "C" fn to_f64(v: i64) -> f64 {
    abi::to_f64(v)
}

#[unsafe(export_name = "from_f64")]
pub extern "C" fn from_f64(x: f64) -> i64 {
    abi::from_f64(x)
}

#[unsafe(export_name = "to_bool")]
pub extern "C" fn to_bool(v: i64) -> i32 {
    abi::to_bool(v)
}

#[unsafe(export_name = "from_bool")]
pub extern "C" fn from_bool(b: i32) -> i64 {
    abi::from_bool(b)
}

// Bytes.

#[unsafe(export_name = "make_string")]
pub extern "C" fn make_string(ptr: i32, len: i32) -> i64 {
    let units: Vec<u16> = readable("make_string", ptr, len, 2)
        .as_chunks::<2>()
        .0
        .iter()
        .map(|&c| u16::from_le_bytes(c))
        .collect();
    abi::make_string_of(&units)
}

#[unsafe(export_name = "read_units")]
pub extern "C" fn read_units(s: i64, start: i32, len: i32, ptr: i32) {
    let out = region("read_units", ptr, len, 2);
    let mut units: Vec<u16> = core::iter::repeat_n(0, len as usize).collect();
    abi::read_units_into(s, start, &mut units);
    for (o, u) in out.as_chunks_mut::<2>().0.iter_mut().zip(units) {
        *o = u.to_le_bytes();
    }
}

#[unsafe(export_name = "make_bigint")]
pub extern "C" fn make_bigint(sign: i32, ptr: i32, len: i32) -> i64 {
    let words: Vec<u64> = readable("make_bigint", ptr, len, 8)
        .as_chunks::<8>()
        .0
        .iter()
        .map(|&c| u64::from_le_bytes(c))
        .collect();
    abi::make_bigint_of(sign, &words)
}

#[unsafe(export_name = "sign")]
pub extern "C" fn sign(b: i64) -> i32 {
    abi::sign(b)
}

#[unsafe(export_name = "read_words")]
pub extern "C" fn read_words(b: i64, start: i32, len: i32, ptr: i32) {
    let out = region("read_words", ptr, len, 8);
    let mut words: Vec<u64> = core::iter::repeat_n(0, len as usize).collect();
    abi::read_words_into(b, start, &mut words);
    for (o, w) in out.as_chunks_mut::<8>().0.iter_mut().zip(words) {
        *o = w.to_le_bytes();
    }
}

// Strings.

#[unsafe(export_name = "unit")]
pub extern "C" fn unit(s: i64, i: i32) -> i32 {
    abi::unit(s, i)
}

#[unsafe(export_name = "from_unit")]
pub extern "C" fn from_unit(u: i32) -> i64 {
    abi::from_unit(u)
}

#[unsafe(export_name = "concat")]
pub extern "C" fn concat(a: i64, b: i64) -> i64 {
    abi::concat(a, b)
}

#[unsafe(export_name = "substring")]
pub extern "C" fn substring(s: i64, start: i32, end: i32) -> i64 {
    abi::substring(s, start, end)
}

#[unsafe(export_name = "join")]
pub extern "C" fn join(parts: i64, separator: i64) -> i64 {
    abi::join(parts, separator)
}

// Containers.

#[unsafe(export_name = "begin_array")]
pub extern "C" fn begin_array(len: i32) -> i32 {
    abi::begin_array(len)
}

#[unsafe(export_name = "begin_object")]
pub extern "C" fn begin_object(len: i32) -> i32 {
    abi::begin_object(len)
}

#[unsafe(export_name = "push")]
pub extern "C" fn push(b: i32, v: i64) {
    abi::push(b, v)
}

#[unsafe(export_name = "push_all")]
pub extern "C" fn push_all(b: i32, a: i64) {
    abi::push_all(b, a)
}

#[unsafe(export_name = "push_property")]
pub extern "C" fn push_property(b: i32, key: i64, v: i64) {
    abi::push_property(b, key, v)
}

#[unsafe(export_name = "seal")]
pub extern "C" fn seal(b: i32) -> i64 {
    abi::seal(b)
}

#[unsafe(export_name = "length")]
pub extern "C" fn length(v: i64) -> i32 {
    abi::length(v)
}

#[unsafe(export_name = "item")]
pub extern "C" fn item(v: i64, i: i32) -> i64 {
    abi::item(v, i)
}

#[unsafe(export_name = "key")]
pub extern "C" fn key(o: i64, i: i32) -> i64 {
    abi::key(o, i)
}

#[unsafe(export_name = "find")]
pub extern "C" fn find(o: i64, key: i64) -> i32 {
    abi::find(o, key)
}

// Lifetime.

#[unsafe(export_name = "dup")]
pub extern "C" fn dup(v: i64) -> i64 {
    abi::dup(v)
}

#[unsafe(export_name = "drop")]
pub extern "C" fn drop(v: i64) {
    abi::drop(v)
}

// Functions.

#[unsafe(export_name = "make_function")]
pub extern "C" fn make_function(code: i32, frame: i64, length: i32, text: i64) -> i64 {
    abi::set_host_code(invoke);
    abi::make_function(code, frame, length, text)
}

#[unsafe(export_name = "call")]
pub extern "C" fn call(f: i64, args: i64) -> i64 {
    abi::call(f, args)
}

#[unsafe(export_name = "frame")]
pub extern "C" fn frame(self_: i64, i: i32) -> i64 {
    abi::frame(self_, i)
}

#[unsafe(export_name = "text")]
pub extern "C" fn text(f: i64) -> i64 {
    abi::text(f)
}

#[unsafe(export_name = "throw")]
pub extern "C" fn throw(v: i64) -> ! {
    abi::throw(v)
}

// Identity.

#[unsafe(export_name = "same")]
pub extern "C" fn same(a: i64, b: i64) -> i32 {
    abi::same(a, b)
}

// References only, for Any written in the IR: each traps on bits that are
// no reference.

#[unsafe(export_name = "kind_ref")]
pub extern "C" fn kind_ref(v: i64) -> i32 {
    abi::kind_ref(v)
}

#[unsafe(export_name = "dup_ref")]
pub extern "C" fn dup_ref(v: i64) -> i64 {
    abi::dup_ref(v)
}

#[unsafe(export_name = "drop_ref")]
pub extern "C" fn drop_ref(v: i64) {
    abi::drop_ref(v)
}

#[unsafe(export_name = "same_ref")]
pub extern "C" fn same_ref(a: i64, b: i64) -> i32 {
    abi::same_ref(a, b)
}

// The host's side.

#[unsafe(export_name = "has_thrown")]
pub extern "C" fn has_thrown() -> i32 {
    abi::has_thrown()
}

#[unsafe(export_name = "thrown")]
pub extern "C" fn thrown() -> i64 {
    abi::thrown()
}

#[unsafe(export_name = "enter")]
pub extern "C" fn enter() {
    hook();
    TRAP.with_borrow_mut(|t| *t = None);
    abi::enter()
}

#[unsafe(export_name = "leave")]
pub extern "C" fn leave() {
    abi::leave()
}

#[unsafe(export_name = "recover")]
pub extern "C" fn recover() {
    abi::recover()
}

#[unsafe(export_name = "live")]
pub extern "C" fn live() -> i32 {
    abi::live() as i32
}

#[unsafe(export_name = "open_builders")]
pub extern "C" fn open_builders() -> i32 {
    abi::open_builders() as i32
}

#[unsafe(export_name = "alive")]
pub extern "C" fn alive(h: i64) -> i32 {
    abi::alive(h)
}

/// String emit policy: `0` always dyn-ref (variant A); otherwise a bit mask
/// of enabled short tags (B/C), bit `i` = `short::ALL_TAGS[i]`. Default is A.
#[unsafe(export_name = "set_string_emit")]
pub extern "C" fn set_string_emit(mask: i32) {
    abi::set_string_emit(mask as u32)
}

// L1's native rows, the `fjs:l1-native` imports.

#[unsafe(export_name = "bigintEquals")]
pub extern "C" fn bigint_equals(a: i64, b: i64) -> i32 {
    native::bigint_equals(a, b)
}

#[unsafe(export_name = "numberRemainder")]
pub extern "C" fn number_remainder(a: f64, b: f64) -> f64 {
    native::number_remainder(a, b)
}

#[unsafe(export_name = "numberShiftRight")]
pub extern "C" fn number_shift_right(a: f64, b: f64) -> f64 {
    native::number_shift_right(a, b)
}

#[unsafe(export_name = "numberAnd")]
pub extern "C" fn number_and(a: f64, b: f64) -> f64 {
    native::number_and(a, b)
}

#[unsafe(export_name = "numberToString")]
pub extern "C" fn number_to_string(n: f64) -> i64 {
    native::number_to_string(n)
}

#[unsafe(export_name = "stringToNumber")]
pub extern "C" fn string_to_number(s: i64) -> f64 {
    native::string_to_number(s)
}

#[unsafe(export_name = "stringToBigInt")]
pub extern "C" fn string_to_bigint(s: i64) -> i64 {
    native::string_to_bigint(s)
}

#[unsafe(export_name = "bigintToString")]
pub extern "C" fn bigint_to_string(b: i64) -> i64 {
    native::bigint_to_string(b)
}

#[unsafe(export_name = "bigintAdd")]
pub extern "C" fn bigint_add(a: i64, b: i64) -> i64 {
    native::bigint_add(a, b)
}

#[unsafe(export_name = "bigintSubtract")]
pub extern "C" fn bigint_subtract(a: i64, b: i64) -> i64 {
    native::bigint_subtract(a, b)
}

#[unsafe(export_name = "bigintRemainder")]
pub extern "C" fn bigint_remainder(a: i64, b: i64) -> i64 {
    native::bigint_remainder(a, b)
}

#[unsafe(export_name = "bigintShiftRight")]
pub extern "C" fn bigint_shift_right(a: i64, b: i64) -> i64 {
    native::bigint_shift_right(a, b)
}

#[unsafe(export_name = "bigintAnd")]
pub extern "C" fn bigint_and(a: i64, b: i64) -> i64 {
    native::bigint_and(a, b)
}

#[unsafe(export_name = "bigintToNumber")]
pub extern "C" fn bigint_to_number(b: i64) -> f64 {
    native::bigint_to_number(b)
}

#[unsafe(export_name = "bigintMultiply")]
pub extern "C" fn bigint_multiply(a: i64, b: i64) -> i64 {
    native::bigint_multiply(a, b)
}

#[unsafe(export_name = "bigintDivide")]
pub extern "C" fn bigint_divide(a: i64, b: i64) -> i64 {
    native::bigint_divide(a, b)
}

#[unsafe(export_name = "bigintNegate")]
pub extern "C" fn bigint_negate(a: i64) -> i64 {
    native::bigint_negate(a)
}

#[unsafe(export_name = "bigintLess")]
pub extern "C" fn bigint_less(a: i64, b: i64) -> f64 {
    native::bigint_less(a, b)
}
