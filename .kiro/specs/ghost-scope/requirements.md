# Requirements Document

## Introduction

Ghost Scope is a browser-based oscilloscope with a resurrected analog CRT look. It
takes samples from an ESP32 over Web Serial, from the microphone, or from a built-in
signal generator, and shows them as a glowing phosphor trace with triggering,
measurements, an FFT view and an AI "Ghost Technician" that explains the signal.

Priorities: **P0** = must ship for the demo, **P1** = should ship, **P2** = stretch.

## Requirements

### Requirement 1: Signal sources (P0)

**User Story:** As a student without a bench scope, I want to feed signals from an
ESP32, my microphone or a built-in generator, so that I can use the scope with or
without hardware.

#### Acceptance Criteria

1. WHEN the app loads THEN the system SHALL start the simulated source by default and show a moving trace within 2 seconds, with no permissions requested.
2. WHEN the user selects a simulated waveform (sine, square, triangle, saw, noise, PWM, AM, FM, haunted, I2C burst) THEN the system SHALL change the trace to that waveform and allow setting frequency, amplitude, offset and noise level.
3. WHEN the user clicks "Connect ESP32" in a browser that supports Web Serial THEN the system SHALL open the port chooser, connect at the configured baud rate and display incoming samples.
4. IF the browser does not support Web Serial THEN the system SHALL disable "Connect ESP32" and explain which browsers support it, while the other sources stay usable.
5. WHEN the user selects the microphone source THEN the system SHALL request microphone permission and display the live audio waveform.
6. IF microphone permission is denied THEN the system SHALL show a clear message and fall back to the simulated source.
7. WHEN a serial device disconnects THEN the system SHALL stop the trace, show a "Signal lost" message and offer to reconnect without reloading the page.

### Requirement 2: Scope display and controls (P0)

**User Story:** As a maker debugging a circuit, I want familiar oscilloscope controls,
so that I can get a stable, readable trace.

#### Acceptance Criteria

1. WHEN samples are arriving THEN the system SHALL render the trace at 60 fps on a typical laptop, on a 10 × 8 division graticule.
2. WHEN the user changes time/div or volts/div THEN the system SHALL rescale the trace immediately and show the current values with units.
3. WHEN the trigger mode is Auto, Normal or Single THEN the system SHALL behave like a bench scope: Auto free-runs without a trigger event, Normal only draws on trigger events, Single captures one event and stops.
4. WHEN the user sets trigger edge (rising/falling) and level THEN the system SHALL align the trace so the trigger point stays at a fixed horizontal position.
5. WHEN the user presses Run/Stop (or the Space key) THEN the system SHALL freeze or resume the display.
6. WHEN two channels are available THEN the system SHALL draw them in distinct colours and let each be shown or hidden.
7. The system SHALL let every control be used from the keyboard.

### Requirement 3: Phosphor CRT rendering (P0)

**User Story:** As a user, I want the trace to look like a glowing analog CRT, so that
the tool feels like a resurrected classic while staying readable.

#### Acceptance Criteria

1. WHEN rendering THEN the system SHALL draw the trace with adjustable persistence (decay), glow and intensity.
2. WHEN the CRT effects are on THEN the system SHALL show optional scanlines, screen curvature vignette and a warm-up animation on power-on.
3. WHEN the user enables reduced motion, or the OS reports `prefers-reduced-motion` THEN the system SHALL disable warm-up, flicker and decay trails.
4. WHEN the user enables high-contrast mode THEN the system SHALL draw a sharp, bright trace on a dark background with no blur.

### Requirement 4: Measurements and cursors (P0)

**User Story:** As a user, I want automatic measurements, so that I get exact numbers
instead of counting divisions.

#### Acceptance Criteria

1. WHEN a signal is displayed THEN the system SHALL show frequency, period, Vpp, Vmin, Vmax, Vmean, Vrms and duty cycle with units, updated at least 4 times per second.
2. IF a measurement cannot be determined (e.g. frequency of noise or DC) THEN the system SHALL show "—" instead of a wrong number.
3. WHEN the user enables cursors THEN the system SHALL show two time cursors and two voltage cursors with Δt, 1/Δt and ΔV readouts.

### Requirement 5: FFT spectrum view (P1)

**User Story:** As a user, I want to see the frequency content, so that I can find
noise, harmonics and interference.

#### Acceptance Criteria

1. WHEN the user opens the FFT view THEN the system SHALL show the magnitude spectrum in dB up to the Nyquist frequency.
2. WHEN the user picks a window function (rectangular, Hann, Hamming, Blackman) THEN the system SHALL apply it before the FFT.
3. WHEN the spectrum has peaks THEN the system SHALL label the strongest 3 peaks with frequency and level.

### Requirement 6: Ghost Technician AI (P0)

**User Story:** As a beginner, I want an assistant that explains my signal in plain
words, so that I can understand what I am looking at and what might be wrong.

#### Acceptance Criteria

1. WHEN the user presses "Summon the Ghost Technician" THEN the system SHALL send the current measurements, source type, settings and a downsampled trace (≤ 512 points) to the diagnose endpoint and show the reply within 10 seconds.
2. WHEN the reply arrives THEN the system SHALL show: likely signal type, likely source, problems found (e.g. clipping, noise, ringing, aliasing, DC offset), suggested fixes and a confidence level.
3. IF the AI endpoint is unavailable or rate-limited THEN the system SHALL use the local heuristic classifier and label the answer as "offline séance".
4. The system SHALL NOT send raw full-rate sample buffers or any personal data to the endpoint, and the endpoint SHALL NOT store requests.
5. WHEN the AI is unsure THEN the reply SHALL say so rather than guess.

### Requirement 7: Capture, export and share (P1)

**User Story:** As a student, I want to save and share a capture, so that I can put it
in a lab report or ask a friend for help.

#### Acceptance Criteria

1. WHEN the user clicks "Capture" THEN the system SHALL freeze the current frame and allow exporting it as PNG and CSV (time, ch1, ch2).
2. WHEN the user clicks "Share" THEN the system SHALL create a link containing the downsampled capture and settings in the URL fragment, and opening that link SHALL show the same capture.

### Requirement 8: ESP32 firmware (P0)

**User Story:** As a maker, I want firmware I can flash to an ESP32, so that it acts as
the scope's probe.

#### Acceptance Criteria

1. WHEN the firmware receives `START` THEN it SHALL stream ADC samples in binary frames at the configured sample rate (target ≥ 20 kS/s on one channel).
2. WHEN it receives `RATE <hz>` THEN it SHALL change the sample rate and report the actual rate it achieved.
3. WHEN it receives `STOP` THEN it SHALL stop streaming within 100 ms.
4. Each frame SHALL contain: 2 sync bytes (0xA5 0x5A), a frame type, channel count, sample rate (uint32 LE), sample count (uint16 LE), samples (uint16 LE, 12-bit) and a CRC-8 checksum.
5. The README SHALL include a safe input circuit (divider + DC bias) and a warning not to exceed 3.3 V on the ADC pin.

### Requirement 9: Frame parser robustness (P0)

**User Story:** As a user, I want the trace to recover from serial glitches, so that a
dropped byte does not freeze the scope.

#### Acceptance Criteria

1. WHEN the byte stream contains valid frames mixed with random garbage THEN the parser SHALL return every valid frame in order and skip the garbage.
2. WHEN a frame fails its checksum THEN the parser SHALL discard it and resync on the next sync bytes.
3. WHEN frames are split across arbitrary chunk boundaries THEN the parser SHALL produce the same frames as when given the whole stream at once.
4. Encoding then decoding any valid frame SHALL return an identical frame (round trip).

### Requirement 10: Logic analyzer mode (P2, stretch)

**User Story:** As a maker, I want to capture digital lines and decode UART/I2C, so
that I can debug sensor buses.

#### Acceptance Criteria

1. WHEN the user starts a burst capture THEN the firmware SHALL sample up to 8 GPIO pins into RAM at ≥ 1 MS/s and send the burst when done.
2. WHEN a burst is shown THEN the system SHALL draw digital lanes and decode UART (configurable baud) and I2C (address, R/W, data, ACK/NACK) annotations.
