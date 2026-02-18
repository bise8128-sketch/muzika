"""
WebSocket karaoke room tests for the Python FastAPI backend.
Tests: connect, disconnect, broadcast, room state, multi-participant.
"""

import os
import sys
import json
import time
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app, manager


@pytest.fixture(autouse=True)
def clean_rooms():
    """Reset connection manager state between tests."""
    manager.active_connections.clear()
    manager.room_states.clear()
    yield
    manager.active_connections.clear()
    manager.room_states.clear()


client = TestClient(app)


class TestWebSocketConnection:
    def test_connect_to_room(self):
        """A participant should be able to connect to a room via WebSocket."""
        with client.websocket_connect("/ws/rooms/room-1/user-1?name=Alice") as ws:
            # The first message received should be the room state
            data = ws.receive_json()
            assert data["type"] == "room-state" or data["type"] == "join"

    def test_first_user_is_host(self):
        """The first user joining a room should become the host."""
        with client.websocket_connect("/ws/rooms/room-host-test/user-host?name=Host") as ws:
            # Look for room-state message with participant info
            messages = []
            for _ in range(3):  # Read up to 3 messages (join broadcast + room-state)
                try:
                    data = ws.receive_json()
                    messages.append(data)
                    if data["type"] == "room-state":
                        break
                except Exception:
                    break

            room_state_msg = next((m for m in messages if m["type"] == "room-state"), None)
            assert room_state_msg is not None
            participants = room_state_msg["payload"]["room"]["participants"]
            host = next((p for p in participants if p["id"] == "user-host"), None)
            assert host is not None
            assert host["isHost"] is True

    def test_receive_join_notification(self):
        """When a user connects, a 'join' message should be broadcast."""
        with client.websocket_connect("/ws/rooms/room-join/user-join-1?name=Bob") as ws:
            # Collect messages until we find a join message
            found_join = False
            for _ in range(5):
                try:
                    data = ws.receive_json()
                    if data["type"] == "join":
                        found_join = True
                        assert data["payload"]["participant"]["id"] == "user-join-1"
                        assert data["payload"]["participant"]["displayName"] == "Bob"
                        break
                except Exception:
                    break

            assert found_join, "Should have received a 'join' message"


class TestWebSocketBroadcast:
    def test_message_relay(self):
        """Messages sent by one participant should be broadcast to the room."""
        with client.websocket_connect("/ws/rooms/room-relay/user-relay-1?name=Alice") as ws:
            # Drain initial messages (join + room-state)
            for _ in range(3):
                try:
                    data = ws.receive_json()
                    if data["type"] == "room-state":
                        break
                except Exception:
                    break

            # Send a chat message
            ws.send_json({
                "type": "chat",
                "payload": {"text": "Hello everyone!"},
            })

            # The sender should also receive the broadcast
            data = ws.receive_json()
            assert data["type"] == "chat"
            assert data["senderId"] == "user-relay-1"
            assert data["payload"]["text"] == "Hello everyone!"

    def test_playback_update_updates_room_state(self):
        """Playback updates should modify the room's playback state."""
        with client.websocket_connect("/ws/rooms/room-playback/user-pb-1?name=DJ") as ws:
            # Drain initial messages
            for _ in range(3):
                try:
                    data = ws.receive_json()
                    if data["type"] == "room-state":
                        break
                except Exception:
                    break

            # Send a playback update
            ws.send_json({
                "type": "playback-update",
                "payload": {"isPlaying": True, "currentTime": 42.5, "songId": "song-123"},
            })

            data = ws.receive_json()
            assert data["type"] == "playback-update"
            assert data["payload"]["isPlaying"] is True
            assert data["payload"]["currentTime"] == 42.5


class TestWebSocketMultiParticipant:
    def test_two_users_in_same_room(self):
        """Two users in the same room should both receive messages."""
        with client.websocket_connect("/ws/rooms/room-multi/user-m1?name=Alice") as ws1:
            # Drain ws1 initial messages
            for _ in range(3):
                try:
                    data = ws1.receive_json()
                    if data["type"] == "room-state":
                        break
                except Exception:
                    break

            with client.websocket_connect("/ws/rooms/room-multi/user-m2?name=Bob") as ws2:
                # ws1 should have received a join notification for user-m2
                join_msg = ws1.receive_json()
                assert join_msg["type"] == "join"
                assert join_msg["payload"]["participant"]["id"] == "user-m2"

                # Drain ws2 initial messages
                for _ in range(3):
                    try:
                        data = ws2.receive_json()
                        if data["type"] == "room-state":
                            break
                    except Exception:
                        break

                # user-m1 sends a message
                ws1.send_json({
                    "type": "chat",
                    "payload": {"text": "Hi Bob!"},
                })

                # Both should receive it
                msg1 = ws1.receive_json()
                msg2 = ws2.receive_json()
                assert msg1["type"] == "chat"
                assert msg2["type"] == "chat"
                assert msg1["payload"]["text"] == "Hi Bob!"
                assert msg2["payload"]["text"] == "Hi Bob!"


class TestWebSocketDisconnect:
    def test_disconnect_sends_leave_message(self):
        """When a user disconnects, remaining users should get a 'leave' message."""
        with client.websocket_connect("/ws/rooms/room-leave/user-stay?name=Stayer") as ws_stay:
            # Drain initial messages (join + room-state)
            for _ in range(3):
                try:
                    data = ws.receive_json()
                    if data["type"] == "room-state":
                        break
                except Exception:
                    break

            # Connect and immediately disconnect a second user
            with client.websocket_connect("/ws/rooms/room-leave/user-leaver?name=Leaver") as ws_leave:
                # Drain join messages on ws_stay
                ws_stay.receive_json()  # join notification for user-leaver
                # Drain ws_leave initial messages
                for _ in range(3):
                    try:
                        ws_leave.receive_json()
                    except Exception:
                        break

            # ws_leave is now disconnected (exited `with` block)
            # ws_stay should receive a leave message
            time.sleep(0.2)
            leave_msg = ws_stay.receive_json()
            assert leave_msg["type"] == "leave"
            assert leave_msg["payload"]["participantId"] == "user-leaver"

    def test_empty_room_is_cleaned_up(self):
        """When all users leave, the room should be removed from state."""
        with client.websocket_connect("/ws/rooms/room-cleanup/user-only?name=Solo") as ws:
            for _ in range(3):
                try:
                    data = ws.receive_json()
                    if data["type"] == "room-state":
                        break
                except Exception:
                    break

        # After the `with` block, the WebSocket is closed
        assert "room-cleanup" not in manager.active_connections
        assert "room-cleanup" not in manager.room_states
