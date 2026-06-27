# Drumo Cloud Setup

Ce document decrit la premiere etape cloud de Drumo. Le fonctionnement local reste prioritaire : si Supabase n'est pas configure ou si Internet est indisponible, Drumo continue avec ses donnees locales.

## Architecture retenue

- Application desktop : Electron, Vite, React, Zustand.
- Login existant : backend Electron/local ou serveur central Drumo, avec mots de passe hashes par `crypto.scrypt`.
- Bibliotheque locale : plusieurs stores `localStorage`, notamment `drumo:scores_v1` pour les partitions importees et `drumo:sample_kits_v1` pour les kits.
- Cloud progressif : Supabase Auth + tables `profiles`, `library_items`, `app_versions`.
- Secret server-only : `SUPABASE_SERVICE_ROLE_KEY` ne doit etre utilisee que par le serveur Node Drumo, jamais dans le renderer.

## Creer le projet Supabase

1. Creer un projet sur Supabase.
2. Ouvrir SQL Editor.
3. Executer le contenu de `supabase/schema.sql`.
4. Dans Authentication, activer Email/Password.
5. Optionnel : creer un bucket Storage pour les fichiers volumineux, par exemple `library-files`.

## Variables d'environnement

Copier `.env.example` vers `.env` pour le developpement local.

Variables renderer :

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Variables serveur uniquement :

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

Ne jamais commiter `.env` ni de cle service role.

## Lancer Drumo en local

```bash
npm install
npm run dev
```

Sans variables Supabase, Drumo utilise seulement le backend local existant.

## Tester le login

1. Lancer `npm run dev`.
2. Creer ou utiliser un compte Drumo local.
3. Pour tester Supabase Auth en plus du compte local, utiliser un identifiant au format email.
4. Si Supabase est configure, Drumo tente aussi d'ouvrir une session cloud. En cas d'echec, le login local reste valide.

Hypothese actuelle : la migration douce associe le compte cloud quand l'identifiant local est un email. Les comptes locaux non-email restent locaux jusqu'a une future interface de liaison de compte.

## Tester la synchronisation

1. Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
2. Se connecter avec un compte email.
3. Importer une partition dans la bibliotheque locale.
4. Redemarrer Drumo ou se reconnecter.
5. Verifier la console : les logs `[librarySync]` indiquent les uploads/downloads.
6. Dans Supabase, verifier la table `library_items`.

La synchro compare `local_id` et `updated_at`. Les elements locaux plus recents sont envoyes au cloud. Les elements cloud absents localement sont recrees localement comme references de bibliotheque. Les fichiers eux-memes restent locaux dans cette etape ; `file_url` est pret pour une future integration Supabase Storage.

## Publier une nouvelle version distante

Ajouter une ligne dans `app_versions` :

```sql
insert into public.app_versions
  (version, platform, download_url, changelog, required_update)
values
  ('1.2.1', 'windows', 'https://example.com/drumo-1.2.1.exe', 'Corrections et ameliorations', false);
```

La fonction renderer `checkForUpdates()` retourne par exemple :

```json
{
  "latest_version": "1.2.1",
  "download_url": "https://example.com/drumo-1.2.1.exe",
  "required": false,
  "changelog": "Corrections et ameliorations"
}
```

Le systeme de mise a jour Electron existant continue aussi de fonctionner avec le manifeste GitHub `latest.json`.

## Prochaines etapes recommandees

1. Ajouter une interface "Connecter mon cloud" dans les reglages pour les comptes locaux non-email.
2. Envoyer les fichiers dans Supabase Storage et remplir `file_url`.
3. Ajouter un champ `sync_status` local pour afficher les conflits.
4. Remplacer progressivement le stockage serveur `drumo_state` JSON par les tables normalisees.
