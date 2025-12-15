import { useTranslation as useI18nTranslation } from 'react-i18next';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = (lng: 'en' | 'cz') => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language as 'en' | 'cz';

  return {
    t,
    changeLanguage,
    currentLanguage,
    i18n,
  };
};

