"""Batch narration synthesis with Piper: reads [{"text", "out"}] JSON on stdin, writes one WAV per line.

Run with the venv that has piper-tts installed; the voice model path comes from argv[1].
"""
import json
import sys
import wave

from piper import PiperVoice, SynthesisConfig

voice = PiperVoice.load(sys.argv[1])
cfg = SynthesisConfig(length_scale=float(sys.argv[2]) if len(sys.argv) > 2 else 1.0)
for job in json.load(sys.stdin):
    with wave.open(job["out"], "wb") as wf:
        voice.synthesize_wav(job["text"], wf, syn_config=cfg)
    print(job["out"], flush=True)
