import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';

import { addTransaction } from './repository';
import { TransactionForm } from './transaction-form';

/**
 * Nouvelle opération. Le paramètre `?type=transfer` ouvre directement le virement vers l'épargne
 * (bouton « Mettre de côté » des Services), `?type=income` un revenu (menu + de la navigation) ;
 * sinon on commence par une dépense. Après l'enregistrement : retour à l'écran précédent et notification.
 */
export function AddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { type } = useLocalSearchParams<{ type?: string }>();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <TransactionForm
      type={type === 'transfer' || type === 'income' ? type : 'expense'}
      onClose={close}
      onSubmit={(values) => {
        addTransaction(values);
        close();
        toast.show({ message: t('add.saved') });
      }}
    />
  );
}
