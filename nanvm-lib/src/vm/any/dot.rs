use crate::vm::{
    Any, IVm,
    lambda::{OptionPropertyLambda, PropertyLambda, Region, read},
};

impl<A: IVm> Any<A> {
    /// The EDAG's `.` node with its continuation, `['.', receiver, key, k]`:
    /// the read `member_access` is, as a chain a continuation may follow
    /// (`fjs/edag/README.md`, Chains). `dot(a, key).end()` is `a.b`, one
    /// spelling for the node with or without a continuation. The key is a
    /// value: `a[k]` evaluates both operands whatever they are.
    pub fn dot(self, key: Self) -> PropertyLambda<A> {
        PropertyLambda(self.member_access(key))
    }

    /// The EDAG's `?.` node, `['?.', receiver, key, k]`: `a?.b`, opening a
    /// short-circuit region. A nullish receiver skips the key and the rest
    /// of the chain — `u?.[todo()]` never calls `todo` — which is why the
    /// key is a thunk.
    pub fn option_dot(self, key: impl FnOnce() -> Result<Self, Self>) -> OptionPropertyLambda<A> {
        OptionPropertyLambda(Region::Live(self).guarded(read(key)))
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToObject},
    };

    type A = Naive;

    fn object() -> Any<A> {
        [("a".into(), 1.0.to_any())].to_object().to_any()
    }

    /// `dot(a, k).end()` is `member_access(a, k)`, both answers.
    #[test]
    fn dot_is_member_access() {
        assert_eq!(object().dot("a".into()).end(), Ok(1.0.to_any()));
        assert_eq!(
            object().dot("b".into()).end(),
            Ok(Nullish::Undefined.to_any())
        );
        assert_eq!(
            Nullish::Null.to_any::<A>().dot("a".into()).end(),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
    }

    /// The node's own key is inside the region it opens: skipped on a
    /// nullish receiver, evaluated on any other.
    #[test]
    fn option_dot_guards_the_key() {
        assert_eq!(
            Nullish::Undefined
                .to_any::<A>()
                .option_dot(|| Err("boom".into()))
                .end(),
            Ok(Nullish::Undefined.to_any())
        );
        assert_eq!(
            object().option_dot(|| Ok("a".into())).end(),
            Ok(1.0.to_any())
        );
        assert_eq!(
            object().option_dot(|| Err("boom".into())).end(),
            Err("boom".into())
        );
    }
}
