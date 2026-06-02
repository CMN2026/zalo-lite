import type { AppLanguage } from "../contexts/settings";

export function getMobileLocale(language: AppLanguage): string {
  return language === "en" ? "en-US" : "vi-VN";
}

export function formatLocaleDate(
  value: string | number | Date,
  language: AppLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(getMobileLocale(language), options);
}

export function formatLocaleTime(
  value: string | number | Date,
  language: AppLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(getMobileLocale(language), options);
}
