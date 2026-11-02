import { useCallback, useEffect, useRef, useState } from 'react';

import { BackupError, type BackupErrorCode } from './format';
import type { InspectedBackup } from './inspect';
import { discardInspection, pickAndInspectBackup, prepareBackup, readLastBackup, restoreInspectedBackup, saveBackup, type LastBackup } from './platform';

export type BackupStep = 'create' | 'save' | 'check' | 'restore';

/** Où en est le parcours affiché dans Paramètres. Une seule phase à la fois : l'écran en déduit le panneau à montrer. */
export type BackupPhase =
  | { kind: 'idle' }
  /** Avertissement « fichier non chiffré » avant de choisir un dossier. */
  | { kind: 'warn' }
  | { kind: 'busy'; step: BackupStep }
  | { kind: 'saved'; fileName: string }
  /** Sauvegarde vérifiée mais aucun fichier écrit (sélecteur de dossier annulé). */
  | { kind: 'notSaved' }
  /** Fichier prévalidé, en attente de la confirmation explicite. */
  | { kind: 'preview'; inspected: InspectedBackup; fileName: string }
  | { kind: 'restored' }
  | { kind: 'rolledBack' }
  | { kind: 'failed' }
  /** Refus de fichier ou échec AVANT toute modification : les données de l'appareil n'ont pas bougé. */
  | { kind: 'error'; code: BackupErrorCode };

const codeOf = (error: unknown): BackupErrorCode => (error instanceof BackupError ? error.code : 'unreadable');

/**
 * Parcours « Sauvegarder » et « Restaurer » de Paramètres. Une action à la fois (garde `running`) ; le fichier de restauration reste
 * ouvert en mémoire pendant l'aperçu et est TOUJOURS refermé (annulation, démontage de l'écran, fin de restauration).
 */
export function useBackupFlow() {
  const [phase, setPhase] = useState<BackupPhase>({ kind: 'idle' });
  const [last, setLast] = useState<LastBackup | null>(readLastBackup);
  const running = useRef(false);
  const previewRef = useRef<InspectedBackup | null>(null);

  const closePreview = useCallback(() => {
    const inspected = previewRef.current;
    previewRef.current = null;
    if (inspected) void discardInspection(inspected).catch(() => undefined);
  }, []);

  // Écran quitté pendant l'aperçu : on referme la copie ouverte en mémoire.
  useEffect(() => closePreview, [closePreview]);

  const begin = useCallback(() => {
    if (running.current) return false;
    running.current = true;
    return true;
  }, []);

  /** Étape 1 : l'avertissement. Rien n'est créé tant que l'utilisatrice n'a pas confirmé. */
  const startBackup = useCallback(() => {
    if (running.current) return;
    setPhase({ kind: 'warn' });
  }, []);

  const confirmBackup = useCallback(async () => {
    if (!begin()) return;
    try {
      setPhase({ kind: 'busy', step: 'create' });
      const backup = await prepareBackup();
      setPhase({ kind: 'busy', step: 'save' });
      const result = await saveBackup(backup);
      if (result.status === 'cancelled') {
        setPhase({ kind: 'notSaved' });
        return;
      }
      setLast({ savedAt: result.savedAt, fileName: result.fileName });
      setPhase({ kind: 'saved', fileName: result.fileName });
    } catch (error) {
      setPhase({ kind: 'error', code: codeOf(error) });
    } finally {
      running.current = false;
    }
  }, [begin]);

  /** Étape 1 de la restauration : choisir le fichier et le valider SANS toucher aux données de l'appareil. */
  const startRestore = useCallback(async () => {
    if (!begin()) return;
    try {
      setPhase({ kind: 'busy', step: 'check' });
      const result = await pickAndInspectBackup();
      if (result.status === 'cancelled') {
        setPhase({ kind: 'idle' });
        return;
      }
      previewRef.current = result.inspected;
      setPhase({ kind: 'preview', inspected: result.inspected, fileName: result.fileName });
    } catch (error) {
      setPhase({ kind: 'error', code: codeOf(error) });
    } finally {
      running.current = false;
    }
  }, [begin]);

  const cancelRestore = useCallback(() => {
    if (running.current) return;
    closePreview();
    setPhase({ kind: 'idle' });
  }, [closePreview]);

  /** Étape 2 : remplacement. Jamais de « réussi » avant la vérification faite par `restoreInspectedBackup`. */
  const confirmRestore = useCallback(async () => {
    const inspected = previewRef.current;
    if (!inspected || !begin()) return;
    try {
      setPhase({ kind: 'busy', step: 'restore' });
      const outcome = await restoreInspectedBackup(inspected);
      previewRef.current = null;
      if (outcome.status === 'restored') setPhase({ kind: 'restored' });
      else if (outcome.status === 'rolledBack') setPhase({ kind: 'rolledBack' });
      else setPhase({ kind: 'failed' });
    } catch (error) {
      // Échec AVANT toute modification (copie de sécurité impossible, opération déjà en cours) : les données n'ont pas bougé.
      previewRef.current = null;
      setPhase({ kind: 'error', code: codeOf(error) });
    } finally {
      running.current = false;
    }
  }, [begin]);

  const dismiss = useCallback(() => {
    if (running.current) return;
    setPhase({ kind: 'idle' });
  }, []);

  return { phase, last, startBackup, confirmBackup, startRestore, cancelRestore, confirmRestore, dismiss };
}
