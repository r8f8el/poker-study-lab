"""
Poker Study Lab - Screen Capture Architecture & Abstract Adapter
Provides abstract OS-decoupled screen/window capture interface, 
synthetic test fixture generator, and ring buffer memory management.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import time
from typing import Optional, List, Dict, Any
from collections import deque
from threading import Lock


@dataclass(frozen=True)
class RectRegion:
    x: int
    y: int
    width: int
    height: int


@dataclass
class CaptureSource:
    id: str
    name: str
    source_type: str  # 'window', 'region', 'synthetic_mock'
    is_authorized: bool
    app_identifier: str
    bounds: Optional[RectRegion] = None


@dataclass
class Frame:
    id: str
    timestamp: float
    width: int
    height: int
    source_id: str
    data: Optional[Any] = None  # numpy.ndarray / bytes
    metadata: Dict[str, Any] = field(default_factory=dict)


class ScreenCapture(ABC):
    """
    Abstract interface for window/screen capture.
    Decoupled from specific OS APIs (Win32, DirectX, MSS, X11, Wayland).
    """

    @abstractmethod
    def select_source(self) -> Optional[CaptureSource]:
        """Prompts user or system to select an authorized window or region."""
        pass

    @abstractmethod
    def start(self, source: CaptureSource, fps: int = 15) -> None:
        """Starts capturing frames from the authorized source at target FPS."""
        pass

    @abstractmethod
    def read(self) -> Optional[Frame]:
        """Reads the latest captured frame or returns None."""
        pass

    @abstractmethod
    def pause(self) -> None:
        """Pauses frame capture without destroying resources."""
        pass

    @abstractmethod
    def resume(self) -> None:
        """Resumes paused frame capture."""
        pass

    @abstractmethod
    def stop(self) -> None:
        """Halts frame capture and purges memory buffers immediately."""
        pass

    @abstractmethod
    def is_capturing(self) -> bool:
        """Returns True if capture loop is currently running."""
        pass

    @abstractmethod
    def is_paused(self) -> bool:
        """Returns True if capture is currently paused."""
        pass


class FrameRingBuffer:
    """
    Thread-safe circular buffer for frame management.
    Discards oldest frames to avoid memory creep and measures pipeline latency.
    """

    def __init__(self, capacity: int = 5):
        if capacity < 1:
            raise ValueError("Buffer capacity must be at least 1")
        self.capacity = capacity
        self._lock = Lock()
        self._buffer: deque[Frame] = deque(maxlen=capacity)
        self.total_ingested = 0
        self.total_dropped = 0
        self._latencies: deque[float] = deque(maxlen=50)

    def push(self, frame: Frame) -> None:
        latency = max(0.0, (time.monotonic() - frame.timestamp) * 1000)
        with self._lock:
            self.total_ingested += 1
            if len(self._buffer) == self.capacity:
                self.total_dropped += 1
            self._buffer.append(frame)
            self._latencies.append(latency)

    def peek_latest(self) -> Optional[Frame]:
        with self._lock:
            if not self._buffer:
                return None
            return self._buffer[-1]

    def pop(self) -> Optional[Frame]:
        with self._lock:
            if not self._buffer:
                return None
            return self._buffer.popleft()

    def clear(self) -> None:
        with self._lock:
            self._buffer.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._buffer)

    @property
    def average_latency_ms(self) -> float:
        with self._lock:
            if not self._latencies:
                return 0.0
            return sum(self._latencies) / len(self._latencies)


class SyntheticScreenCapture(ScreenCapture):
    """
    Synthetic poker table capture implementation for automated testing,
    continuous integration, and isolated local development.
    """

    def __init__(self, buffer_capacity: int = 5):
        self._source: Optional[CaptureSource] = None
        self._capturing = False
        self._paused = False
        self._target_fps = 15
        self._ring_buffer = FrameRingBuffer(capacity=buffer_capacity)
        self._step_counter = 0

    def select_source(self) -> Optional[CaptureSource]:
        source = CaptureSource(
            id="synth_win_01",
            name="Simulated Authorized Poker Window",
            source_type="synthetic_mock",
            is_authorized=True,
            app_identifier="com.auth.poker.client",
            bounds=RectRegion(x=0, y=0, width=1280, height=720),
        )
        self._source = source
        return source

    def start(self, source: CaptureSource, fps: int = 15) -> None:
        if not source.is_authorized:
            raise PermissionError(
                f"Security Violation: Target source [{source.name}] is unauthorized. Capture blocked."
            )
        self.stop()
        self._source = source
        self._target_fps = max(1, min(30, fps))
        self._capturing = True
        self._paused = False
        self._ring_buffer.clear()

    def capture_tick(self) -> Optional[Frame]:
        """Called by background capture loop or test runner to produce a frame."""
        if not self._capturing or self._paused:
            return None

        self._step_counter += 1
        frame = Frame(
            id=f"synth_frame_{self._step_counter}",
            timestamp=time.monotonic(),
            width=1280,
            height=720,
            source_id=self._source.id if self._source else "unknown",
            metadata={"step": self._step_counter, "fps_target": self._target_fps},
        )
        self._ring_buffer.push(frame)
        return frame

    def read(self) -> Optional[Frame]:
        return self._ring_buffer.peek_latest()

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        if self._capturing:
            self._paused = False

    def stop(self) -> None:
        self._capturing = False
        self._paused = False
        self._ring_buffer.clear()

    def is_capturing(self) -> bool:
        return self._capturing

    def is_paused(self) -> bool:
        return self._paused

    @property
    def ring_buffer(self) -> FrameRingBuffer:
        return self._ring_buffer
