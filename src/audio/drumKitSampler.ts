import * as Tone from "tone";
import type { DrumPiece } from "../core/types";
import type { DrumVoice } from "./drumSampler";
import type { DrumKit, SynthKitParams } from "./drumKitManager";

// ─── Individual voice builders ────────────────────────────────────────────────

const buildKick = (p: SynthKitParams["kick"], output: Tone.ToneAudioNode): DrumVoice => {
  const s = new Tone.MembraneSynth({
    pitchDecay: p.pitchDecay,
    octaves: p.octaves,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: p.decayTime, sustain: 0, release: 1.2 },
  }).connect(output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease(p.note, "8n", time ?? (Tone.now() + 0.006), Math.min(1, (v ?? 0.75) * p.velMult)),
    dispose: () => s.dispose(),
  };
};

const buildSnare = (p: SynthKitParams["snare"], output: Tone.ToneAudioNode): DrumVoice => {
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: p.noiseDecay, sustain: 0, release: 0.08 },
  }).connect(output);
  const body = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: p.bodyOctaves,
    envelope: { attack: 0.001, decay: p.bodyDecay, sustain: 0 },
  }).connect(output);
  return {
    trigger: (v = 0.75, time?) => {
      const at     = time ?? (Tone.now() + 0.006);
      const scaled = Math.min(1, (v ?? 0.75) * p.velMult);
      noise.triggerAttackRelease("8n", at, scaled * p.noiseRatio);
      body.triggerAttackRelease(p.bodyNote, "16n", at, scaled * (1 - p.noiseRatio));
    },
    dispose: () => { noise.dispose(); body.dispose(); },
  };
};

/**
 * MetalSynth voice for cymbals and hi-hats.
 *
 * velMult is NOT applied here — volume scaling is already handled by
 * processVelocity() (kit velocity curve × mixer channel volume).
 * Applying it a second time inside the trigger halved effective volume and
 * made cymbals nearly inaudible (was rawVel × mixerVol × velMult ≈ 0.18).
 */
const buildMetal = (
  freq: number,
  opts: {
    decay:       number;
    harmonicity: number;
    modIdx:      number;
    resonance:   number;
    octaves:     number;
    durNote?:    string;
  },
  output: Tone.ToneAudioNode
): DrumVoice => {
  const s = new Tone.MetalSynth({
    envelope:        { attack: 0.001, decay: opts.decay, release: opts.decay * 0.15 },
    harmonicity:      opts.harmonicity,
    modulationIndex:  opts.modIdx,
    resonance:        opts.resonance,
    octaves:          opts.octaves,
  }).connect(output);
  s.frequency.value = freq;
  const dur = opts.durNote ?? "4n";
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease(dur, time ?? (Tone.now() + 0.006), Math.min(1, v ?? 0.75)),
    dispose: () => s.dispose(),
  };
};

const buildTom = (
  p: { note: string; decayTime: number; pitchDecay: number; octaves: number; velMult: number },
  output: Tone.ToneAudioNode
): DrumVoice => {
  const s = new Tone.MembraneSynth({
    pitchDecay: p.pitchDecay,
    octaves:    p.octaves,
    envelope: { attack: 0.001, decay: p.decayTime, sustain: 0, release: 0.9 },
  }).connect(output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease(p.note, "8n", time ?? (Tone.now() + 0.006), Math.min(1, (v ?? 0.75) * p.velMult)),
    dispose: () => s.dispose(),
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create all drum voices for a given kit, connected to `output`.
 * Returns a Map<DrumPiece, DrumVoice> ready to be used by MidiScheduler.
 *
 * One voice per piece — keeps the Web Audio node count minimal.
 * Polyphonic ring-out (e.g. crash overlapping with next crash) is handled by
 * the MetalSynth envelope naturally cutting into the previous tail, which is
 * acceptable and matches real cymbal choke behaviour.
 */
export function createKitVoices(kit: DrumKit, output: Tone.ToneAudioNode): Map<DrumPiece, DrumVoice> {
  const p = kit.synthParams;
  const voices = new Map<DrumPiece, DrumVoice>();

  voices.set("kick",  buildKick(p.kick, output));
  voices.set("snare", buildSnare(p.snare, output));

  voices.set("hihatClosed", buildMetal(p.hihatClosed.freq, { ...p.hihatClosed, durNote: "32n" }, output));
  voices.set("hihatOpen",   buildMetal(p.hihatOpen.freq,   { ...p.hihatOpen,   durNote: "4n"  }, output));
  voices.set("hihatPedal",  buildMetal(p.hihatPedal.freq,  { ...p.hihatPedal,  durNote: "32n" }, output));

  voices.set("ride",  buildMetal(p.ride.freq,  { ...p.ride,  durNote: "4n" }, output));
  voices.set("crash", buildMetal(p.crash.freq, { ...p.crash, durNote: "4n" }, output));
  voices.set("splash",buildMetal(p.splash.freq,{ ...p.splash,durNote: "4n" }, output));

  voices.set("tomHigh", buildTom(p.tomHigh, output));
  voices.set("tomMid",  buildTom(p.tomMid,  output));
  voices.set("tomLow",  buildTom(p.tomLow,  output));

  // snareRim: high-freq click
  const rimSynth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 0.5,
  }).connect(output);
  rimSynth.frequency.value = 800;
  voices.set("snareRim", {
    trigger: (v = 0.75, time?) => rimSynth.triggerAttackRelease("32n", time ?? (Tone.now() + 0.006), Math.min(1, v ?? 0.75)),
    dispose: () => rimSynth.dispose(),
  });

  // otherCymbal: secondary crash variant
  const otherCymbal = new Tone.MetalSynth({
    envelope:       { attack: 0.001, decay: p.crash.decay * 0.7, release: p.crash.decay * 0.1 },
    harmonicity:     p.crash.harmonicity * 0.9,
    modulationIndex: p.crash.modIdx + 4,
    resonance:       p.crash.resonance * 0.95,
    octaves:         p.crash.octaves,
  }).connect(output);
  otherCymbal.frequency.value = p.crash.freq + 30;
  voices.set("otherCymbal", {
    trigger: (v = 0.75, time?) => otherCymbal.triggerAttackRelease("4n", time ?? (Tone.now() + 0.006), Math.min(1, v ?? 0.75)),
    dispose: () => otherCymbal.dispose(),
  });

  return voices;
}

/**
 * Trigger a single preview hit for a drum piece using kit parameters.
 * Connects directly to destination. For the "Test Sound" button.
 */
export function previewKitPiece(piece: DrumPiece, kit: DrumKit, velocity = 0.75): void {
  const out = new Tone.Gain(0.8).toDestination();
  const voices = createKitVoices(kit, out);

  const voice = voices.get(piece);
  if (voice) {
    voice.trigger(velocity, Tone.now() + 0.008);
    setTimeout(() => { voice.dispose(); out.dispose(); }, 4000);
  }

  for (const [p, v] of voices) {
    if (p !== piece) setTimeout(() => v.dispose(), 50);
  }
}
