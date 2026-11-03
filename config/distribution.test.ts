import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { ExpoConfig } from 'expo/config';

import appConfig from '../app.config';

/*
 * Contrôles STATIQUES de la distribution (Lot 7C) : identité Android, séparation preview / production, mises à jour, absence de secret.
 * Ils ne prouvent PAS qu'un build signé s'installe par-dessus le précédent ni qu'une mise à jour OTA arrive : cela exige un vrai build
 * autonome et une vraie publication (docs/android-distribution.md, docs/eas-updates.md).
 */

const root = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const staticConfig = JSON.parse(read('app.json')).expo as ExpoConfig;
const easJson = JSON.parse(read('eas.json')) as {
  cli: { appVersionSource: string };
  build: Record<string, { channel?: string; distribution?: string; autoIncrement?: boolean; env?: Record<string, string>; android?: { buildType?: string }; developmentClient?: boolean }>;
};

function resolve(variant: string | undefined, base: ExpoConfig = staticConfig): ExpoConfig {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return appConfig({ config: base, projectRoot: root, staticConfigPath: null, packageJsonPath: null });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

describe('identité Android', () => {
  it('production : le paquet familial reste app.sovmilo (jamais changé en silence)', () => {
    expect(staticConfig.android?.package).toBe('app.sovmilo');
    expect(resolve(undefined).android?.package).toBe('app.sovmilo');
    expect(resolve('production').android?.package).toBe('app.sovmilo');
    expect(resolve('production').scheme).toBe('sovmilo');
  });

  it('preview : paquet distinct, installable à côté de l\'application familiale', () => {
    const preview = resolve('preview');
    expect(preview.android?.package).toBe('app.sovmilo.preview');
    expect(preview.ios?.bundleIdentifier).toBe('app.sovmilo.preview');
    expect(preview.scheme).toBe('sovmilo-preview');
    expect(preview.name).toBe('Sovmilo (preview)');
    expect(preview.android?.package).not.toBe(resolve(undefined).android?.package);
  });

  it('versionCode défini et entier positif', () => {
    const code = resolve(undefined).android?.versionCode;
    expect(Number.isInteger(code)).toBe(true);
    expect(code).toBeGreaterThanOrEqual(1);
  });

  it('les images d\'icône et de lancement référencées existent (aucun visuel inventé)', () => {
    const config = resolve(undefined);
    const files = [config.icon, config.android?.adaptiveIcon?.foregroundImage, config.android?.adaptiveIcon?.backgroundImage, config.android?.adaptiveIcon?.monochromeImage];
    for (const file of files) {
      expect(file).toBeTruthy();
      expect(existsSync(path.join(root, file as string))).toBe(true);
    }
  });
});

describe('mises à jour', () => {
  it('version d\'exécution : empreinte du code natif', () => {
    expect(resolve(undefined).runtimeVersion).toEqual({ policy: 'fingerprint' });
  });

  it('sans identifiant de projet : aucune adresse inventée, expo-updates reste désactivé', () => {
    const withoutProject = { ...staticConfig, extra: { ...staticConfig.extra, eas: undefined } };
    expect(resolve(undefined, withoutProject).updates?.url).toBeUndefined();
  });

  it('identifiant de projet de app.json (écrit par `eas init`) : au format UUID, adresse dérivée', () => {
    const projectId = (staticConfig.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (projectId === undefined) return; // pas encore de `eas init` : rien à contrôler
    expect(projectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(resolve(undefined).updates?.url).toBe(`https://u.expo.dev/${projectId}`);
  });

  it('avec un identifiant de projet : adresse EAS Update dérivée, jamais saisie à la main', () => {
    const withProject = { ...staticConfig, extra: { eas: { projectId: '00000000-0000-4000-8000-000000000000' } } };
    expect(resolve(undefined, withProject).updates?.url).toBe('https://u.expo.dev/00000000-0000-4000-8000-000000000000');
  });

  it('aucune vérification automatique : les mises à jour se lancent depuis Paramètres', () => {
    expect(resolve(undefined).updates?.checkAutomatically).toBe('NEVER');
  });
});

describe('eas.json', () => {
  it('canaux séparés preview / production, APK, versions gérées par EAS', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
    expect(easJson.build.preview.channel).toBe('preview');
    expect(easJson.build.production.channel).toBe('production');
    expect(easJson.build.preview.channel).not.toBe(easJson.build.production.channel);
    for (const profile of ['preview', 'production']) {
      expect(easJson.build[profile].android?.buildType).toBe('apk');
      expect(easJson.build[profile].distribution).toBe('internal');
    }
    expect(easJson.build.production.autoIncrement).toBe(true);
  });

  it('seul le profil preview prend la variante preview', () => {
    expect(easJson.build.preview.env?.APP_VARIANT).toBe('preview');
    expect(easJson.build.production.env?.APP_VARIANT).toBe('production');
  });

  it('pas de profil de développement sans client de développement installé', () => {
    const usesDevClient = Object.values(easJson.build).some((profile) => profile.developmentClient === true);
    expect(usesDevClient).toBe(false);
    expect(JSON.parse(read('package.json')).dependencies['expo-dev-client']).toBeUndefined();
  });
});

describe('secrets', () => {
  it('aucun mot de passe, clé ou jeton dans les fichiers de configuration', () => {
    const suspicious = /(password|passphrase|keystore|private[_ -]?key|secret|token|api[_-]?key)\s*["']?\s*[:=]/i;
    for (const file of ['eas.json', 'app.json', 'app.config.ts']) expect(read(file)).not.toMatch(suspicious);
  });

  it('le dépôt ignore sauvegardes, keystores et identifiants de signature', () => {
    const ignore = read('.gitignore');
    for (const entry of ['*.keystore', 'credentials.json', '*.apk', '*.aab', 'sovmilo-backup-*', '*.db']) expect(ignore).toContain(entry);
  });
});
