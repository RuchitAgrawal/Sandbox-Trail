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

    // Wait for leader
    for _ in 0..500 {
        sim.step_one_ms();
    }

    let leader_id = sim.check_invariants().current_leader.expect("Must have leader");
    let ack = sim.client_write(leader_id, "SET key = 100".to_string());
    assert!(ack.success);
    assert_eq!(ack.index, 1);

    // Wait for 2 round trips (~100ms) for replication and commit
    for _ in 0..150 {
        sim.step_one_ms();
    }

    assert_eq!(sim.nodes[leader_id as usize].commit_index, 1);

    // Check majority of followers also committed
    let committed_count = sim.nodes.iter().filter(|n| n.commit_index >= 1).count();
    assert!(committed_count >= 3, "Majority must commit the entry");
}

#[test]
fn test_client_write_rejected_by_follower() {
    let mut sim = SimState::new(5, 999);

    for _ in 0..500 {
        sim.step_one_ms();
    }

    let leader_id = sim.check_invariants().current_leader.expect("Leader exists");
    let follower_id = (0..5).find(|&id| id != leader_id).unwrap();

    let ack = sim.client_write(follower_id, "SET x = 1".to_string());
    assert!(!ack.success, "Follower must reject client write");
}

#[test]
fn test_leader_crash_triggers_reelection() {
    let mut sim = SimState::new(5, 101);

    // Wait for initial election
    for _ in 0..500 {
        sim.step_one_ms();
    }

    let first_leader = sim.check_invariants().current_leader.expect("Leader exists");
    let first_term = sim.nodes[first_leader as usize].current_term;

    // Crash the leader
    sim.toggle_crash(first_leader);
    assert!(sim.nodes[first_leader as usize].is_crashed());

    // Advance 600ms for follower timeout and re-election
    for _ in 0..600 {
        sim.step_one_ms();
    }

    let inv = sim.check_invariants();
    assert!(inv.election_safety.is_ok());
    let new_leader = inv.current_leader.expect("New leader must be elected");
    assert_ne!(new_leader, first_leader);
    assert!(sim.nodes[new_leader as usize].current_term > first_term);
}

#[test]
fn test_crashed_node_restart_preserves_term_and_log() {
    let mut sim = SimState::new(5, 202);

    for _ in 0..500 {
        sim.step_one_ms();
    }

    let leader_id = sim.check_invariants().current_leader.unwrap();
    sim.client_write(leader_id, "SET val = 42".to_string());

    for _ in 0..150 {
        sim.step_one_ms();
    }