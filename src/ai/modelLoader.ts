import * as tf from "@tensorflow/tfjs";

export type ModelStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

interface CachedModel {
  model: tf.LayersModel | null;
  status: ModelStatus;
  error?: string;
}

/**
 * Singleton TF.js model manager.
 *
 * Architecture philosophy:
 *  - Models are OPTIONAL. When no trained model file is found, the caller
 *    uses heuristic analysis on the same feature tensors → results are still
 *    meaningful and the code path is identical.
 *  - Models are loaded lazily and cached in memory.
 *  - Models can be persisted to localStorage for offline reuse.
 *  - Designed for future support of custom user-supplied models.
 */
export class ModelLoader {
  private readonly cache = new Map<string, CachedModel>();
  private readonly warmedUp = new Set<string>();
  private tfReady = false;

  /** Must be called once before using any TF.js operations. */
  async ensureTfReady(): Promise<void> {
    if (this.tfReady) return;
    await tf.ready();
    this.tfReady = true;
    console.info(`[AI] TF.js backend: ${tf.getBackend()}`);
  }

  /**
   * Load a named model.
   * Resolution order:
   *   1. In-memory cache
   *   2. localStorage (previously saved by user or auto-save)
   *   3. /models/<name>/ directory (bundled at build time)
   *   4. Returns null → caller uses heuristics
   */
  async loadModel(name: string, bundledPath?: string): Promise<tf.LayersModel | null> {
    const cached = this.cache.get(name);
    if (cached) return cached.model;

    this.cache.set(name, { model: null, status: "loading" });
    await this.ensureTfReady();

    const candidates: string[] = [
      `localstorage://${name}`,
      ...(bundledPath ? [bundledPath] : []),
    ];

    for (const path of candidates) {
      try {
        const model = await tf.loadLayersModel(path);
        this.cache.set(name, { model, status: "ready" });
        console.info(`[AI] "${name}" loaded from ${path}`);
        return model;
      } catch {
        // Try next candidate
      }
    }

    this.cache.set(name, { model: null, status: "unavailable" });
    console.info(`[AI] No trained model for "${name}" — heuristic mode active`);
    return null;
  }

  /**
   * Run a dummy inference to warm the GPU/WASM backend so the first
   * real inference has no cold-start latency.
   */
  async warmup(name: string): Promise<void> {
    if (this.warmedUp.has(name)) return;
    const cached = this.cache.get(name);
    if (!cached?.model) return;
    try {
      const shape = cached.model.inputs[0].shape.map((d) => d ?? 1);
      const dummy = tf.zeros(shape as number[]);
      const out = cached.model.predict(dummy);
      tf.dispose(Array.isArray(out) ? out : [out]);
      dummy.dispose();
      this.warmedUp.add(name);
    } catch { /* warmup failure is non-fatal */ }
  }

  getStatus(name: string): ModelStatus {
    return this.cache.get(name)?.status ?? "idle";
  }

  /** Persist a model to localStorage for offline reuse across sessions. */
  async persistModel(name: string, model: tf.LayersModel): Promise<void> {
    try {
      await model.save(`localstorage://${name}`);
      this.cache.set(name, { model, status: "ready" });
    } catch (err) {
      console.warn(`[AI] Could not persist "${name}":`, err);
    }
  }

  unload(name: string): void {
    const cached = this.cache.get(name);
    cached?.model?.dispose();
    this.cache.delete(name);
    this.warmedUp.delete(name);
  }

  unloadAll(): void {
    for (const name of [...this.cache.keys()]) this.unload(name);
  }
}

export const modelLoader = new ModelLoader();
