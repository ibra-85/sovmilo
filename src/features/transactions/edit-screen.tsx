import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { useUndo } from '@/features/undo/undo-provider';

import { getTransaction, restoreTransaction, softDeleteTransaction, updateTransaction } from './repository';
import { TransactionForm } from './transaction-form';

/** Modification d'une opération, et suppression avec confirmation puis bouton « Annuler » pendant quelques secondes. */
export function EditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const showUndo = useUndo();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Lue une seule fois : le formulaire garde ses propres valeurs pendant la saisie.
  const [transaction] = useState(() => getTransaction(id));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (!transaction) {
    return (
      <Screen bottomInset>
        <View className="flex-1 items-center justify-center gap-6 p-6">
          <Text className="text-center text-xl font-semibold text-ink">{t('edit.notFound')}</Text>
          <BigButton label={t('add.close')} onPress={close} />
        </View>
      </Screen>
    );
  }

  function confirmDelete() {
    Alert.alert(t('edit.deleteTitle'), t('edit.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          softDeleteTransaction(transaction!.id);
          close();
          showUndo({
            message: t('edit.deleted'),
            actionLabel: t('edit.undo'),
            onAction: () => restoreTransaction(transaction!.id),
          });
        },
      },
    ]);
  }

  return (
    <TransactionForm
      title={t('edit.title')}
      initial={{
        type: transaction.type,
        amountCents: transaction.amountCents,
        categoryId: transaction.categoryId,
        occurredOn: transaction.occurredOn,
        paymentMethod: transaction.paymentMethod,
        note: transaction.note ?? '',
      }}
      onClose={close}
      onDelete={confirmDelete}
      onSubmit={(values) => {
        if (!updateTransaction(transaction.id, values)) throw new Error('Opération introuvable');
        close();
      }}
    />
  );
}
