"""
SQLite EventStore Implementation for Poker Study Lab.
Guarantees append-only immutable event logs with sequential ordering and
deterministic state reconstruction from confirmed events.
"""

from __future__ import annotations
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class SqliteEventStore:
    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS hands (
                hand_id TEXT PRIMARY KEY,
                table_id TEXT NOT NULL,
                game_type TEXT NOT NULL DEFAULT 'NLH',
                started_at TEXT NOT NULL,
                finished_at TEXT,
                total_events INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                sequence INTEGER NOT NULL,
                hand_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                street TEXT NOT NULL,
                data_json TEXT NOT NULL,
                confidence REAL NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (hand_id) REFERENCES hands (hand_id)
            )
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_events_hand_seq
            ON events (hand_id, sequence)
            """
        )
        self._conn.commit()

    def create_hand(
        self, hand_id: str, table_id: str, game_type: str = "NLH"
    ) -> Dict[str, Any]:
        cursor = self._conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT OR IGNORE INTO hands (hand_id, table_id, game_type, started_at, total_events)
            VALUES (?, ?, ?, ?, 0)
            """,
            (hand_id, table_id, game_type, now),
        )
        self._conn.commit()
        return {
            "hand_id": hand_id,
            "table_id": table_id,
            "game_type": game_type,
            "started_at": now,
            "total_events": 0,
        }

    def finish_hand(self, hand_id: str) -> None:
        cursor = self._conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "UPDATE hands SET finished_at = ? WHERE hand_id = ?",
            (now, hand_id),
        )
        self._conn.commit()

    def append_event(self, event: Dict[str, Any]) -> None:
        hand_id = event["hand_id"]
        # Ensure hand exists
        self.create_hand(hand_id, "tbl_default")

        cursor = self._conn.cursor()
        # Compute sequence if missing
        seq = event.get("sequence")
        if seq is None or seq <= 0:
            cursor.execute(
                "SELECT COUNT(*) FROM events WHERE hand_id = ?", (hand_id,)
            )
            count = cursor.fetchone()[0]
            seq = count + 1

        data_str = json.dumps(event.get("data", {}))
        ts = event.get("timestamp") or datetime.now(timezone.utc).isoformat()

        cursor.execute(
            """
            INSERT INTO events (event_id, sequence, hand_id, event_type, street, data_json, confidence, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["event_id"],
                seq,
                hand_id,
                event["type"],
                event.get("street", "PREFLOP"),
                data_str,
                float(event.get("confidence", 1.0)),
                ts,
            ),
        )

        cursor.execute(
            "UPDATE hands SET total_events = (SELECT COUNT(*) FROM events WHERE hand_id = ?) WHERE hand_id = ?",
            (hand_id, hand_id),
        )
        self._conn.commit()

    def get_events(self, hand_id: str) -> List[Dict[str, Any]]:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            SELECT event_id, sequence, hand_id, event_type, street, data_json, confidence, timestamp
            FROM events
            WHERE hand_id = ?
            ORDER BY sequence ASC
            """,
            (hand_id,),
        )
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append(
                {
                    "event_id": r["event_id"],
                    "sequence": r["sequence"],
                    "hand_id": r["hand_id"],
                    "type": r["event_type"],
                    "street": r["street"],
                    "data": json.loads(r["data_json"]),
                    "confidence": r["confidence"],
                    "timestamp": r["timestamp"],
                }
            )
        return result

    def get_hands(self) -> List[Dict[str, Any]]:
        cursor = self._conn.cursor()
        cursor.execute("SELECT * FROM hands ORDER BY started_at DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

    def reconstruct_state(self, hand_id: str) -> Dict[str, Any]:
        """
        Reconstructs the full game state for a hand purely from its event log.
        """
        events = self.get_events(hand_id)
        state: Dict[str, Any] = {
            "hand_id": hand_id,
            "table_id": "tbl_default",
            "app_id": "com.auth.poker.client",
            "street": "PREFLOP",
            "status": "NEW_HAND",
            "hero_cards": [],
            "board": [],
            "pot": 0,
            "action_history": [],
            "active_player": "hero",
            "confidence": 1.0,
            "is_finished": False,
        }

        for ev in events:
            ev_type = ev["type"]
            data = ev["data"]
            street = ev.get("street", state["street"])
            state["street"] = street

            if ev_type == "APP_DETECTED":
                state["app_id"] = data.get("appIdentifier", state["app_id"])

            elif ev_type == "TABLE_DETECTED":
                state["table_id"] = data.get("tableId", state["table_id"])

            elif ev_type == "HAND_STARTED":
                state["hero_cards"] = []
                state["board"] = []
                state["action_history"] = []
                state["pot"] = data.get("smallBlind", 1) + data.get("bigBlind", 2)
                state["status"] = "PREFLOP"
                state["street"] = "PREFLOP"

            elif ev_type == "HOLE_CARDS_CONFIRMED":
                state["hero_cards"] = data.get("cards", [])

            elif ev_type == "BOARD_CARD_CONFIRMED":
                board = data.get("board", [])
                state["board"] = board
                if len(board) == 3:
                    state["street"] = "FLOP"
                    state["status"] = "FLOP"
                elif len(board) == 4:
                    state["street"] = "TURN"
                    state["status"] = "TURN"
                elif len(board) == 5:
                    state["street"] = "RIVER"
                    state["status"] = "RIVER"

            elif ev_type == "PLAYER_ACTION_CONFIRMED":
                state["action_history"].append(data)
                amt = data.get("amount", 0)
                if amt > 0:
                    state["pot"] += amt

            elif ev_type == "POT_UPDATED":
                state["pot"] = data.get("pot", state["pot"])

            elif ev_type == "ACTIVE_PLAYER_CHANGED":
                state["active_player"] = data.get("player", state["active_player"])

            elif ev_type == "MANUAL_CORRECTION":
                changes = data.get("changes", {})
                state.update(changes)

            elif ev_type == "HAND_FINISHED":
                state["status"] = "HAND_COMPLETE"
                state["is_finished"] = True

        return state

    def close(self) -> None:
        self._conn.close()
