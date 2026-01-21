/**
 * Initial implementation of BigUint based on https://github.com/functionalscript/nanvm/tree/main/nanvm-lib/src/big_numbers/big_uint.rs
 * Credits: https://github.com/Trinidadec
 */
use core::{
    cmp::Ordering,
    iter,
    ops::{Add, Div, Mul, Shl, Shr, Sub},
};

use super::common::default::default;

#[derive(Debug, PartialEq, Clone, Eq, Default)]
pub struct BigUint {
    pub value: Vec<u64>,
}

impl BigUint {
    pub const ZERO: BigUint = BigUint { value: Vec::new() };

    pub fn one() -> BigUint {
        BigUint {
            value: [1].to_vec(),
        }
    }

    pub fn normalize(&mut self) {
        while let Some(&0) = self.value.last() {
            self.value.pop();
        }
    }

    pub fn is_one(&self) -> bool {
        self.len() == 1 && self.value[0] == 1
    }

    pub fn len(&self) -> usize {
        self.value.len()
    }

    // Clippy wants is_empty as soon as it sees len.
    // We want to use is_zero instead, but let's be respectful to Clippy anyway.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn is_zero(&self) -> bool {
        self.is_empty()
    }

    pub fn from_u64(n: u64) -> Self {
        BigUint {
            value: [n].to_vec(),
        }
    }

    pub fn pow(&self, exp: &BigUint) -> BigUint {
        if self.is_one() {
            return BigUint::one();
        }

        if self.is_zero() {
            return if exp.is_zero() {
                BigUint::one()
            } else {
                BigUint::ZERO
            };
        }

        if exp.is_zero() {
            return BigUint::one();
        }

        if exp.len() != 1 {
            panic!("Maximum BigUint size exceeded")
        }

        self.pow_u64(exp.value[0])
    }

    pub fn pow_u64(&self, mut exp: u64) -> BigUint {
        let mut res = BigUint::one();
        let mut b = self.clone();
        loop {
            if exp == 0 {
                return res;
            }
            if exp & 1 > 0 {
                res = &res * &b;
            }
            exp >>= 1;
            b = &b * &b;
        }
    }

    pub fn get_last_bit(&self) -> u64 {
        if self.is_zero() {
            return 0;
        }

        self.value[0] & 1
    }

    fn cmp(a: &[u64], b: &[u64]) -> Ordering {
        let a_len = a.len();
        let b_len = b.len();
        if a_len != b_len {
            return a_len.cmp(&b_len);
        }

        for (a_digit, b_digit) in a.iter().copied().rev().zip(b.iter().copied().rev()) {
            if a_digit != b_digit {
                return a_digit.cmp(&b_digit);
            }
        }

        Ordering::Equal
    }

    pub fn add(a: &[u64], b: &[u64]) -> Self {
        let mut value: Vec<_> = default();
        let mut carry = 0;
        let iter = match b.len() > a.len() {
            true => b
                .iter()
                .copied()
                .zip(a.iter().copied().chain(iter::repeat(0))),
            false => a
                .iter()
                .copied()
                .zip(b.iter().copied().chain(iter::repeat(0))),
        };
        for (digit, other_digit) in iter {
            let next = digit as u128 + other_digit as u128 + carry;
            value.push(next as u64);
            carry = next >> 64;
        }
        if carry != 0 {
            value.push(carry as u64);
        }
        BigUint { value }
    }

    pub fn sub(a: &[u64], b: &[u64]) -> Self {
        match BigUint::cmp(a, b) {
            Ordering::Less | Ordering::Equal => BigUint::ZERO,
            Ordering::Greater => {
                let mut value: Vec<_> = default();
                let mut borrow = 0;
                let iter = a
                    .iter()
                    .copied()
                    .zip(b.iter().copied().chain(iter::repeat(0)));
                for (digit, other_digit) in iter {
                    let next = digit as i128 - other_digit as i128 - borrow;
                    value.push(next as u64);
                    borrow = next >> 64 & 1;
                }
                let mut res = BigUint { value };
                res.normalize();
                res
            }
        }
    }

    pub fn div_mod(a: &[u64], b: &[u64]) -> (BigUint, BigUint) {
        if b.is_empty() {
            panic!("attempt to divide by zero");
        }

        let left = BigUint { value: a.to_vec() };
        let right = BigUint { value: b.to_vec() };
        match left.cmp(&right) {
            Ordering::Less => (default(), left),
            Ordering::Equal => (
                BigUint {
                    value: [1].to_vec(),
                },
                default(),
            ),
            Ordering::Greater => {
                let mut a = left;
                let mut result = BigUint::ZERO;
                loop {
                    if a.cmp(&right) == Ordering::Less {
                        return (result, a);
                    }
                    let a_high_digit = a.len() - 1;
                    let b_high_digit = b.len() - 1;
                    let a_high = a.value[a_high_digit];
                    let b_high = b[b_high_digit];
                    let (q_index, q_digit) = match b_high.cmp(&a_high) {
                        Ordering::Less | Ordering::Equal => {
                            (a_high_digit - b_high_digit, a_high / b_high)
                        }
                        Ordering::Greater => {
                            let a_high_2 =
                                ((a_high as u128) << 64) + a.value[a_high_digit - 1] as u128;
                            (
                                a_high_digit - b_high_digit - 1,
                                (a_high_2 / b_high as u128) as u64,
                            )
                        }
                    };
                    let mut q = BigUint {
                        value: new_resize(q_index + 1),
                    };
                    q.value[q_index] = q_digit;
                    let mut m = &right * &q;
                    if a.cmp(&m) == Ordering::Less {
                        q.value[q_index] = q_digit - 1;
                        m = BigUint::mul(b, &q.value);
                    }
                    a = &a - &m;
                    result = &result + &q;
                }
            }
        }
    }

    pub fn mul(a: &[u64], b: &[u64]) -> Self {
        if a.is_empty() || b.is_empty() {
            return BigUint::ZERO;
        }

        let lhs_max = a.len() - 1;
        let rhs_max = b.len() - 1;
        let total_max = a.len() + b.len() - 1;
        let mut value = new_resize(total_max + 1);
        let mut i: usize = 0;
        while i < total_max {
            let mut j = i.saturating_sub(rhs_max);
            let max = if i < lhs_max { i } else { lhs_max };
            while j <= max {
                value = add_to_vec(value, i, a[j] as u128 * b[i - j] as u128);
                j += 1;
            }
            i += 1;
        }

        let mut result = BigUint { value };
        result.normalize();
        result
    }

    pub fn shl(n: &[u64], rhs: &[u64]) -> Self {
        if n.is_empty() || rhs.is_empty() {
            return BigUint { value: n.to_vec() };
        }

        if rhs.len() != 1 {
            panic!("Maximum BigUint size exceeded")
        }

        let mut value = n.to_vec();
        let shift_mod = rhs[0] & ((1 << 6) - 1);
        if shift_mod > 0 {
            let len = value.len();
            value.push(0); //todo: check if it is necessary?
            for i in (0..=len - 1).rev() {
                let mut digit = value[i] as u128;
                digit <<= shift_mod;
                value[i + 1] |= (digit >> 64) as u64;
                value[i] = digit as u64;
            }
        }

        let number_of_zeros = (rhs[0] / 64) as usize;
        if number_of_zeros > 0 {
            let mut zeros_vector: Vec<_> = new_resize(number_of_zeros);
            zeros_vector.extend(value);
            value = zeros_vector;
        }

        let mut res = BigUint { value };
        res.normalize();
        res
    }

    pub fn shr(n: &[u64], rhs: &[u64]) -> Self {
        if n.is_empty() || rhs.is_empty() {
            return BigUint { value: n.to_vec() };
        }

        let number_to_remove = (rhs[0] / 64) as usize;
        if number_to_remove >= n.len() {
            return BigUint::ZERO;
        }

        let mut value = n.to_vec();
        value = value.split_off(number_to_remove);
        let shift_mod = rhs[0] & ((1 << 6) - 1);
        if shift_mod > 0 {
            let len = value.len();
            let mask = 1 << (shift_mod - 1);
            let mut i = 0;
            loop {
                value[i] >>= shift_mod;
                i += 1;
                if i == len {
                    break;
                }
                value[i - 1] |= (value[i] & mask) << (64 - shift_mod);
            }
        }

        let mut res = BigUint { value };
        res.normalize();
        res
    }
}

impl Add for &BigUint {
    type Output = BigUint;
    fn add(self, other: Self) -> Self::Output {
        BigUint::add(&self.value, &other.value)
    }
}

impl Sub for &BigUint {
    type Output = BigUint;
    fn sub(self, other: Self) -> Self::Output {
        BigUint::sub(&self.value, &other.value)
    }
}

impl PartialOrd for BigUint {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for BigUint {
    fn cmp(&self, other: &Self) -> Ordering {
        BigUint::cmp(&self.value, &other.value)
    }
}

impl Mul for &BigUint {
    type Output = BigUint;
    fn mul(self, other: Self) -> Self::Output {
        BigUint::mul(&self.value, &other.value)
    }
}

impl Div for &BigUint {
    type Output = Option<BigUint>;

    fn div(self, b: Self) -> Self::Output {
        if b.is_zero() {
            return None;
        }

        let (res, _) = BigUint::div_mod(self.value.as_slice(), b.value.as_slice());
        Some(res)
    }
}

impl Shl for &BigUint {
    type Output = BigUint;

    fn shl(self, rhs: Self) -> Self::Output {
        BigUint::shl(&self.value, &rhs.value)
    }
}

impl Shr for &BigUint {
    type Output = BigUint;

    fn shr(self, rhs: Self) -> Self::Output {
        BigUint::shr(&self.value, &rhs.value)
    }
}

pub fn new_resize<T: Default + Clone>(size: usize) -> Vec<T> {
    let mut vec = Vec::with_capacity(size);
    vec.resize(size, default());
    vec
}

fn add_to_vec(mut vec: Vec<u64>, index: usize, add: u128) -> Vec<u64> {
    let sum = vec[index] as u128 + add;
    vec[index] = sum as u64;
    let carry = sum >> 64;
    if carry > 0 {
        vec = add_to_vec(vec, index + 1, carry);
    }
    vec
}

#[cfg(test)]
mod test {
    use std::cmp::Ordering;

    use super::BigUint;

    #[test]
    fn test_ord() {
        let a = BigUint {
            value: [1].to_vec(),
        };
        let b = BigUint {
            value: [1].to_vec(),
        };
        assert_eq!(a.cmp(&b), Ordering::Equal);

        let a = BigUint {
            value: [1].to_vec(),
        };
        let b = BigUint {
            value: [2].to_vec(),
        };
        assert_eq!(a.cmp(&b), Ordering::Less);

        let a = BigUint {
            value: [2].to_vec(),
        };
        let b = BigUint {
            value: [1].to_vec(),
        };
        assert_eq!(a.cmp(&b), Ordering::Greater);

        let a = BigUint {
            value: [1, 2].to_vec(),
        };
        let b = BigUint {
            value: [2, 1].to_vec(),
        };
        assert_eq!(a.cmp(&b), Ordering::Greater);
    }

    #[test]
    fn test_add() {
        let a = BigUint {
            value: [1].to_vec(),
        };
        let b = BigUint {
            value: [2].to_vec(),
        };
        let result = &a + &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [3].to_vec()
            }
        );

        let a = BigUint {
            value: [1].to_vec(),
        };
        let b = BigUint {
            value: [2, 4].to_vec(),
        };
        let result = &a + &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [3, 4].to_vec()
            }
        );

        let a = BigUint {
            value: [1 << 63].to_vec(),
        };
        let b = BigUint {
            value: [1 << 63].to_vec(),
        };
        let result = &a + &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [0, 1].to_vec()
            }
        );
    }

    #[test]
    fn test_add_overflow() {
        let a = BigUint {
            value: [u64::MAX, 0, 1].to_vec(),
        };
        let b = BigUint {
            value: [u64::MAX, u64::MAX].to_vec(),
        };
        let result = &a + &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [u64::MAX - 1, 0, 2].to_vec()
            }
        );
        let result = &b + &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [u64::MAX - 1, 0, 2].to_vec()
            }
        );
    }

    #[test]
    fn test_sub() {
        let a = BigUint {
            value: [1 << 63].to_vec(),
        };
        let b = BigUint {
            value: [1 << 63].to_vec(),
        };
        let result = &a - &b;
        assert_eq!(result, BigUint::ZERO);

        let a = BigUint {
            value: [3].to_vec(),
        };
        let b = BigUint {
            value: [2].to_vec(),
        };
        let result = &a - &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );
        let result = &b - &a;
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint {
            value: [0, 1].to_vec(),
        };
        let b = BigUint {
            value: [1].to_vec(),
        };
        let result = &a - &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [u64::MAX].to_vec()
            }
        );
    }

    #[test]
    fn test_mul() {
        let a = BigUint {
            value: [1].to_vec(),
        };
        let result = &a * &BigUint::ZERO;
        assert_eq!(&result, &BigUint::ZERO);
        let result = &BigUint::ZERO * &a;
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint {
            value: [1].to_vec(),
        };
        let result = &a * &a;
        assert_eq!(&result, &a);

        let a = BigUint {
            value: [1, 2, 3, 4].to_vec(),
        };
        let b = BigUint {
            value: [5, 6, 7].to_vec(),
        };
        let result = &a * &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [5, 16, 34, 52, 45, 28].to_vec()
            },
        );
        let result = &b * &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [5, 16, 34, 52, 45, 28].to_vec()
            },
        );

        let a = BigUint {
            value: [u64::MAX].to_vec(),
        };
        let b = BigUint {
            value: [u64::MAX].to_vec(),
        };
        let result = &a * &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX - 1].to_vec()
            },
        );
        let result = &b * &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX - 1].to_vec()
            },
        );

        let a = BigUint {
            value: [u64::MAX, u64::MAX, u64::MAX].to_vec(),
        };
        let b = BigUint {
            value: [u64::MAX].to_vec(),
        };
        let result = &a * &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX, u64::MAX, u64::MAX - 1].to_vec()
            },
        );
        let result = &b * &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX, u64::MAX, u64::MAX - 1].to_vec()
            },
        );
    }

    #[test]
    fn test_div_by_zero() {
        let a = BigUint {
            value: [1].to_vec(),
        };
        let result = &a / &BigUint::ZERO;
        assert_eq!(result, None);
    }

    #[test]
    fn test_div_zero_by_zero() {
        let result = &BigUint::ZERO / &BigUint::ZERO;
        assert_eq!(result, None);
    }

    #[test]
    fn test_div_simple() {
        let a = BigUint {
            value: [2].to_vec(),
        };
        let b = BigUint {
            value: [7].to_vec(),
        };
        let result = &a / &b;
        assert_eq!(&result.unwrap(), &BigUint::ZERO);

        let a = BigUint {
            value: [7].to_vec(),
        };
        let result = &a / &a;
        assert_eq!(
            &result.unwrap(),
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint {
            value: [7].to_vec(),
        };
        let b = BigUint {
            value: [2].to_vec(),
        };
        let result = &a / &b;
        assert_eq!(
            &result.unwrap(),
            &BigUint {
                value: [3].to_vec()
            }
        );

        let a = BigUint {
            value: [6, 8].to_vec(),
        };
        let b = BigUint {
            value: [2].to_vec(),
        };
        let result = &a / &b;
        assert_eq!(
            &result.unwrap(),
            &BigUint {
                value: [3, 4].to_vec()
            }
        );

        let a = BigUint {
            value: [4, 7].to_vec(),
        };
        let b = BigUint {
            value: [2].to_vec(),
        };
        let result = &a / &b;
        assert_eq!(
            &result.unwrap(),
            &BigUint {
                value: [(1 << 63) + 2, 3].to_vec()
            }
        );

        let a = BigUint {
            value: [0, 4].to_vec(),
        };
        let b = BigUint {
            value: [1, 2].to_vec(),
        };
        let result = &a / &b;
        assert_eq!(
            &result.unwrap(),
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint {
            value: [1, 1].to_vec(),
        };
        let b = BigUint {
            value: [1].to_vec(),
        };
        let result = &a / &b;
        assert_eq!(
            &result.unwrap(),
            &BigUint {
                value: [1, 1].to_vec()
            }
        );
    }

    #[test]
    fn test_div_mod() {
        let result = BigUint::div_mod(&[7], &[2]);
        assert_eq!(
            result,
            (
                BigUint {
                    value: [3].to_vec()
                },
                BigUint {
                    value: [1].to_vec()
                }
            )
        );

        let result = BigUint::div_mod(&[7, 5], &[0, 3]);
        assert_eq!(
            result,
            (
                BigUint {
                    value: [1].to_vec()
                },
                BigUint {
                    value: [7, 2].to_vec()
                }
            )
        );
    }

    #[test]
    fn test_pow_u64() {
        let a = BigUint {
            value: [100].to_vec(),
        };
        let result = a.pow_u64(0);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint {
            value: [2].to_vec(),
        };
        let result = a.pow_u64(7);
        assert_eq!(
            &result,
            &BigUint {
                value: [128].to_vec()
            }
        );

        let a = BigUint {
            value: [5].to_vec(),
        };
        let result = a.pow_u64(3);
        assert_eq!(
            &result,
            &BigUint {
                value: [125].to_vec()
            }
        );

        let a = BigUint::ZERO;
        let result = a.pow_u64(3);
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint::ZERO;
        let result = a.pow_u64(0);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint::one();
        let result = a.pow_u64(0);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint::one();
        let result = a.pow_u64(100);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );
    }

    #[test]
    fn test_pow() {
        let a = BigUint {
            value: [100].to_vec(),
        };
        let result = a.pow(&BigUint::ZERO);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint {
            value: [2].to_vec(),
        };
        let result = a.pow(&BigUint {
            value: [7].to_vec(),
        });
        assert_eq!(
            &result,
            &BigUint {
                value: [128].to_vec()
            }
        );

        let a = BigUint {
            value: [5].to_vec(),
        };
        let result = a.pow(&BigUint {
            value: [3].to_vec(),
        });
        assert_eq!(
            &result,
            &BigUint {
                value: [125].to_vec()
            }
        );

        let a = BigUint::ZERO;
        let result = a.pow(&BigUint {
            value: [100, 100].to_vec(),
        });
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint::ZERO;
        let result = a.pow(&BigUint::ZERO);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint::one();
        let result = a.pow(&BigUint::ZERO);
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint::one();
        let result = a.pow(&BigUint {
            value: [100, 100].to_vec(),
        });
        assert_eq!(
            &result,
            &BigUint {
                value: [1].to_vec()
            }
        );
    }

    #[test]
    #[should_panic(expected = "Maximum BigUint size exceeded")]
    fn test_pow_overflow() {
        let a = BigUint {
            value: [5].to_vec(),
        };
        let _result = a.pow(&BigUint {
            value: [100, 100].to_vec(),
        });
    }

    #[test]
    fn test_shl_zero() {
        let result = &BigUint::ZERO << &BigUint::ZERO;
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint {
            value: [5].to_vec(),
        };
        let result = &a << &BigUint::ZERO;
        assert_eq!(result, a);

        let result = &BigUint::ZERO << &a;
        assert_eq!(result, BigUint::ZERO);
    }

    #[test]
    fn test_shl() {
        let a = BigUint {
            value: [1].to_vec(),
        };
        let result = &a << &a;
        assert_eq!(
            result,
            BigUint {
                value: [2].to_vec()
            }
        );

        let a = BigUint {
            value: [5].to_vec(),
        };
        let b = BigUint {
            value: [63].to_vec(),
        };
        let result = &a << &b;
        assert_eq!(
            result,
            BigUint {
                value: [1 << 63, 2].to_vec()
            }
        );

        let a = BigUint {
            value: [5, 9].to_vec(),
        };
        let b = BigUint {
            value: [63].to_vec(),
        };
        let result = &a << &b;
        assert_eq!(
            result,
            BigUint {
                value: [1 << 63, (1 << 63) + 2, 4].to_vec()
            }
        );

        let a = BigUint {
            value: [5, 9].to_vec(),
        };
        let b = BigUint {
            value: [64].to_vec(),
        };
        let result = &a << &b;
        assert_eq!(
            result,
            BigUint {
                value: [0, 5, 9].to_vec()
            }
        );

        let a = BigUint {
            value: [5, 9].to_vec(),
        };
        let b = BigUint {
            value: [65].to_vec(),
        };
        let result = &a << &b;
        assert_eq!(
            result,
            BigUint {
                value: [0, 10, 18].to_vec()
            }
        );
    }

    #[test]
    #[should_panic(expected = "Maximum BigUint size exceeded")]
    fn test_shl_overflow() {
        let a = BigUint::one();
        let b = BigUint {
            value: [1, 1].to_vec(),
        };
        let _result = &a << &b;
    }

    #[test]
    fn test_shr_zero() {
        let result = &BigUint::ZERO >> &BigUint::ZERO;
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint {
            value: [5].to_vec(),
        };
        let result = &a >> &BigUint::ZERO;
        assert_eq!(result, a);

        let result = &BigUint::ZERO >> &a;
        assert_eq!(result, BigUint::ZERO);
    }

    #[test]
    fn test_shr() {
        let a = BigUint {
            value: [1, 1, 1, 1].to_vec(),
        };
        let b = BigUint {
            value: [256].to_vec(),
        };
        let result = &a >> &b;
        assert_eq!(result, BigUint::ZERO);

        let a = BigUint {
            value: [1].to_vec(),
        };
        let result = &a >> &a;
        assert_eq!(result, BigUint::ZERO);

        let a = BigUint {
            value: [2].to_vec(),
        };
        let b = BigUint {
            value: [1].to_vec(),
        };
        let result = &a >> &b;
        assert_eq!(
            result,
            BigUint {
                value: [1].to_vec()
            }
        );

        let a = BigUint {
            value: [1, 5, 9].to_vec(),
        };
        let b = BigUint {
            value: [65].to_vec(),
        };
        let result = &a >> &b;
        assert_eq!(
            result,
            BigUint {
                value: [(1 << 63) + 2, 4].to_vec()
            }
        );
    }
}
