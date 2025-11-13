use crate::vm::{Any, String16};

pub type Property<A> = (String16<A>, Any<A>);
