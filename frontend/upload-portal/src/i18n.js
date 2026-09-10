import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import kn from "./locales/kn.json";
import hi from "./locales/hi.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import mr from "./locales/mr.json";
import bn from "./locales/bn.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeName: "English", bcp47: "en-IN" },
  { code: "kn", label: "Kannada", nativeName: "ಕನ್ನಡ", bcp47: "kn-IN" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी", bcp47: "hi-IN" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்", bcp47: "ta-IN" },
  { code: "te", label: "Telugu", nativeName: "తెలుగు", bcp47: "te-IN" },
  { code: "mr", label: "Marathi", nativeName: "मराठी", bcp47: "mr-IN" },
  { code: "bn", label: "Bengali", nativeName: "বাংলা", bcp47: "bn-IN" },
];

const savedLang =
  typeof window !== "undefined"
    ? localStorage.getItem("vasudha_language") || "en"
    : "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      kn: { translation: kn },
      hi: { translation: hi },
      ta: { translation: ta },
      te: { translation: te },
      mr: { translation: mr },
      bn: { translation: bn },
    },
    lng: savedLang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values safely
    },
    react: {
      useSuspense: false,
    },
  });

export const changeLanguage = (langCode) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("vasudha_language", langCode);
  }
  return i18n.changeLanguage(langCode);
};

export default i18n;
