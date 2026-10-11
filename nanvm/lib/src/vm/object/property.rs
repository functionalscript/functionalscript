use crate::vm::{Any, String};

pub type Property<A> = (String<A>, Any<A>);
