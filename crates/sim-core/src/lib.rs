pub mod clock;

pub use clock::{Tick, VirtualClock};

// Core error types and simulation result aliases
pub type SimResult<T> = Result<T, String>;
