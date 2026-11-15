pub type Tick = u64; // 1 tick = 1ms of virtual time

#[derive(Clone, Debug)]
pub struct VirtualClock {
    pub current_tick: Tick,
}

impl VirtualClock {
    pub fn advance_one_ms(&mut self) {
        self.current_tick += 1;
    }
}
