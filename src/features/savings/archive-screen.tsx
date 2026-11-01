import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppScreen, Divider, EmptyState, ScreenHeader, Surface, useToast } from '@/components/ui';
import { space } from '@/theme/layout';

import { GoalRowView } from './goal-row';
import { restoreGoal } from './repository';
import { useArchivedGoals, type GoalRow } from './use-savings';

/**
 * Objectifs archivés : consultables (historique intact, en lecture seule) et restaurables. Un objectif restauré revient à la fin de la
 * liste active. Rien n'est supprimé définitivement ici.
 */
export function ArchiveScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { goals, loaded } = useArchivedGoals();

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/savings');
  }, [router]);

  const open = useCallback((goal: GoalRow) => router.push({ pathname: '/savings/[id]', params: { id: goal.id } }), [router]);
  const restore = useMemo(
    () => ({
      kind: 'restore' as const,
      onPress: (goal: GoalRow) => {
        try {
          restoreGoal(goal.id);
          toast.show({ message: t('savings.detail.restored', { name: goal.name }) });
        } catch {
          toast.show({ message: t('savings.detail.actionFailed') });
        }
      },
    }),
    [toast, t],
  );

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('savings.archive.title')} onBack={close} backLabel={t('savings.backToSavings')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24, gap: 20, flexGrow: 1 }}>
        {loaded && goals.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="savings" title={t('savings.archive.empty')} />
          </View>
        ) : null}
        {goals.length > 0 ? (
          <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
            {goals.map((goal, index) => (
              <View key={goal.id}>
                {index > 0 && <Divider inset={space.fieldDividerInset} />}
                <GoalRowView goal={goal} onOpen={open} action={restore} />
              </View>
            ))}
          </Surface>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
