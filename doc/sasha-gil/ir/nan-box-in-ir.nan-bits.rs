// Which NaN bits does Rust produce on this CPU? It accompanies section 5.1 of
// nan-box-in-ir.md. Run: rustc -O --crate-name nan_bits nan-box-in-ir.nan-bits.rs
// and then ./nan_bits
use std::hint::black_box;
fn main() {
    let z = black_box(0.0f64);
    let inf = black_box(f64::INFINITY);
    let one = black_box(1.0f64);
    let p = black_box(f64::from_bits(0x7FF8_0000_0000_0000));
    let n = black_box(f64::from_bits(0xFFF8_0000_0000_0000));
    let rows: [(&str, f64); 10] = [
        ("0 / 0", z / z), ("inf - inf", inf - inf), ("0 * inf", z * inf), ("sqrt(-1)", black_box(-1.0f64).sqrt()),
        ("+nan + 1", p + one), ("-nan + 1", n + one), ("1 + -nan", one + n), ("+nan * -nan", p * n),
        ("-(+nan)", -p), ("f64::NAN", f64::NAN),
    ];
    for (what, r) in rows { println!("{:<14} {:#018X}", what, r.to_bits()); }
}
