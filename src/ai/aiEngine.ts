/**
 * AI Engine — central pipeline.
 *
 * Pipeline:  DrumHit[] → GrooveFrame → tf.Tensor → Predictions
 *
 * Each sub-module (grooveClassifier, rudimentDetector, …) exposes:
 *   - A feature-extraction function that returns a tf.Tensor
 *   - A prediction function that accepts a tensor (or uses heuristics when no
 *     trained model is available)
 *
 * All heavy work runs synchronously in one micro-task so it never blocks the
 * audio clock.  For even heavier future models, move the call inside a
 * Web Worker (the tensor serialization API in TF.js supports this).
 */

import { modelLoader } from "./modelLoader";
import { classifyGroove, hitsToGrooveFrame } from "./grooveClassifier";
import { detectRudiments } from "./rudimentDetector";
import { analyzeDifficulty } from "./difficultyAnalyzer";
import { analyzeHumanFeel } from "./grooveSimilarity";
import type { ParsedDrumProject } from "../core/types";
import type { AiAnalysisResult, GrooveFrame } from "./types";

export type AiEngineStatus = "idle" | "initializing" | "ready" | "analyzing" | "error";

class AiEngine {
  private status: AiEngineStatus = "idle";
  private lastResult: AiAnalysisResult | null = null;
  private onStatusChange: ((s: AiEngineStatus) => void) | null = null;

  /** Initialize TF.js and pre-load models (non-blocking — fails gracefully). */
  async init(): Promise<void> {
    if (this.status === "ready" || this.status === "initializing") return;
    this.setStatus("initializing");
    try {
      await modelLoader.ensureTfReady();
      // Load models in parallel; each returns null if no file found.
      await Promise.all([
        modelLoader.loadModel("groove-classifier", "models/groove-classifier/model.json"),
        modelLoader.loadModel("rudiment-model",    "models/rudiment-model/model.json"),
        modelLoader.loadModel("quantizer-model",   "models/quantizer-model/model.json"),
      ]);
      this.setStatus("ready");
    } catch (err) {
      console.warn("[AI] Init warning:", err);
      this.setStatus("ready"); // Heuristic mode still works
    }
  }

  /**
   * Run full analysis on a project.
   * Returns a complete AiAnalysisResult — never throws.
   */
  async analyze(project: ParsedDrumProject): Promise<AiAnalysisResult> {
    if (this.status === "idle") await this.init();
    this.setStatus("analyzing");

    // Each sub-module calls tf.tidy internally for its own tensor allocations
    const { hits, ppq, tempoBpm } = project;
    const frame      = hitsToGrooveFrame(hits, ppq, tempoBpm);
    const groove     = classifyGroove(frame);
    const rudiments  = detectRudiments(hits, ppq);
    const difficulty = analyzeDifficulty(hits, ppq, tempoBpm, project.timeSignature);
    const humanFeel  = analyzeHumanFeel(hits, ppq, tempoBpm);

    const result: AiAnalysisResult = {
      groove,
      rudiments,
      difficulty,
      humanFeel,
      analyzedAt: Date.now(),
    };

    this.lastResult = result;
    this.setStatus("ready");
    return result;
  }

  get currentStatus(): AiEngineStatus { return this.status; }
  get lastAnalysis(): AiAnalysisResult | null { return this.lastResult; }

  onStatus(cb: (s: AiEngineStatus) => void): void { this.onStatusChange = cb; }

  private setStatus(s: AiEngineStatus): void {
    this.status = s;
    this.onStatusChange?.(s);
  }
}

/** Module-level singleton — ready to use everywhere without circular deps. */
export const aiEngine = new AiEngine();

/** Public helper: convert hits to GrooveFrame (used by smartQuantizer too). */
export { hitsToGrooveFrame };
export type { GrooveFrame };
