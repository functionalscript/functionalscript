mod add;
mod cmp;
mod debug;
mod default;
mod from;
mod index;
mod mul;
mod neg;
mod partial_eq;
mod serializable;
mod sized_index;
mod sub;

use core::{cmp::Ordering, iter::once};

use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{IContainer, IVm},
};

/// ```
/// use nanvm_lib::vm::{BigInt, IVm, naive::Naive};
/// fn bigint_test<A: IVm>() {
///     let a: BigInt<A> = 12345678901234567890u64.into();
///     let b: BigInt<A> = (-1234567890123456789i64).into();
/// }
///
/// bigint_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct BigInt<A: IVm>(A::InternalBigInt);

impl<A: IVm> BigInt<A> {
    fn is_zero(&self) -> bool {
        self.0.items().is_empty()
    }

    fn new(sign: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        Self(A::InternalBigInt::new_ok(sign, items))
    }

    fn new_one(sign: Sign, value: u64) -> Self {
        Self::new(sign, once(value))
    }

    fn add_to_vec(mut vec: Vec<u64>, index: u32, add: u128) -> Vec<u64> {
        // TODO: replace recursion with loop.
        let sum = vec[index as usize] as u128 + add;
        vec[index as usize] = sum as u64;
        let carry = sum >> 64;
        if carry > 0 {
            vec = Self::add_to_vec(vec, index + 1, carry);
        }
        vec
    }

    // NOTE: use .index_iter in abs_* helpers.

    fn abs_cmp_vec(self, _rhs: Self) -> Ordering {
        let a: Vec<u64> = self.index_iter().collect();
        let b: Vec<u64> = _rhs.index_iter().collect();
        let la = a.len();
        let lb = b.len();
        if la != lb {
            return la.cmp(&lb);
        }
        for i in (0..la).rev() {
            if a[i] != b[i] {
                return if a[i] > b[i] {
                    Ordering::Greater
                } else {
                    Ordering::Less
                };
            }
        }
        Ordering::Equal
    }

    fn abs_add_vec(self, _rhs: Self) -> Vec<u64> {
        let mut iter_a = self.index_iter();
        let mut iter_b = _rhs.index_iter();
        let mut carry: u128 = 0;
        let mut out: Vec<u64> = Vec::new();
        loop {
            match (iter_a.next(), iter_b.next()) {
                (Some(a), Some(b)) => {
                    let sum = a as u128 + b as u128 + carry;
                    out.push(sum as u64);
                    carry = sum >> 64;
                }
                (Some(a), None) => {
                    let mut s = a as u128 + carry;
                    out.push(s as u64);
                    carry = s >> 64;
                    for aa in iter_a {
                        s = aa as u128 + carry;
                        out.push(s as u64);
                        carry = s >> 64;
                    }
                    break;
                }
                (None, Some(b)) => {
                    let mut s = b as u128 + carry;
                    out.push(s as u64);
                    carry = s >> 64;
                    for bb in iter_b {
                        s = bb as u128 + carry;
                        out.push(s as u64);
                        carry = s >> 64;
                    }
                    break;
                }
                (None, None) => break,
            }
        }
        if carry > 0 {
            out.push(carry as u64);
        }
        out
    }

    fn abs_sub_vec(self, _rhs: Self) -> Vec<u64> {
        let mut iter_a = self.index_iter();
        let mut iter_b = _rhs.index_iter();
        let mut borrow: u128 = 0;
        let mut out: Vec<u64> = Vec::new();
        loop {
            let a_opt = iter_a.next();
            let b_opt = iter_b.next();
            if a_opt.is_none() && b_opt.is_none() {
                break;
            }
            let a = a_opt.unwrap_or(0u64);
            let b = b_opt.unwrap_or(0u64);
            let subtrahend = b as u128 + borrow;
            if (a as u128) >= subtrahend {
                out.push((a as u128 - subtrahend) as u64);
                borrow = 0;
            } else {
                out.push(((1u128 << 64) + a as u128 - subtrahend) as u64);
                borrow = 1;
            }
        }
        // Trim leading zeros (most-significant words)
        while let Some(&last) = out.last() {
            if last == 0 {
                out.pop();
            } else {
                break;
            }
        }
        out
    }
}
