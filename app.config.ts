import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuration dynamique : elle PART de `app.json` (l'identité de l'application y reste lisible) et n'ajoute que ce qui dépend de la
 * variante de build ou d'une valeur propre au compte Expo. Voir docs/android-distribution.md et docs/eas-updates.md.
 *
 *  - Variante « production » (défaut, `APP_VARIANT` absent) : identité FAMILIALE, `app.sovmilo`. Ne jamais la changer : le nom de
 *    paquet et la clé de signature sont ce qui permet à Android d'installer une version PAR-DESSUS la précédente en gardant les données.
 *  - Variante « preview » (`APP_VARIANT=preview`, posé par le profil EAS `preview`) : paquet distinct `app.sovmilo.preview`, installable
 *    À CÔTÉ de l'application familiale, avec ses propres données. Sert aux essais du développeur sans jamais toucher l'installation familiale.
 */

const PRODUCTION_PACKAGE = 'app.sovmilo';
const PREVIEW_SUFFIX = '.preview';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isPreview = process.env.APP_VARIANT === 'preview';
  // Renseigné par `eas init` (dans app.json). Absent : AUCUNE adresse de mise à jour n'est inventée, expo-updates reste désactivé
  // et Paramètres affiche « les mises à jour ne sont pas activées dans cette version ».
  const projectId = (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

  return {
    ...config,
    name: isPreview ? `${config.name} (preview)` : config.name!,
    slug: config.slug!,
    scheme: isPreview ? `${config.scheme}-preview` : config.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: isPreview ? `${config.ios?.bundleIdentifier ?? PRODUCTION_PACKAGE}${PREVIEW_SUFFIX}` : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: isPreview ? `${config.android?.package ?? PRODUCTION_PACKAGE}${PREVIEW_SUFFIX}` : config.android?.package,
      // Valeur de départ : avec `appVersionSource: remote` (eas.json), EAS tient le vrai compteur et l'incrémente à chaque build de production.
      versionCode: config.android?.versionCode ?? 1,
    },
    // « fingerprint » : la version d'exécution est calculée à partir de ce qui touche au code natif (modules, configuration, plugins).
    // Une mise à jour OTA n'est proposée qu'aux installations dont le code natif est IDENTIQUE : un JavaScript qui attendrait un module
    // natif absent n'est jamais livré. Le paquet fait partie de l'empreinte : preview et production ont donc des versions d'exécution
    // différentes, en plus de leurs canaux séparés.
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      ...config.updates,
      ...(projectId ? { url: `https://u.expo.dev/${projectId}` } : {}),
      // Aucune vérification automatique : l'utilisatrice (ou le développeur) lance « Vérifier les mises à jour » dans Paramètres.
      // Jamais de redémarrage ni de migration de base qu'on n'a pas choisis.
      checkAutomatically: 'NEVER',
    },
  };
};
