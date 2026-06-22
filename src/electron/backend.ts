import type { IpcMain } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { BackendError } from "./backendError";
export { BackendError } from "./backendError";

type Role = "user" | "admin";
const DEFAULT_UPDATE_FEED_URL = "https://github.com/TristanLefebvre-DEV/Drumo/releases/latest/download/latest.json";

interface PasswordRecord { salt: string; hash: string }
interface StoredUser {
  id: string;
  username: string;
  usernameKey: string;
  password: PasswordRecord;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}
interface StoredCourse {
  id: string;
  title: string;
  description: string;
  content: string;
  level: string;
  tags: string[];
  published: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}
interface StoredScore {
  id: string;
  title: string;
  description: string;
  midiBase64: string;
  projectData?: unknown;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}
interface Database {
  version: 1;
  users: StoredUser[];
  courses: StoredCourse[];
  scores: StoredScore[];
  settings: { maintenance: boolean; coachEnabled: boolean; updatesEnabled: boolean; updateFeedUrl: string };
}
interface Session { userId: string; expiresAt: number }

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const normalizeUsername = (value: string) => value.trim().toLocaleLowerCase("fr-FR");
const cleanText = (value: unknown, label: string, max: number, required = true): string => {
  if (typeof value !== "string") throw new BackendError("VALIDATION", `${label} invalide.`);
  const text = value.trim();
  if (required && !text) throw new BackendError("VALIDATION", `${label} est requis.`);
  if (text.length > max) throw new BackendError("VALIDATION", `${label} est trop long.`);
  return text;
};

const hashPassword = async (password: string): Promise<PasswordRecord> => {
  const salt = crypto.randomBytes(32);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, derived) =>
      error ? reject(error) : resolve(derived as Buffer));
  });
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
};

const verifyPassword = async (password: string, record: PasswordRecord): Promise<boolean> => {
  const expected = Buffer.from(record.hash, "base64");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(record.salt, "base64"), expected.length, { N: 16384, r: 8, p: 1 }, (error, derived) =>
      error ? reject(error) : resolve(derived as Buffer));
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const publicUser = (user: StoredUser) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  active: user.active,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const publicCourse = (course: StoredCourse) => ({ ...course });
const publicScore = (score: StoredScore) => ({
  id: score.id,
  title: score.title,
  description: score.description,
  authorId: score.authorId,
  authorName: score.authorName,
  createdAt: score.createdAt,
  updatedAt: score.updatedAt,
  midiSize: Buffer.byteLength(score.midiBase64, "base64"),
});

export class DrumoBackend {
  private db: Database | null = null;
  private readonly sessions = new Map<string, Session>();
  private readonly failedLogins = new Map<string, { attempts: number; blockedUntil: number }>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly dataFile: string,
    private readonly defaults: { adminUsername?: string; adminPassword?: string } = {},
  ) {}

  private async createDefaultDatabase(): Promise<Database> {
    const adminId = id();
    const createdAt = now();
    const adminUsername = this.defaults.adminUsername?.trim() || "admin";
    const adminPassword = this.defaults.adminPassword || "admin";
    return {
      version: 1,
      users: [{
        id: adminId,
        username: adminUsername,
        usernameKey: normalizeUsername(adminUsername),
        password: await hashPassword(adminPassword),
        role: "admin",
        active: true,
        mustChangePassword: true,
        createdAt,
        updatedAt: createdAt,
      }],
      courses: [
        {
          id: id(), title: "Les fondations du groove", level: "Débutant",
          description: "Construire un rythme stable entre grosse caisse, caisse claire et charleston.",
          content: "1. Réglez le métronome à 70 BPM.\n2. Jouez le charleston en croches.\n3. Placez la caisse claire sur les temps 2 et 4.\n4. Ajoutez la grosse caisse sur les temps 1 et 3.\n\nTravaillez quatre mesures sans accélérer, puis augmentez de 5 BPM.",
          tags: ["groove", "coordination", "débutant"], published: true,
          authorId: adminId, authorName: adminUsername, createdAt, updatedAt: createdAt,
        },
        {
          id: id(), title: "Maîtriser le paradiddle", level: "Intermédiaire",
          description: "Développer régularité, accents et orchestration avec le sticking D G D D / G D G G.",
          content: "Commencez lentement en doubles croches : D G D D | G D G G.\n\nAccentuez la première note de chaque groupe. Quand le mouvement est fluide, déplacez les accents sur les toms et gardez les notes faibles sur la caisse claire.",
          tags: ["rudiments", "paradiddle", "sticking"], published: true,
          authorId: adminId, authorName: adminUsername, createdAt, updatedAt: createdAt,
        },
        {
          id: id(), title: "Créer un fill musical", level: "Intermédiaire",
          description: "Composer des fills lisibles qui servent la transition au lieu de casser le tempo.",
          content: "Réservez d'abord la dernière mesure de votre boucle. Utilisez un motif court, répétez-le sur deux surfaces, puis terminez par une cymbale sur le premier temps suivant. Vérifiez dans Analyser que l'énergie monte progressivement.",
          tags: ["fills", "composition", "dynamique"], published: true,
          authorId: adminId, authorName: adminUsername, createdAt, updatedAt: createdAt,
        },
      ],
      scores: [],
      settings: { maintenance: false, coachEnabled: true, updatesEnabled: true, updateFeedUrl: DEFAULT_UPDATE_FEED_URL },
    };
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.dataFile, "utf8")) as Database;
      if (parsed.version !== 1 || !Array.isArray(parsed.users)) throw new Error("Format de base invalide");
      parsed.courses ??= [];
      parsed.scores ??= [];
      parsed.settings ??= { maintenance: false, coachEnabled: true, updatesEnabled: true, updateFeedUrl: DEFAULT_UPDATE_FEED_URL };
      parsed.settings.updatesEnabled ??= true;
      parsed.settings.updateFeedUrl ??= DEFAULT_UPDATE_FEED_URL;
      this.db = parsed;
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      if (!missing) {
        const backup = `${this.dataFile}.corrupt-${Date.now()}`;
        await fs.rename(this.dataFile, backup).catch(() => undefined);
      }
      this.db = await this.createDefaultDatabase();
      await this.persist();
    }
  }

  private get data(): Database {
    if (!this.db) throw new BackendError("NOT_READY", "Le stockage Drumo n'est pas prêt.");
    return this.db;
  }

  private async persist(): Promise<void> {
    const serialized = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.dataFile}.tmp`;
      await fs.writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporary, this.dataFile);
    });
    return this.writeQueue;
  }

  private authenticate(token: unknown, adminOnly = false): StoredUser {
    if (typeof token !== "string") throw new BackendError("UNAUTHORIZED", "Connexion requise.");
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      throw new BackendError("UNAUTHORIZED", "Votre session a expiré.");
    }
    const user = this.data.users.find((candidate) => candidate.id === session.userId);
    if (!user || !user.active) throw new BackendError("UNAUTHORIZED", "Ce compte est désactivé.");
    if (adminOnly && user.role !== "admin") throw new BackendError("FORBIDDEN", "Accès administrateur requis.");
    session.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    return user;
  }

  private ensureAvailable(user: StoredUser): void {
    if (this.data.settings.maintenance && user.role !== "admin") {
      throw new BackendError("MAINTENANCE", "Drumo est temporairement en maintenance.");
    }
  }

  bootstrap() {
    return { maintenance: this.data.settings.maintenance };
  }

  getSystemSettings() {
    return { ...this.data.settings };
  }

  private openSession(user: StoredUser) {
    const token = crypto.randomBytes(32).toString("base64url");
    this.sessions.set(token, { userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return { token, user: publicUser(user), settings: { ...this.data.settings } };
  }

  async login(input: unknown) {
    const body = (input ?? {}) as Record<string, unknown>;
    const usernameKey = normalizeUsername(cleanText(body.username, "Identifiant", 64));
    const password = cleanText(body.password, "Mot de passe", 256);
    const loginState = this.failedLogins.get(usernameKey);
    if (loginState && loginState.blockedUntil > Date.now()) {
      throw new BackendError("TOO_MANY_ATTEMPTS", "Trop de tentatives. Réessayez dans quelques instants.");
    }
    const user = this.data.users.find((candidate) => candidate.usernameKey === usernameKey);
    if (!user || !(await verifyPassword(password, user.password))) {
      const attempts = (loginState?.attempts ?? 0) + 1;
      this.failedLogins.set(usernameKey, { attempts, blockedUntil: attempts >= 5 ? Date.now() + 30_000 : 0 });
      await new Promise((resolve) => setTimeout(resolve, 250));
      throw new BackendError("INVALID_CREDENTIALS", "Identifiant ou mot de passe incorrect.");
    }
    if (!user.active) throw new BackendError("ACCOUNT_DISABLED", "Ce compte est désactivé.");
    this.failedLogins.delete(usernameKey);
    return this.openSession(user);
  }

  async register(input: unknown) {
    if (this.data.settings.maintenance) {
      throw new BackendError("MAINTENANCE", "Les inscriptions sont suspendues pendant la maintenance.");
    }
    const body = (input ?? {}) as Record<string, unknown>;
    const username = cleanText(body.username, "Identifiant", 64);
    const usernameKey = normalizeUsername(username);
    if (!/^[\p{L}\p{N}_.-]{3,64}$/u.test(username)) {
      throw new BackendError("VALIDATION", "L'identifiant doit contenir 3 à 64 lettres, chiffres, points, tirets ou underscores.");
    }
    if (this.data.users.some((user) => user.usernameKey === usernameKey)) {
      throw new BackendError("CONFLICT", "Cet identifiant existe déjà.");
    }
    const password = cleanText(body.password, "Mot de passe", 256);
    if (password.length < 8) {
      throw new BackendError("WEAK_PASSWORD", "Le mot de passe doit contenir au moins 8 caractères.");
    }
    const createdAt = now();
    const user: StoredUser = {
      id: id(), username, usernameKey, password: await hashPassword(password), role: "user",
      active: true, mustChangePassword: false, createdAt, updatedAt: createdAt,
    };
    this.data.users.push(user);
    await this.persist();
    return this.openSession(user);
  }

  me(token: unknown) {
    const user = this.authenticate(token);
    return { user: publicUser(user), settings: { ...this.data.settings } };
  }

  logout(token: unknown) {
    if (typeof token === "string") this.sessions.delete(token);
    return true;
  }

  async changePassword(token: unknown, input: unknown) {
    const user = this.authenticate(token);
    const body = (input ?? {}) as Record<string, unknown>;
    const currentPassword = cleanText(body.currentPassword, "Mot de passe actuel", 256);
    const newPassword = cleanText(body.newPassword, "Nouveau mot de passe", 256);
    if (!(await verifyPassword(currentPassword, user.password))) {
      throw new BackendError("INVALID_CREDENTIALS", "Le mot de passe actuel est incorrect.");
    }
    if (newPassword.length < 8) throw new BackendError("WEAK_PASSWORD", "Le nouveau mot de passe doit contenir au moins 8 caractères.");
    if (currentPassword === newPassword) throw new BackendError("WEAK_PASSWORD", "Choisissez un mot de passe différent.");
    user.password = await hashPassword(newPassword);
    user.mustChangePassword = false;
    user.updatedAt = now();
    await this.persist();
    return publicUser(user);
  }

  listUsers(token: unknown) {
    this.authenticate(token, true);
    return this.data.users.map(publicUser).sort((a, b) => a.username.localeCompare(b.username));
  }

  async createUser(token: unknown, input: unknown) {
    this.authenticate(token, true);
    const body = (input ?? {}) as Record<string, unknown>;
    const username = cleanText(body.username, "Identifiant", 64);
    const usernameKey = normalizeUsername(username);
    if (!/^[\p{L}\p{N}_.-]{3,64}$/u.test(username)) throw new BackendError("VALIDATION", "L'identifiant doit contenir 3 à 64 lettres, chiffres, points, tirets ou underscores.");
    if (this.data.users.some((user) => user.usernameKey === usernameKey)) throw new BackendError("CONFLICT", "Cet identifiant existe déjà.");
    const password = cleanText(body.password, "Mot de passe", 256);
    if (password.length < 8) throw new BackendError("WEAK_PASSWORD", "Le mot de passe doit contenir au moins 8 caractères.");
    const role: Role = body.role === "admin" ? "admin" : "user";
    const createdAt = now();
    const user: StoredUser = {
      id: id(), username, usernameKey, password: await hashPassword(password), role,
      active: true, mustChangePassword: true, createdAt, updatedAt: createdAt,
    };
    this.data.users.push(user);
    await this.persist();
    return publicUser(user);
  }

  async updateUser(token: unknown, input: unknown) {
    const actor = this.authenticate(token, true);
    const body = (input ?? {}) as Record<string, unknown>;
    const target = this.data.users.find((user) => user.id === body.id);
    if (!target) throw new BackendError("NOT_FOUND", "Utilisateur introuvable.");
    const nextRole: Role = body.role === "admin" ? "admin" : "user";
    const nextActive = body.active !== false;
    if (target.id === actor.id && (nextRole !== "admin" || !nextActive)) {
      throw new BackendError("VALIDATION", "Vous ne pouvez pas retirer vos propres droits administrateur ni désactiver votre compte.");
    }
    if (target.role === "admin" && (nextRole !== "admin" || !nextActive)) {
      const otherAdmins = this.data.users.filter((user) => user.id !== target.id && user.role === "admin" && user.active);
      if (otherAdmins.length === 0) throw new BackendError("VALIDATION", "Drumo doit conserver au moins un administrateur actif.");
    }
    target.role = nextRole;
    target.active = nextActive;
    target.updatedAt = now();
    if (!nextActive) {
      for (const [sessionToken, session] of this.sessions) if (session.userId === target.id) this.sessions.delete(sessionToken);
    }
    await this.persist();
    return publicUser(target);
  }

  listCourses(token: unknown) {
    const user = this.authenticate(token);
    this.ensureAvailable(user);
    return this.data.courses
      .filter((course) => user.role === "admin" || course.published)
      .map(publicCourse)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveCourse(token: unknown, input: unknown) {
    const actor = this.authenticate(token, true);
    const body = (input ?? {}) as Record<string, unknown>;
    const courseId = typeof body.id === "string" ? body.id : "";
    const timestamp = now();
    const tags = Array.isArray(body.tags)
      ? body.tags.slice(0, 12).map((tag) => cleanText(tag, "Tag", 30, false)).filter(Boolean)
      : String(body.tags ?? "").split(",").slice(0, 12).map((tag) => tag.trim()).filter(Boolean);
    const values = {
      title: cleanText(body.title, "Titre", 120),
      description: cleanText(body.description ?? "", "Description", 500, false),
      content: cleanText(body.content, "Contenu", 30_000),
      level: cleanText(body.level ?? "Tous niveaux", "Niveau", 50),
      tags,
      published: body.published !== false,
    };
    let course = this.data.courses.find((candidate) => candidate.id === courseId);
    if (course) {
      Object.assign(course, values, { updatedAt: timestamp });
    } else {
      course = { id: id(), ...values, authorId: actor.id, authorName: actor.username, createdAt: timestamp, updatedAt: timestamp };
      this.data.courses.push(course);
    }
    await this.persist();
    return publicCourse(course);
  }

  async deleteCourse(token: unknown, courseId: unknown) {
    this.authenticate(token, true);
    if (typeof courseId !== "string") throw new BackendError("VALIDATION", "Cours invalide.");
    const before = this.data.courses.length;
    this.data.courses = this.data.courses.filter((course) => course.id !== courseId);
    if (before === this.data.courses.length) throw new BackendError("NOT_FOUND", "Cours introuvable.");
    await this.persist();
    return true;
  }

  listScores(token: unknown) {
    const user = this.authenticate(token);
    this.ensureAvailable(user);
    return this.data.scores
      .filter((score) => user.role === "admin" || score.authorId === user.id)
      .map(publicScore)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveScore(token: unknown, input: unknown) {
    const actor = this.authenticate(token);
    this.ensureAvailable(actor);
    const body = (input ?? {}) as Record<string, unknown>;
    const midiBytes = body.midiBytes;
    if (!Array.isArray(midiBytes) || midiBytes.length === 0 || midiBytes.length > 10_000_000 || midiBytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      throw new BackendError("VALIDATION", "Données MIDI invalides ou trop volumineuses.");
    }
    const projectSerialized = body.projectData === undefined ? undefined : JSON.stringify(body.projectData);
    if (projectSerialized && projectSerialized.length > 15_000_000) throw new BackendError("VALIDATION", "Le projet est trop volumineux.");
    const timestamp = now();
    const score: StoredScore = {
      id: id(),
      title: cleanText(body.title, "Titre", 120),
      description: cleanText(body.description ?? "", "Description", 500, false),
      midiBase64: Buffer.from(midiBytes).toString("base64"),
      projectData: body.projectData,
      authorId: actor.id,
      authorName: actor.username,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.data.scores.push(score);
    await this.persist();
    return publicScore(score);
  }

  getScore(token: unknown, scoreId: unknown) {
    const actor = this.authenticate(token);
    this.ensureAvailable(actor);
    const score = this.data.scores.find((candidate) => candidate.id === scoreId);
    if (!score || (actor.role !== "admin" && score.authorId !== actor.id)) throw new BackendError("NOT_FOUND", "Partition introuvable.");
    return { ...publicScore(score), midiBytes: Array.from(Buffer.from(score.midiBase64, "base64")), projectData: score.projectData };
  }

  async deleteScore(token: unknown, scoreId: unknown) {
    const actor = this.authenticate(token);
    this.ensureAvailable(actor);
    const score = this.data.scores.find((candidate) => candidate.id === scoreId);
    if (!score || (actor.role !== "admin" && score.authorId !== actor.id)) throw new BackendError("NOT_FOUND", "Partition introuvable.");
    this.data.scores = this.data.scores.filter((candidate) => candidate.id !== score.id);
    await this.persist();
    return true;
  }

  getConfig(token: unknown) {
    this.authenticate(token);
    return { ...this.data.settings };
  }

  async updateConfig(token: unknown, input: unknown) {
    this.authenticate(token, true);
    const body = (input ?? {}) as Record<string, unknown>;
    if (typeof body.maintenance === "boolean") this.data.settings.maintenance = body.maintenance;
    if (typeof body.coachEnabled === "boolean") this.data.settings.coachEnabled = body.coachEnabled;
    if (typeof body.updatesEnabled === "boolean") this.data.settings.updatesEnabled = body.updatesEnabled;
    if (typeof body.updateFeedUrl === "string") {
      const updateFeedUrl = body.updateFeedUrl.trim();
      if (updateFeedUrl.length > 500) throw new BackendError("VALIDATION", "L'adresse du serveur de mises à jour est trop longue.");
      if (updateFeedUrl) {
        let parsed: URL;
        try { parsed = new URL(updateFeedUrl); } catch { throw new BackendError("VALIDATION", "Adresse de mises à jour invalide."); }
        const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
        if (parsed.protocol !== "https:" && !localHttp) throw new BackendError("VALIDATION", "Le serveur de mises à jour doit utiliser HTTPS.");
      }
      this.data.settings.updateFeedUrl = updateFeedUrl;
    }
    await this.persist();
    return { ...this.data.settings };
  }

  coach(token: unknown, input: unknown) {
    const actor = this.authenticate(token);
    this.ensureAvailable(actor);
    if (!this.data.settings.coachEnabled) throw new BackendError("COACH_DISABLED", "Le Coach IA est désactivé par un administrateur.");
    const body = (input ?? {}) as Record<string, unknown>;
    const message = cleanText(body.message, "Question", 1000);
    const context = (body.context ?? {}) as Record<string, unknown>;
    const lower = message.toLocaleLowerCase("fr-FR");
    const bpm = typeof context.bpm === "number" ? Math.round(context.bpm) : null;
    const hits = typeof context.hits === "number" ? Math.round(context.hits) : null;
    const projectName = typeof context.projectName === "string" ? context.projectName.slice(0, 80) : null;
    const projectIntro = projectName
      ? `Pour « ${projectName} »${bpm ? ` à ${bpm} BPM` : ""}${hits !== null ? ` (${hits} frappes)` : ""}, `
      : "";
    let answer: string;
    if (/tempo|bpm|vitesse|accél|rapide/.test(lower)) {
      answer = `${projectIntro}travaille d'abord à une vitesse où tu peux jouer trois fois sans tension ni décalage. Descends de 15 à 20 %${bpm ? `, donc autour de ${Math.max(40, Math.round(bpm * 0.82))} BPM` : ""}, puis remonte par paliers de 3 à 5 BPM. Si une répétition se dégrade, reviens au palier précédent.`;
    } else if (/coordination|main|pied|membre|sticking|croisement/.test(lower)) {
      answer = `${projectIntro}isole les membres par couches : charleston seul, puis caisse claire, puis grosse caisse. Joue chaque couche huit mesures avant d'ajouter la suivante. Dans Apprendre, observe la simulation corporelle ; un mouvement qui se croise ou se crispe indique souvent qu'il faut revoir le sticking.`;
    } else if (/fill|transition|break/.test(lower)) {
      answer = `${projectIntro}construis un fill à partir d'une cellule de deux ou quatre notes, puis orchestre-la sur les toms. Garde le premier temps de la mesure suivante très clair, idéalement grosse caisse + crash. Commence par un fill d'un demi-temps : le silence bien placé est souvent plus musical qu'une avalanche de notes.`;
    } else if (/groove|rythme|pocket|régulier|timing/.test(lower)) {
      answer = `${projectIntro}verrouille d'abord la relation grosse caisse–caisse claire. Mets le métronome sur les temps 2 et 4, joue doucement et enregistre quatre mesures. Cherche une dynamique constante au charleston et une caisse claire légèrement plus forte ; le “pocket” vient davantage de cette cohérence que de la complexité.`;
    } else if (/début|commenc|apprendre|exercice|cours/.test(lower)) {
      answer = `Commence par le cours « Les fondations du groove » dans Bibliothèque > Cours. Ensuite : 5 minutes de pulsation, 10 minutes de groove lent, 5 minutes de jeu libre. La règle d'or : ne monte la difficulté que lorsque le mouvement reste détendu.`;
    } else if (/sauveg|bibliothèque|partition|midi/.test(lower)) {
      answer = `Ouvre Bibliothèque > Mes projets, puis clique sur « Sauvegarder le projet courant ». Drumo conserve le MIDI et les données d'édition dans ton compte ; tu pourras ensuite le rouvrir directement dans Composer.`;
    } else {
      answer = `${projectIntro}je te conseille de choisir un objectif très précis pour les dix prochaines minutes : régularité, coordination, dynamique ou vitesse. Joue une boucle courte, écoute le résultat dans Analyser, puis ne change qu'un seul paramètre à la fois. Dis-moi ce qui te bloque exactement et je te proposerai un exercice ciblé.`;
    }
    return { answer, createdAt: now(), mode: "offline" as const };
  }
}

type Handler = (...args: unknown[]) => unknown | Promise<unknown>;

export const registerBackendHandlers = async (ipcMain: IpcMain, userDataPath: string, apiUrl = ""): Promise<DrumoBackend | import("./remoteBackend.js").RemoteDrumoBackend> => {
  const backend = apiUrl
    ? new (await import("./remoteBackend.js")).RemoteDrumoBackend(apiUrl)
    : new DrumoBackend(path.join(userDataPath, "drumo-data.json"));
  await backend.initialize();
  const register = (channel: string, handler: Handler) => {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      try {
        return { ok: true, data: await handler(...args) };
      } catch (error) {
        const known = error instanceof BackendError;
        return {
          ok: false,
          error: {
            code: known ? error.code : "INTERNAL",
            message: known ? error.message : "Une erreur interne est survenue.",
          },
        };
      }
    });
  };

  register("backend:bootstrap", () => backend.bootstrap());
  register("auth:login", (input) => backend.login(input));
  register("auth:register", (input) => backend.register(input));
  register("auth:me", (token) => backend.me(token));
  register("auth:logout", (token) => backend.logout(token));
  register("auth:change-password", (token, input) => backend.changePassword(token, input));
  register("admin:list-users", (token) => backend.listUsers(token));
  register("admin:create-user", (token, input) => backend.createUser(token, input));
  register("admin:update-user", (token, input) => backend.updateUser(token, input));
  register("course:list", (token) => backend.listCourses(token));
  register("admin:save-course", (token, input) => backend.saveCourse(token, input));
  register("admin:delete-course", (token, courseId) => backend.deleteCourse(token, courseId));
  register("score:list", (token) => backend.listScores(token));
  register("score:save", (token, input) => backend.saveScore(token, input));
  register("score:get", (token, scoreId) => backend.getScore(token, scoreId));
  register("score:delete", (token, scoreId) => backend.deleteScore(token, scoreId));
  register("config:get", (token) => backend.getConfig(token));
  register("admin:update-config", (token, input) => backend.updateConfig(token, input));
  register("coach:chat", (token, input) => backend.coach(token, input));
  return backend;
};
