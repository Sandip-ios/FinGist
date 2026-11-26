import Constants from 'expo-constants';

interface Extra {
  apiUrl?: string;
  websiteUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  supportEmail?: string;
  iosAppStoreId?: string;
  eas?: { projectId?: string };
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** App settings from app.json → expo.extra (edit there, not here). */
export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'https://fingist-api.fingist-sandip.workers.dev',
  websiteUrl: extra.websiteUrl ?? '',
  privacyUrl: extra.privacyUrl ?? '',
  termsUrl: extra.termsUrl ?? '',
  supportEmail: extra.supportEmail ?? '',
  iosAppStoreId: extra.iosAppStoreId ?? '',
  androidPackage: Constants.expoConfig?.android?.package ?? 'com.sandippatel.fingist',
  projectId: extra.eas?.projectId ?? (Constants.easConfig as { projectId?: string } | undefined)?.projectId,
  version: Constants.expoConfig?.version ?? '1.0.0',
};
