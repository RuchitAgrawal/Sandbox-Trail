use rand::Rng;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use sim_core::{Role, SimState};

#[test]
fn test_initial_state() {
    let sim = SimState::new(5, 42);
    assert_eq!(sim.nodes.len(), 5);
    for node in &sim.nodes {
        assert_eq!(node.role, Role::Follower);
        assert_eq!(node.current_term, 0);
        assert_eq!(node.commit_index, 0);
        assert_eq!(node.log.last_log_index(), 0);
    }
}

#[test]
fn test_election_occurs_and_elects_single_leader() {
    let mut sim = SimState::new(5, 42);

    // Advance 600ms (enough for randomized 150-300ms election timeouts and RPC roundtrips)
    for _ in 0..600 {
        sim.step_one_ms();
    }

    let inv = sim.check_invariants();
    assert!(inv.election_safety.is_ok());
    assert!(inv.leader_acknowledged);

    let leaders: Vec<_> = sim.nodes.iter().filter(|n| matches!(n.role, Role::Leader)).collect();
    assert_eq!(leaders.len(), 1, "Exactly one leader should be elected");
    assert!(leaders[0].current_term >= 1);
}

#[test]
fn test_leader_sends_heartbeats_preventing_new_elections() {
    let mut sim = SimState::new(5, 123);

    // Run until leader is elected
    for _ in 0..500 {
        sim.step_one_ms();
    }

    let leader_id = sim.check_invariants().current_leader.expect("Leader must exist");
    let initial_term = sim.nodes[leader_id as usize].current_term;

    // Run another 1000ms: heartbeats should keep followers quiet, term should NOT increase
    for _ in 0..1000 {
        sim.step_one_ms();
    }

    let current_leader = sim.check_invariants().current_leader;
    assert_eq!(current_leader, Some(leader_id));
    assert_eq!(sim.nodes[leader_id as usize].current_term, initial_term);
}

#[test]
fn test_client_write_replicated_and_committed() {
    let mut sim = SimState::new(5, 777);