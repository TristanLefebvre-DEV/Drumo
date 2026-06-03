import * as Tone from "tone";
import type { DrumPiece } from "../core/types";
import type { DrumVoice } from "./drumSampler";
import type { DrumKit, SynthKitParams } from "./drumKitManager";
import type { PieceSoundVariant } from "./drumPieceLibrary";

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
 * NoiseSynth + Filter voice — replaces Tone.MetalSynth which is silent in
 * this Tone.js 15.1.22 / Electron environment.
 *
 * filterFreq is derived from the kit's freq parameter so each kit keeps
 * its tonal character (brighter kits → higher cutoff).
 */
const buildNoiseVoice = (
  decay: number,
  filterType: "highpass" | "bandpass",
  filterFreq: number,
  durNote: string,
  output: Tone.ToneAudioNode
): DrumVoice => {
  const filter = new Tone.Filter({
    frequency: filterFreq,
    type: filterType,
    Q: 1.2,
  }).connect(output);
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay, sustain: 0, release: Math.max(0.01, decay * 0.1) },
  }).connect(filter);
  return {
    trigger: (v = 0.75, time?) => noise.triggerAttackRelease(durNote, time ?? (Tone.now() + 0.006), Math.min(1, v ?? 0.75)),
    dispose: () => { noise.dispose(); filter.dispose(); },
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

// ─── Filter frequency helpers ─────────────────────────────────────────────────

// Map kit MetalSynth freq (300–600 Hz) → highpass cutoff (4–14 kHz)
const hhFilterFreq = (kitFreq: number): number =>
  Math.min(14000, Math.max(4000, 7500 * (kitFreq / 400)));

// Map kit MetalSynth freq (250–520 Hz) → bandpass center (1.5–7 kHz)
const cymFilterFreq = (kitFreq: number): number =>
  Math.min(7000, Math.max(1500, 3500 * (kitFreq / 320)));

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create all drum voices for a given kit, connected to `output`.
 * Returns a Map<DrumPiece, DrumVoice> ready to be used by MidiScheduler.
 *
 * Cymbals and hi-hats use NoiseSynth + Tone.Filter instead of MetalSynth
 * (MetalSynth is silent in Tone.js 15.1.22 / Electron).
 */
export function createKitVoices(kit: DrumKit, output: Tone.ToneAudioNode): Map<DrumPiece, DrumVoice> {
  const p = kit.synthParams;
  const voices = new Map<DrumPiece, DrumVoice>();

  voices.set("kick",  buildKick(p.kick, output));
  voices.set("snare", buildSnare(p.snare, output));

  voices.set("hihatClosed", buildNoiseVoice(p.hihatClosed.decay, "highpass", hhFilterFreq(p.hihatClosed.freq), "32n", output));
  voices.set("hihatOpen",   buildNoiseVoice(p.hihatOpen.decay,   "highpass", hhFilterFreq(p.hihatOpen.freq),   "4n",  output));
  voices.set("hihatPedal",  buildNoiseVoice(p.hihatPedal.decay,  "highpass", hhFilterFreq(p.hihatPedal.freq),  "32n", output));

  voices.set("crash",  buildNoiseVoice(p.crash.decay,  "bandpass", cymFilterFreq(p.crash.freq),  "4n", output));
  voices.set("ride",   buildNoiseVoice(p.ride.decay,   "bandpass", cymFilterFreq(p.ride.freq),   "4n", output));
  voices.set("splash", buildNoiseVoice(p.splash.decay, "bandpass", cymFilterFreq(p.splash.freq), "4n", output));

  voices.set("tomHigh", buildTom(p.tomHigh, output));
  voices.set("tomMid",  buildTom(p.tomMid,  output));
  voices.set("tomLow",  buildTom(p.tomLow,  output));

  // snareRim: short high-freq click via highpass noise
  voices.set("snareRim", buildNoiseVoice(0.05, "highpass", 5000, "32n", output));

  // otherCymbal: secondary crash variant, slightly brighter and shorter
  voices.set("otherCymbal", buildNoiseVoice(p.crash.decay * 0.7, "bandpass", cymFilterFreq(p.crash.freq + 30), "4n", output));

  return voices;
}

// ─── Construction d'une voix depuis une variante de la bibliothèque ──────────

/**
 * Construit une DrumVoice Tone.js à partir d'une PieceSoundVariant.
 * Chaque algorithme produit un timbre réellement différent.
 */
export function buildVoiceFromVariant(
  variant: PieceSoundVariant,
  output: Tone.ToneAudioNode
): DrumVoice {
  const vel = variant.velocity ?? 1.0;
  const now = () => Tone.now() + 0.006;

  switch (variant.algo) {

    // ── Membrane (MembraneSynth) ── corps grave, idéal kick / tom ──
    case "membrane":
    case "membrane_punch": {
      const s = new Tone.MembraneSynth({
        pitchDecay: variant.pitchDecay ?? 0.08,
        octaves:    variant.octaves ?? 8,
        oscillator: { type: "sine" },
        envelope: {
          attack:  0.001,
          decay:   variant.decay,
          sustain: 0,
          release: variant.algo === "membrane_punch" ? 0.5 : 1.2,
        },
      }).connect(output);
      const note = variant.pitch ?? "C1";
      return {
        trigger: (v = 0.75, t?) => s.triggerAttackRelease(note, "8n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => s.dispose(),
      };
    }

    // ── Sub 808 ── MembraneSynth avec longue descente de pitch ──
    case "membrane_sub": {
      const s = new Tone.MembraneSynth({
        pitchDecay: variant.pitchDecay ?? 0.55,
        octaves:    variant.octaves ?? 14,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: 2.0 },
      }).connect(output);
      const note = variant.pitch ?? "A-1";
      return {
        trigger: (v = 0.75, t?) => s.triggerAttackRelease(note, "4n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => s.dispose(),
      };
    }

    // ── Bruit blanc filtré ── clap sec / snare électronique ──
    case "noise_white":
    case "noise_pink": {
      const filter = new Tone.Filter({
        frequency: variant.filterFreq ?? 2000,
        type:      (variant.filterType as Tone.FilterOptions["type"]) ?? "highpass",
        Q:         variant.filterQ ?? 0.8,
      }).connect(output);
      const noise = new Tone.NoiseSynth({
        noise: { type: variant.noiseType ?? (variant.algo === "noise_pink" ? "pink" : "white") },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: Math.max(0.01, variant.decay * 0.1) },
      }).connect(filter);
      return {
        trigger: (v = 0.75, t?) => noise.triggerAttackRelease("8n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => { noise.dispose(); filter.dispose(); },
      };
    }

    // ── Bruit bandpass étroit ── hi-hat électronique / rimshot ──
    case "noise_band": {
      const filter = new Tone.Filter({
        frequency: variant.filterFreq ?? 6000,
        type:      "bandpass",
        Q:         variant.filterQ ?? 2.0,
      }).connect(output);
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: 0.005 },
      }).connect(filter);
      return {
        trigger: (v = 0.75, t?) => noise.triggerAttackRelease("32n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => { noise.dispose(); filter.dispose(); },
      };
    }

    // ── Dual : corps membrane + bruit mélangés ── caisse claire acoustique ──
    case "dual":
    case "dual_metal": {
      const bodyRatio = variant.bodyRatio ?? 0.4;
      // Corps membranaire
      const body = new Tone.MembraneSynth({
        pitchDecay: variant.pitchDecay ?? 0.01,
        octaves:    variant.bodyOctaves ?? 3.0,
        envelope: { attack: 0.001, decay: variant.bodyDecay ?? 0.14, sustain: 0 },
      }).connect(output);
      // Bruit filtré
      const filter = new Tone.Filter({
        frequency: variant.filterFreq ?? (variant.algo === "dual_metal" ? 2500 : 1200),
        type:      (variant.filterType as Tone.FilterOptions["type"]) ?? "highpass",
        Q:         variant.filterQ ?? 0.8,
      }).connect(output);
      const noise = new Tone.NoiseSynth({
        noise: { type: variant.noiseType ?? (variant.algo === "dual_metal" ? "white" : "pink") },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: 0.05 },
      }).connect(filter);
      const bodyNote = variant.bodyNote ?? "D2";
      return {
        trigger: (v = 0.75, t?) => {
          const at     = t ?? now();
          const scaled = Math.min(1, (v ?? 0.75) * vel);
          noise.triggerAttackRelease("8n", at, scaled * (1 - bodyRatio));
          body.triggerAttackRelease(bodyNote, "16n", at, scaled * bodyRatio);
        },
        dispose: () => { noise.dispose(); filter.dispose(); body.dispose(); },
      };
    }

    // ── Hi-hat fermé ── bruit HP court ──
    case "hihat_closed": {
      const filter = new Tone.Filter({
        frequency: variant.filterFreq ?? 5000,
        type:      "highpass",
        Q:         variant.filterQ ?? 0.9,
      }).connect(output);
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: 0.004 },
      }).connect(filter);
      return {
        trigger: (v = 0.75, t?) => noise.triggerAttackRelease("32n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => { noise.dispose(); filter.dispose(); },
      };
    }

    // ── Hi-hat ouvert ── bruit HP decay long ──
    case "hihat_open": {
      const filter = new Tone.Filter({
        frequency: variant.filterFreq ?? 4000,
        type:      "highpass",
        Q:         variant.filterQ ?? 0.7,
      }).connect(output);
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: variant.decay * 0.15 },
      }).connect(filter);
      return {
        trigger: (v = 0.75, t?) => noise.triggerAttackRelease("4n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => { noise.dispose(); filter.dispose(); },
      };
    }

    // ── Cymbale brillante ou sombre ── longue queue ──
    case "cymbal_bright":
    case "cymbal_dark": {
      const freq = variant.filterFreq ?? (variant.algo === "cymbal_bright" ? 3500 : 2000);
      const filter = new Tone.Filter({
        frequency: freq,
        type:      variant.algo === "cymbal_bright" ? "bandpass" : "bandpass",
        Q:         variant.filterQ ?? (variant.algo === "cymbal_bright" ? 0.5 : 0.35),
      }).connect(output);
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: variant.decay, sustain: 0, release: variant.decay * 0.2 },
      }).connect(filter);
      return {
        trigger: (v = 0.75, t?) => noise.triggerAttackRelease("4n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => { noise.dispose(); filter.dispose(); },
      };
    }

    // Fallback : membrane générique
    default: {
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.08, octaves: 6,
        envelope: { attack: 0.001, decay: variant.decay ?? 0.3, sustain: 0, release: 1.0 },
      }).connect(output);
      return {
        trigger: (v = 0.75, t?) => s.triggerAttackRelease(variant.pitch ?? "C2", "8n", t ?? now(), Math.min(1, (v ?? 0.75) * vel)),
        dispose: () => s.dispose(),
      };
    }
  }
}

/**
 * Preview d'une variante de son — joue un hit isolé puis dispose.
 */
export function previewVariant(variant: PieceSoundVariant, velocity = 0.78): void {
  const out   = new Tone.Gain(0.85).toDestination();
  const voice = buildVoiceFromVariant(variant, out);
  voice.trigger(velocity, Tone.now() + 0.008);
  setTimeout(() => { voice.dispose(); out.dispose(); }, 4000);
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
