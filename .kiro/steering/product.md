# Product: Ghost Scope

Ghost Scope brings the analog CRT oscilloscope back to life in the browser.
Plug in an ESP32 (or use your microphone, or the built-in signal generator) and
see live waveforms glowing in green phosphor, with measurements, an FFT view and
an AI "Ghost Technician" that explains what the signal is and what is wrong with it.

## Who it is for
- Students and hobbyists who cannot afford a bench oscilloscope (a basic one costs
  ₹15,000+; an ESP32 costs ~₹400).
- Makers debugging sensors, PWM, audio and serial lines.
- Teachers demonstrating signals in class with nothing more than a laptop.

## Hackathon context
- Event: Kiroween 2026 (Devpost). Category: **Resurrection** (dead tech: the analog CRT scope).
  Also aiming for Best Student Project: Resurrection, Best Demo, Blog and Social prizes.
- Hard deadline: 4 Dec 2026, 2:00 PM PT (5 Dec, 3:30 AM IST). Target submit: 3 Dec.
- Judges must be able to try it from a URL **without hardware**, so the simulated
  source and microphone source are first-class, not afterthoughts.

## Product principles
1. Real usefulness first, spooky look second. Every effect must keep the trace readable.
2. Works with zero setup: open the URL, press "Summon", see a signal.
3. Accessible: reduced-motion mode, high-contrast mode, keyboard controls, readable
   measurement text (not only visuals).
4. Honest AI: the Ghost Technician only explains what the measurements support and
   says when it is unsure. The app works fully without the AI.
5. Privacy: waveforms are never stored server-side; only a compact measurement
   summary and a downsampled trace are sent to the AI endpoint.

## Tone
Playful Halloween voice in labels and AI persona ("The spirits sense a 1 kHz square
wave..."), but measurements and units are always plain and precise.
