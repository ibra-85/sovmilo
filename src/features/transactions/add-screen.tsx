import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { addTransaction } from './repository';
import { TransactionForm } from './transaction-form';

/**
 * Nouvelle opération. Le paramètre `?type=transfer` ouvre directement le virement vers l'épargne
 * (bouton « Mettre de côté » de l'accueil), `?type=income` un revenu (menu + de la navigation) ;
 * sinon on commence par une dépense.
 */
export function AddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <TransactionForm
      title={t('add.title')}
      initialType={type === 'transfer' || type === 'income' ? type : 'expense'}
      onClose={close}
      onSubmit={(values) => {
        addTransaction(values);
        close();
      }}
    />
  );
}
