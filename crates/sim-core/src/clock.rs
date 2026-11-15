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
