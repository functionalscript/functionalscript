use crate::vm::{
    Array, BigInt, Function, IVm, Object, String, dispatch::Dispatch, nullish::Nullish,
};

#[derive(Clone)]
pub enum Unpacked<A: IVm> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String<A>),
    BigInt(BigInt<A>),
    Object(Object<A>),
    Array(Array<A>),
    Function(Function<A>),
}

/// The bits of the one `NaN` a VM value holds: quiet, positive, empty payload.
const CANONICAL_NAN: u64 = 0x7ff8_0000_0000_0000;

impl<A: IVm> Unpacked<A> {
    /// The `Number` holding `v`, every `NaN` as the one canonical `NaN`.
    ///
    /// FunctionalScript has one `NaN`: nothing in the language tells two
    /// apart, so a sign or payload a host operation left on one — `-NaN`
    /// flips the sign, x86's `0 / 0` sets it — is dropped here, where every
    /// number enters a VM value. A NaN-boxing VM depends on that: a negative
    /// quiet `NaN` is the tag space its boxed values live in, so a number
    /// carrying one would read back as a pointer.
    pub fn number(v: f64) -> Self {
        Unpacked::Number(if v.is_nan() {
            f64::from_bits(CANONICAL_NAN)
        } else {
            v
        })
    }

    pub fn dispatch<T: Dispatch<A>>(self, o: T) -> T::Result {
        match self {
            Unpacked::Nullish(v) => o.nullish(v),
            Unpacked::Boolean(v) => o.bool(v),
            Unpacked::Number(v) => o.number(v),
            Unpacked::String(v) => o.string(v),
            Unpacked::BigInt(v) => o.bigint(v),
            Unpacked::Object(v) => o.object(v),
            Unpacked::Array(v) => o.array(v),
            Unpacked::Function(v) => o.function(v),
        }
    }
}

#[cfg(test)]
mod test {
    use super::{CANONICAL_NAN, Unpacked};
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, numeric::Numeric, primitive::Primitive},
    };

    fn bits(v: Unpacked<Naive>) -> u64 {
        match v {
            Unpacked::Number(n) => n.to_bits(),
            _ => panic!("a number"),
        }
    }

    /// Every `NaN` a host can hand over — the sign flipped, a payload set,
    /// a signaling one — is the canonical `NaN` once it is a `Number`.
    #[test]
    fn every_nan_is_the_canonical_one() {
        for v in [
            f64::NAN,
            -f64::NAN,
            f64::from_bits(0x7ff8_0000_0000_0001),
            f64::from_bits(0xfff8_0000_0000_0001),
            f64::from_bits(0x7ff0_0000_0000_0001),
        ] {
            assert!(v.is_nan());
            assert_eq!(bits(Unpacked::number(v)), CANONICAL_NAN);
        }
    }

    /// Only a `NaN` is touched: `-0` keeps its sign, and every other bit
    /// pattern is passed through as it came.
    #[test]
    fn other_numbers_keep_their_bits() {
        for v in [
            0.0,
            -0.0,
            1.5,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::MIN_POSITIVE,
            f64::from_bits(1),
        ] {
            assert_eq!(bits(Unpacked::number(v)), v.to_bits());
        }
    }

    /// The paths a number takes into a VM value all canonicalize: a bare
    /// `f64`, a `Numeric`, a `Primitive`, an operator's result — here
    /// `-NaN`, the program the sign flip comes from — and the raw variant a
    /// caller builds around `Unpacked::number`, caught where the VM packs.
    #[test]
    fn every_way_in_canonicalizes() {
        let nan = -f64::NAN;
        assert_ne!(nan.to_bits(), CANONICAL_NAN);
        assert_eq!(bits(nan.to_any::<Naive>().into()), CANONICAL_NAN);
        assert_eq!(bits(Numeric::<Naive>::Number(nan).into()), CANONICAL_NAN);
        assert_eq!(bits(Primitive::<Naive>::Number(nan).into()), CANONICAL_NAN);
        let negated: Any<Naive> = (-f64::NAN.to_any::<Naive>()).unwrap();
        assert_eq!(bits(negated.into()), CANONICAL_NAN);
        let raw = Unpacked::<Naive>::Number(nan);
        assert_ne!(bits(raw.clone()), CANONICAL_NAN);
        assert_eq!(bits(raw.to_any::<Naive>().into()), CANONICAL_NAN);
    }
}
