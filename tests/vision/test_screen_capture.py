import pytest
import time
from services.vision.capture_adapter.screen_capture import (
    ScreenCapture,
    SyntheticScreenCapture,
    FrameRingBuffer,
    CaptureSource,
    Frame,
    RectRegion
)


def test_frame_ring_buffer_capacity_and_discard():
    buffer = FrameRingBuffer(capacity=3)
    assert buffer.size == 0
    assert buffer.capacity == 3

    f1 = Frame(id="1", timestamp=time.monotonic(), width=1280, height=720, source_id="s1")
    f2 = Frame(id="2", timestamp=time.monotonic(), width=1280, height=720, source_id="s1")
    f3 = Frame(id="3", timestamp=time.monotonic(), width=1280, height=720, source_id="s1")
    f4 = Frame(id="4", timestamp=time.monotonic(), width=1280, height=720, source_id="s1")

    buffer.push(f1)
    buffer.push(f2)
    buffer.push(f3)
    assert buffer.size == 3
    assert buffer.total_dropped == 0

    # Push 4th frame -> causes f1 to be discarded
    buffer.push(f4)
    assert buffer.size == 3
    assert buffer.total_dropped == 1
    assert buffer.total_ingested == 4
    assert buffer.peek_latest().id == "4"

    # Oldest in queue is f2
    assert buffer.pop().id == "2"
    assert buffer.pop().id == "3"
    assert buffer.pop().id == "4"
    assert buffer.pop() is None


def test_synthetic_screen_capture_lifecycle():
    cap = SyntheticScreenCapture(buffer_capacity=5)
    source = cap.select_source()
    assert source is not None
    assert source.is_authorized is True
    assert source.app_identifier == "com.auth.poker.client"

    cap.start(source, fps=20)
    assert cap.is_capturing() is True
    assert cap.is_paused() is False

    # Simulate ticks
    frame1 = cap.capture_tick()
    assert frame1 is not None
    assert frame1.width == 1280
    assert frame1.height == 720

    cap.pause()
    assert cap.is_paused() is True
    assert cap.capture_tick() is None

    cap.resume()
    assert cap.is_paused() is False
    frame2 = cap.capture_tick()
    assert frame2 is not None

    cap.stop()
    assert cap.is_capturing() is False
    assert cap.read() is None  # memory purged on stop


def test_screen_capture_rejects_unauthorized_source():
    cap = SyntheticScreenCapture()
    unauthorized = CaptureSource(
        id="unauth_01",
        name="Suspicious External Window",
        source_type="window",
        is_authorized=False,
        app_identifier="com.unknown.app"
    )

    with pytest.raises(PermissionError):
        cap.start(unauthorized, fps=15)

    assert cap.is_capturing() is False
