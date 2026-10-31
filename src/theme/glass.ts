import type { ThemeName } from './tokens';

/**
 * Matière « Precision Glass » des éléments FLOTTANTS : navigation, bouton +, menu d'actions, menus déroulants,
 * panneaux inférieurs, notifications. Les cartes posées sur le fond ne l'utilisent pas (elles restent opaques).
 *
 * Quatre couches, toutes sans flou natif :
 *  1. un fond graphite (ou blanc minéral) semi-opaque, assez dense pour rester lisible sur n'importe quel contenu ;
 *  2. un contour fin, légèrement lumineux ;
 *  3. un reflet de lumière qui descend du bord supérieur (dégradé) et un liseré d'un pixel sur ce bord ;
 *  4. les ombres douces déjà définies dans `shadows.ts`.
 *
 * Le flou d'arrière-plan n'est PAS branché : sur Android il demande un module natif (reconstruction de l'APK) et un réglage
 * par appareil qu'on ne peut pas vérifier ici. Le rendu est donc volontairement complet sans lui ; si on l'ajoute plus tard,
 * il se place sous `GlassSurface` (voir `src/components/ui/glass-surface.tsx`) sans toucher aux recettes ci-dessous.
 */

export type GlassVariant = 'bar' | 'fab' | 'menu' | 'sheet' | 'toast';

export interface GlassRecipe {
  /** Fond semi-opaque. */
  fill: string;
  /** Contour fin légèrement lumineux. */
  border: string;
  /** Reflet qui descend du bord supérieur : couleur + opacité de départ (elle tombe à 0 en bas). */
  sheen: { color: string; opacity: number };
  /** Liseré d'un pixel sur le bord supérieur : fond au centre, transparent aux extrémités. */
  rim: { color: string; opacity: number };
}

/** Hauteur maximale du reflet (dp) : au-delà, un grand panneau reste uni. */
export const GLASS_SHEEN_HEIGHT = 72;

const dark: Record<GlassVariant, GlassRecipe> = {
  bar: {
    fill: 'rgba(21,23,26,0.88)',
    border: 'rgba(255,255,255,0.09)',
    sheen: { color: '#FFFFFF', opacity: 0.07 },
    rim: { color: '#FFFFFF', opacity: 0.2 },
  },
  fab: {
    fill: 'rgba(41,45,41,0.95)',
    border: 'rgba(255,255,255,0)', // le bouton + garde son contour citron (jetons fabBorder)
    sheen: { color: '#FFFFFF', opacity: 0.09 },
    rim: { color: '#FFFFFF', opacity: 0.24 },
  },
  menu: {
    fill: 'rgba(26,28,32,0.94)',
    border: 'rgba(255,255,255,0.10)',
    sheen: { color: '#FFFFFF', opacity: 0.065 },
    rim: { color: '#FFFFFF', opacity: 0.2 },
  },
  sheet: {
    fill: 'rgba(22,24,27,0.96)',
    border: 'rgba(255,255,255,0.09)',
    sheen: { color: '#FFFFFF', opacity: 0.055 },
    rim: { color: '#FFFFFF', opacity: 0.18 },
  },
  toast: {
    fill: 'rgba(36,39,44,0.95)',
    border: 'rgba(255,255,255,0.10)',
    sheen: { color: '#FFFFFF', opacity: 0.07 },
    rim: { color: '#FFFFFF', opacity: 0.2 },
  },
};

const light: Record<GlassVariant, GlassRecipe> = {
  bar: {
    fill: 'rgba(255,255,255,0.90)',
    border: 'rgba(32,34,39,0.08)',
    sheen: { color: '#FFFFFF', opacity: 0.9 },
    rim: { color: '#FFFFFF', opacity: 1 },
  },
  fab: {
    fill: 'rgba(255,255,255,0.96)',
    border: 'rgba(255,255,255,0)',
    sheen: { color: '#FFFFFF', opacity: 0.9 },
    rim: { color: '#FFFFFF', opacity: 1 },
  },
  menu: {
    fill: 'rgba(255,255,255,0.96)',
    border: 'rgba(32,34,39,0.09)',
    sheen: { color: '#FFFFFF', opacity: 0.9 },
    rim: { color: '#FFFFFF', opacity: 1 },
  },
  sheet: {
    fill: 'rgba(255,255,255,0.97)',
    border: 'rgba(32,34,39,0.08)',
    sheen: { color: '#FFFFFF', opacity: 0.9 },
    rim: { color: '#FFFFFF', opacity: 1 },
  },
  toast: {
    fill: 'rgba(255,255,255,0.96)',
    border: 'rgba(32,34,39,0.08)',
    sheen: { color: '#FFFFFF', opacity: 0.9 },
    rim: { color: '#FFFFFF', opacity: 1 },
  },
};

export const glassRecipes: Record<ThemeName, Record<GlassVariant, GlassRecipe>> = { light, dark };
