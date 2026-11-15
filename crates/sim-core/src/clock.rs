use rand::Rng;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

pub type Tick = u64; // 1 tick = 1ms of virtual time

#[derive(Clone, Debug)]
pub struct VirtualClock {
    pub current_tick: Tick,
    pub rng: ChaCha8Rng,
}

impl VirtualClock {
    pub fn new(seed: u64) -> Self {
        Self {
            current_tick: 0,
            rng: ChaCha8Rng::seed_from_u64(seed),
        }
    }

    pub fn advance_one_ms(&mut self) {
        self.current_tick += 1;
    }

    pub fn rand_range(&mut self, lo: u64, hi: u64) -> u64 {
        if lo >= hi {
            return lo;
        }
        self.rng.gen_range(lo..hi)
    }

    pub fn gen_f32(&mut self) -> f32 {
        self.rng.gen::<f32>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clock_deterministic_advancement() {
        let mut clock = VirtualClock::new(42);
        assert_eq!(clock.current_tick, 0);
        clock.advance_one_ms();
        assert_eq!(clock.current_tick, 1);
        let r1 = clock.rand_range(10, 50);
        assert!((10..50).contains(&r1));
    }
}
