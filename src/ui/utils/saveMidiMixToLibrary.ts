import { exportProjectToMidiBytes } from "../../core/midiExporter";
import type { QuantizeOptions, ParsedDrumProject } from "../../core/types";
import type { DrumKitMixer } from "../../audio/drumKitManager";
import { unwrapBackend } from "../AuthContext";

export interface MidiMixSnapshot {
  activeDrumKitId: string;
  activeDrumKitName: string;
  drumMixer: DrumKitMixer;
  drumMixerMute: Partial<Record<keyof DrumKitMixer, boolean>>;
  drumMixerSolo: Partial<Record<keyof DrumKitMixer, boolean>>;
  panValues: Record<keyof DrumKitMixer, number>;
  masterVolume: number;
}

interface SaveMidiMixInput {
  token: string;
  project: ParsedDrumProject;
  quantizeOptions: QuantizeOptions;
  mix: MidiMixSnapshot;
}

const cleanSourceTitle = (sourceName: string | undefined): string =>
  (sourceName || "Mix MIDI").replace(/\.midi?$/i, "").trim() || "Mix MIDI";

export const saveMidiMixToLibrary = async ({
  token,
  project,
  quantizeOptions,
  mix,
}: SaveMidiMixInput): Promise<DrumoScore> => {
  const savedAt = new Date().toISOString();
  const title = `${cleanSourceTitle(project.sourceName)} - mix ${mix.activeDrumKitName}`;

  return unwrapBackend(await window.drumApp.backend.saveScore(token, {
    title,
    description: `Mix MIDI sauvegarde depuis le mixeur Drumo (${mix.activeDrumKitName}).`,
    midiBytes: exportProjectToMidiBytes(project),
    projectData: {
      project,
      quantizeOptions,
      mixSnapshot: {
        ...mix,
        savedAt,
        source: "drum-mixer",
      },
    },
  }));
};
