import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppScreen, Button, EmptyState, ScreenHeader, useToast } from '@/components/ui';
import { space } from '@/theme/layout';

import { getTransaction, updateTransaction } from './repository';
import { TransactionForm } from './transaction-form';

/** Modification d'une opération (design/screens/06-transaction-actions, « transaction-edit ») : le même formulaire, prérempli. */
export function EditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Lue une seule fois : le formulaire garde ses propres valeurs pendant la saisie.
  const [transaction] = useState(() => getTransaction(id));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (!transaction) {
    return (
      <AppScreen bottomInset>
        <ScreenHeader title={t('edit.title')} onBack={close} backLabel={t('edit.back')} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="transactions" title={t('detail.notFound')} />
          <Button label={t('add.close')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  return (
    <TransactionForm
      initial={{
        type: transaction.type,
        amountCents: transaction.amountCents,
        categoryId: transaction.categoryId,
        occurredOn: transaction.occurredOn,
        paymentMethod: transaction.paymentMethod,
        note: transaction.note ?? '',
      }}
      onClose={close}
      onSubmit={(values) => {
        if (!updateTransaction(transaction.id, values)) throw new Error('Opération introuvable');
        close();
        toast.show({ message: t('add.savedChanges') });
      }}
    />
  );
}
