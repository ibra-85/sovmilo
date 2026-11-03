import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { BottomSheet, Button, ConfirmDialog, FieldGroup, Icon, InfoRow, ServiceRow, Spinner, Text, type IconName } from '@/components/ui';
import { useLocale } from '@/i18n/use-locale';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { COUNT_KEYS } from './format';
import { useBackupFlow, type BackupPhase, type BackupStep } from './use-backup-flow';

const BUSY_KEYS = {
  create: 'backup.busyCreate',
  save: 'backup.busySave',
  check: 'backup.busyCheck',
  restore: 'backup.busyRestore',
} as const satisfies Record<BackupStep, string>;

/**
 * Section « Données et sauvegardes » de Paramètres. Deux actions, chacune avec son parcours complet (avertissement, progression,
 * résultat vérifié). La restauration passe par un écran de confirmation DISTINCT (icône et bouton d'alerte, chiffres lus dans le
 * fichier validé) : jamais une simple notification. Toute la logique est dans `use-backup-flow.ts` et `platform.ts`.
 */
export function BackupSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const flow = useBackupFlow();
  const { phase } = flow;

  const formatDate = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleSection" accessibilityRole="header">
          {t('settings.dataTitle')}
        </Text>
        <Text variant="secondary" tone="muted">
          {t('settings.dataHelp')}
        </Text>
      </View>

      <FieldGroup>
        <ServiceRow icon="backup" title={t('backup.actionTitle')} text={t('backup.actionText')} onPress={flow.startBackup} />
        <ServiceRow icon="restoreData" title={t('backup.restoreTitle')} text={t('backup.restoreText')} onPress={() => void flow.startRestore()} />
      </FieldGroup>

      <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
        {flow.last ? t('backup.lastSaved', { date: formatDate(flow.last.savedAt) }) : t('backup.neverSaved')}
      </Text>

      <ConfirmDialog
        visible={phase.kind === 'warn'}
        tone="neutral"
        icon="backup"
        confirmIcon="check"
        title={t('backup.warnTitle')}
        cancelLabel={t('backup.cancel')}
        confirmLabel={t('backup.warnConfirm')}
        onCancel={flow.dismiss}
        onConfirm={() => void flow.confirmBackup()}>
        <Text variant="body">{t('backup.warnText')}</Text>
      </ConfirmDialog>

      <BusySheet phase={phase} />
      <ResultSheet phase={phase} onClose={flow.dismiss} />
      <RestorePreview phase={phase} onCancel={flow.cancelRestore} onConfirm={() => void flow.confirmRestore()} formatDate={formatDate} />
    </View>
  );
}

/** Opération en cours : panneau qu'on ne peut fermer ni par le voile ni par Retour (même principe que la suppression). */
function BusySheet({ phase }: { phase: BackupPhase }) {
  const { t } = useTranslation();
  const visible = phase.kind === 'busy';
  // Le dernier texte reste affiché pendant l'animation de fermeture.
  const step = phase.kind === 'busy' ? phase.step : 'create';
  return (
    <BottomSheet visible={visible} onClose={() => undefined} dismissible={false} accessibilityLabel={t(BUSY_KEYS[step])}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
        <Spinner size={24} />
        <Text variant="body" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {t(BUSY_KEYS[step])}
        </Text>
      </View>
    </BottomSheet>
  );
}

interface ResultContent {
  icon: IconName;
  title: string;
  text: string;
  hint?: string;
  danger?: boolean;
}

function ResultSheet({ phase, onClose }: { phase: BackupPhase; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const content = resultContent(phase, t);
  const visible = content !== null;
  // Contenu conservé le temps de la sortie animée.
  const shown = content ?? { icon: 'check' as IconName, title: '', text: '' };

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={shown.title}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.iconButton,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: shown.danger ? colors.dangerSoft : colors.surfaceMuted,
          borderWidth: shown.danger ? 1 : 0,
          borderColor: colors.dangerLine,
        }}>
        <Icon name={shown.icon} size={22} color={shown.danger ? colors.danger : colors.ink} />
      </View>
      <Text variant="titleSheet" accessibilityRole="header" style={{ marginTop: 16 }}>
        {shown.title}
      </Text>
      <Text variant="body" style={{ marginTop: 12 }}>
        {shown.text}
      </Text>
      {shown.hint !== undefined && (
        <Text variant="secondary" tone="muted" style={{ marginTop: 8 }}>
          {shown.hint}
        </Text>
      )}
      <Button label={t('backup.ok')} onPress={onClose} style={{ marginTop: space.screen }} />
    </BottomSheet>
  );
}

function resultContent(phase: BackupPhase, t: TFunction): ResultContent | null {
  switch (phase.kind) {
    case 'saved':
      return { icon: 'check', title: t('backup.doneTitle'), text: t('backup.doneText', { name: phase.fileName }), hint: t('backup.doneHint') };
    case 'notSaved':
      return { icon: 'backup', title: t('backup.notSavedTitle'), text: t('backup.notSavedText') };
    case 'error':
      return { icon: 'overBudget', title: t('backup.errorTitle'), text: t(`backup.errors.${phase.code}`), hint: t('backup.unchanged'), danger: true };
    case 'restored':
      return { icon: 'check', title: t('backup.restoredTitle'), text: t('backup.restoredText') };
    case 'rolledBack':
      return { icon: 'restoreData', title: t('backup.rolledBackTitle'), text: t('backup.rolledBackText') };
    case 'failed':
      return { icon: 'overBudget', title: t('backup.failedTitle'), text: t('backup.failedText'), danger: true };
    default:
      return null;
  }
}

interface RestorePreviewProps {
  phase: BackupPhase;
  onCancel: () => void;
  onConfirm: () => void;
  formatDate: (iso: string) => string;
}

/** Confirmation de restauration : ce que le fichier contient (relu depuis le fichier validé), puis l'avertissement de remplacement. */
function RestorePreview({ phase, onCancel, onConfirm, formatDate }: RestorePreviewProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const screen = useWindowDimensions();

  const preview = phase.kind === 'preview' ? phase : null;

  return (
    <ConfirmDialog
      visible={preview !== null}
      title={t('backup.previewTitle')}
      icon="restoreData"
      confirmIcon="restoreData"
      cancelLabel={t('backup.cancel')}
      confirmLabel={t('backup.replaceConfirm')}
      onCancel={onCancel}
      onConfirm={onConfirm}>
      {preview !== null && (
        <View style={{ gap: 12 }}>
          <ScrollView style={{ maxHeight: Math.max(160, screen.height * 0.34) }} showsVerticalScrollIndicator={false}>
            <FieldGroup>
              <InfoRow label={t('backup.previewFile')} value={preview.fileName} />
              <InfoRow label={t('backup.previewCreated')} value={formatDate(preview.inspected.meta.createdAt)} />
              <InfoRow label={t('backup.previewVersion')} value={preview.inspected.meta.appVersion} />
              {COUNT_KEYS.map((key) => (
                <InfoRow key={key} label={t(`backup.count.${key}`)} value={String(preview.inspected.counts[key])} />
              ))}
            </FieldGroup>
          </ScrollView>

          {preview.inspected.migrated && (
            <Text variant="secondary" tone="muted">
              {t('backup.previewMigrated')}
            </Text>
          )}

          <View style={{ padding: 12, borderRadius: radius.iconButton, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine, gap: 6 }}>
            <Text variant="bodyStrong" accessibilityRole="alert">
              {t('backup.replaceWarning')}
            </Text>
            <Text variant="secondary" tone="muted">
              {t('backup.replaceNote')}
            </Text>
          </View>
        </View>
      )}
    </ConfirmDialog>
  );
}
