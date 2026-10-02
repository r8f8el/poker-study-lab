import pytest
from services.game_state.sqlite_event_store import SqliteEventStore


def test_sqlite_event_store_initialization():
    store = SqliteEventStore(":memory:")
    hands = store.get_hands()
    assert len(hands) == 0
    store.close()


def test_sqlite_event_store_append_and_retrieve():
    store = SqliteEventStore(":memory:")
    hand_id = "hand_test_001"
    store.create_hand(hand_id, "tbl_main", "NLH")

    ev1 = {
        "event_id": "e_01",
        "hand_id": hand_id,
        "type": "HAND_STARTED",
        "street": "PREFLOP",
        "data": {"smallBlind": 1, "bigBlind": 2},
        "confidence": 1.0,
        "timestamp": "2026-09-30T10:00:00Z",
    }
    ev2 = {
        "event_id": "e_02",
        "hand_id": hand_id,
        "type": "HOLE_CARDS_CONFIRMED",
        "street": "PREFLOP",
        "data": {"cards": ["Ac", "Kd"]},
        "confidence": 0.99,
        "timestamp": "2026-09-30T10:00:02Z",
    }

    store.append_event(ev1)
    store.append_event(ev2)

    events = store.get_events(hand_id)
    assert len(events) == 2
    assert events[0]["sequence"] == 1
    assert events[1]["sequence"] == 2
    assert events[0]["type"] == "HAND_STARTED"
    assert events[1]["data"]["cards"] == ["Ac", "Kd"]

    hands = store.get_hands()
    assert len(hands) == 1
    assert hands[0]["total_events"] == 2
    store.close()


def test_sqlite_state_reconstruction():
    store = SqliteEventStore(":memory:")
    hand_id = "hand_recon_002"

    events = [
        {
            "event_id": "ev_1",
            "hand_id": hand_id,
            "type": "APP_DETECTED",
            "street": "PREFLOP",
            "data": {"appIdentifier": "com.auth.poker.client"},
            "confidence": 1.0,
        },
        {
            "event_id": "ev_2",
            "hand_id": hand_id,
            "type": "TABLE_DETECTED",
            "street": "PREFLOP",
            "data": {"tableId": "table_007"},
            "confidence": 1.0,
        },
        {
            "event_id": "ev_3",
            "hand_id": hand_id,
            "type": "HAND_STARTED",
            "street": "PREFLOP",
            "data": {"smallBlind": 2, "bigBlind": 5},
            "confidence": 1.0,
        },
        {
            "event_id": "ev_4",
            "hand_id": hand_id,
            "type": "HOLE_CARDS_CONFIRMED",
            "street": "PREFLOP",
            "data": {"cards": ["Qh", "Qd"]},
            "confidence": 0.98,
        },
        {
            "event_id": "ev_5",
            "hand_id": hand_id,
            "type": "BOARD_CARD_CONFIRMED",
            "street": "FLOP",
            "data": {"board": ["Qs", "8c", "2d"]},
            "confidence": 0.99,
        },
        {
            "event_id": "ev_6",
            "hand_id": hand_id,
            "type": "PLAYER_ACTION_CONFIRMED",
            "street": "FLOP",
            "data": {"player": "Hero", "action": "bet", "amount": 15},
            "confidence": 1.0,
        },
        {
            "event_id": "ev_7",
            "hand_id": hand_id,
            "type": "HAND_FINISHED",
            "street": "FLOP",
            "data": {},
            "confidence": 1.0,
        },
    ]

    for ev in events:
        store.append_event(ev)

    reconstructed = store.reconstruct_state(hand_id)
    assert reconstructed["app_id"] == "com.auth.poker.client"
    assert reconstructed["table_id"] == "table_007"
    assert reconstructed["hero_cards"] == ["Qh", "Qd"]
    assert reconstructed["board"] == ["Qs", "8c", "2d"]
    assert reconstructed["street"] == "FLOP"
    assert reconstructed["status"] == "HAND_COMPLETE"
    assert reconstructed["pot"] == 7 + 15  # 2+5 blinds + 15 bet
    assert len(reconstructed["action_history"]) == 1
    assert reconstructed["is_finished"] is True

    store.close()
