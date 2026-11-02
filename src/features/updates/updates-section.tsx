import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ConfirmDialog, FieldGroup, InfoRow, ServiceRow, Spinner, Text } from '@/components/ui';
import { useLocale } from '@/i18n/use-locale';

import type { UpdateState } from './update-flow';
import { useUpdates } from './use-updates';

function stateKey(state: UpdateState) {
  return state.phase === 'unavailable' ? state.reason : state.phase;
}

/**
 * Section « Mises à jour » de Paramètres : version, état, vérification manuelle. Dans Expo Go ou en développement aucune action n'est
 * proposée (message explicatif seulement). Une mise à jour téléchargée n'est appliquée qu'après une confirmation explicite.
 */
export function UpdatesSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const updates = useUpdates();
  const [confirming, setConfirming] = useState(false);
  const { state } = updates;

  const checkedAt = state.phase === 'upToDate' || state.phase === 'downloaded' ? state.checkedAt : null;
  const formatDate = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleSection" accessibilityRole="header">
          {t('settings.updatesTitle')}
        </Text>
        <Text variant="secondary" tone="muted">
          {t('settings.updatesHelp')}
        </Text>
      </View>

      <FieldGroup>
        <InfoRow label={t('updates.version')} value={updates.version} />
        {updates.build !== undefined && <InfoRow label={t('updates.build')} value={String(updates.build)} />}
        {updates.available && updates.channel ? <InfoRow label={t('updates.channel')} value={updates.channel} /> : null}
        {checkedAt !== null && <InfoRow label={t('updates.lastCheck')} value={formatDate(checkedAt)} />}
        {updates.available && state.phase !== 'downloaded' && (
          <ServiceRow icon="refresh" title={t('updates.check')} text={t('updates.checkText')} onPress={() => void updates.check()} />
        )}
        {state.phase === 'downloaded' && (
          <ServiceRow icon="refresh" title={t('updates.apply')} text={t('updates.applyText')} onPress={() => setConfirming(true)} />
        )}
      </FieldGroup>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
        {updates.busy && <Spinner size={16} />}
        <Text variant="caption" tone={state.phase === 'error' ? 'danger' : 'muted'} style={{ flex: 1 }}>
          {t(`updates.state.${stateKey(state)}`)}
        </Text>
      </View>
      {updates.notice !== null && (
        <Text variant="caption" tone="danger" accessibilityRole="alert">
          {updates.notice === 'blocked' ? t('updates.applyBlocked') : t('updates.applyError')}
        </Text>
      )}

      <ConfirmDialog
        visible={confirming}
        tone="neutral"
        icon="refresh"
        confirmIcon="refresh"
        title={t('updates.applyTitle')}
        cancelLabel={t('backup.cancel')}
        confirmLabel={t('updates.applyConfirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void updates.apply();
        }}>
        <Text variant="body">{t('updates.applyBody')}</Text>
      </ConfirmDialog>
    </View>
  );
}
