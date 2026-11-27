import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAlerts } from '../lib/alerts';
import { clearAppCache } from '../lib/cache';
import { config } from '../lib/config';
import type { RegionFilter } from '../lib/types';
import { BRAND, useTheme, useThemeMode, type Theme, type ThemeMode } from '../theme';

/** Plain-language explanation of a failed test alert, with what to do. */
function testAlertHelp(error?: string, message?: string): string {
  switch (error) {
    case 'InvalidCredentials':
      return 'Apple has not got this app\'s push key yet. On your Mac, in the app folder, run:\n\nnpx eas-cli@latest credentials -p ios\n\nChoose production → Push Notifications → set up a new key. Then tap Send test alert again.';
    case 'DeviceNotRegistered':
      return 'This phone\'s alert registration has expired. Turn News alerts off and on, then try again.';
    case 'NotRegistered':
      return 'The server does not know this phone yet. Make sure the latest server is deployed (npm run deploy in backend), then try again.';
    case 'OldServer':
      return 'The server needs the latest update. In the backend folder run: npm run deploy';
    case 'TooSoon':
      return 'Please wait a minute before sending another test.';
    case 'Phone':
      return message ?? 'Notifications are not allowed for FinGist. Allow them in iPhone Settings → FinGist → Notifications.';
    default:
      return `${error ?? 'Unknown error'}${message ? `: ${message}` : ''}`;
  }
}

const MORNING_SUB: Record<RegionFilter, string> = {
  india: 'Weekdays about 8:45 am, before NSE/BSE open',
  global: 'Weekdays about 8:45 am, world markets overnight',
  all: 'Weekdays about 8:45 am, India and world markets',
};

const MARKET_OPEN_SUB: Record<RegionFilter, string> = {
  india: 'Weekdays about 9:30 am, after NSE/BSE open',
  global: 'Wall Street, ~20 min after the US open (8–9 pm IST)',
  all: 'India 9:30 am · Wall Street 8–9 pm IST',
};

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  t: Theme;
  st: ReturnType<typeof styles>;
  accent: string;
}

/** One settings row. Defined outside the screen so rows and their switches are not rebuilt on every tap. */
function SettingRow({ icon, label, sub, onPress, right, t, st, accent }: RowProps) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, pressed && onPress && { backgroundColor: t.tabIdle }]}>
      <View style={[st.rowIcon, { backgroundColor: t.chip }]}><Ionicons name={icon} size={17} color={accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowLabel}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.textMuted} /> : null)}
    </Pressable>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  // Lime in Night mode: navy would be hard to see on the dark background.
  return <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: t.isDark ? '#5fa80f' : BRAND.navy }} />;
}

const SOURCES = 'Economic Times, Mint, BusinessLine, CNBC-TV18, MarketWatch, Reserve Bank of India, SEBI, US Federal Reserve';

function storeUrl(): string {
  if (Platform.OS === 'ios' && config.iosAppStoreId) return `https://apps.apple.com/app/id${config.iosAppStoreId}`;
  if (Platform.OS === 'android') return `https://play.google.com/store/apps/details?id=${config.androidPackage}`;
  return config.websiteUrl;
}

/** Settings and info: alerts, share/rate/feedback, legal pages, about. */
export function MoreSheet({ visible, onClose, onShowTour, onDismiss }: { visible: boolean; onClose: () => void; onShowTour: () => void; onDismiss?: () => void }) {
  const t = useTheme();
  const st = styles(t);
  const insets = useSafeAreaInsets();
  const alerts = useAlerts();
  const queryClient = useQueryClient();
  const { mode, setMode } = useThemeMode();
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    const r = await alerts.test();
    setTesting(false);
    if (r.ok) Alert.alert('Test alert sent', 'You should see "FinGist alerts are working" within a few seconds. If nothing arrives, check iPhone Settings → FinGist → Notifications, and Focus / Do Not Disturb.');
    else Alert.alert('Alert could not be delivered', testAlertHelp(r.error, r.message));
  };

  const clearCache = () => {
    Alert.alert('Clear cache?', 'Removes downloaded photos and saved news, then loads fresh news. Your bookmarks and settings are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          await clearAppCache(queryClient);
          setClearing(false);
          Alert.alert('Cache cleared', 'Fresh news is loading.');
        },
      },
    ]);
  };
  const accent = t.isDark ? BRAND.lime : BRAND.navy;

  const shareApp = () => {
    const link = config.websiteUrl || storeUrl();
    Share.share({ message: `FinGist: Indian and global market news in 60 words, with AI summaries.\n\nGet the app: ${link}` }).catch(() => {});
  };

  const rateApp = async () => {
    try {
      if (await StoreReview.hasAction()) { await StoreReview.requestReview(); return; }
    } catch { /* fall through to the store page */ }
    const url = Platform.OS === 'ios' && config.iosAppStoreId
      ? `https://apps.apple.com/app/id${config.iosAppStoreId}?action=write-review`
      : Platform.OS === 'android' ? `https://play.google.com/store/apps/details?id=${config.androidPackage}` : '';
    if (url) Linking.openURL(url).catch(() => {});
    else Alert.alert('Rate FinGist', 'Rating will be available once FinGist is live in the App Store.');
  };

  const feedback = () => {
    if (!config.supportEmail) { Alert.alert('Feedback', 'Feedback email is not set up yet.'); return; }
    const subject = encodeURIComponent('FinGist feedback');
    const body = encodeURIComponent(`\n\n---\nApp version: ${config.version}\nPlatform: ${Platform.OS} ${String(Platform.Version)}`);
    Linking.openURL(`mailto:${config.supportEmail}?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert('Feedback', `Please email us at ${config.supportEmail}`),
    );
  };

  const openPage = (url: string, name: string) => {
    if (!url) { Alert.alert(name, 'This page is not available yet.'); return; }
    WebBrowser.openBrowserAsync(url, { controlsColor: BRAND.navy }).catch(() => {});
  };

  const rt = { t, st, accent };

  const regionOptions: { id: RegionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'india', label: '🇮🇳 India' },
    { id: 'global', label: '🌍 Global' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={[st.container, { paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <Text style={st.h1}>More</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close-circle" size={30} color={t.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
          <View>
            <Text style={st.section}>News alerts</Text>
            <View style={st.group}>
              <SettingRow
                {...rt}
                icon="notifications"
                label="News alerts"
                right={<Toggle value={alerts.prefs.enabled} disabled={alerts.busy} onChange={(v) => { void alerts.setEnabled(v); }} />}
              />
              {alerts.prefs.enabled && (
                <>
                  <View style={st.divider} />
                  <View style={st.row}>
                    <View style={[st.rowIcon, { backgroundColor: t.chip }]}><Ionicons name="earth" size={17} color={accent} /></View>
                    <Text style={[st.rowLabel, { flex: 1 }]}>Alerts for</Text>
                    <View style={st.segment}>
                      {regionOptions.map((o) => {
                        const active = alerts.prefs.region === o.id;
                        return (
                          <Pressable key={o.id} onPress={() => { void alerts.update({ region: o.id }); }} style={[st.segItem, active && { backgroundColor: accent }]}>
                            <Text style={[st.segText, { color: active ? (t.isDark ? '#0b1222' : '#fff') : t.textMuted }]}>{o.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={st.divider} />
                  <SettingRow {...rt} icon="sunny" label="Morning market mood" sub={MORNING_SUB[alerts.prefs.region]} right={<Toggle value={alerts.prefs.morning} onChange={(v) => { void alerts.update({ morning: v }); }} />} />
                  <View style={st.divider} />
                  <SettingRow {...rt} icon="trending-up" label="Market open" sub={MARKET_OPEN_SUB[alerts.prefs.region]} right={<Toggle value={alerts.prefs.marketOpen} onChange={(v) => { void alerts.update({ marketOpen: v }); }} />} />
                  <View style={st.divider} />
                  <SettingRow {...rt} icon="flash" label="Breaking news" sub="Important stories during the day" right={<Toggle value={alerts.prefs.breaking} onChange={(v) => { void alerts.update({ breaking: v }); }} />} />
                  <View style={st.divider} />
                  <SettingRow {...rt} icon="moon" label="Quiet hours" sub="No alerts from 10 pm to 7 am" right={<Toggle value={alerts.prefs.quietHours} onChange={(v) => { void alerts.update({ quietHours: v }); }} />} />
                  <View style={st.divider} />
                  <SettingRow {...rt} icon="paper-plane" label={testing ? 'Sending test alert…' : 'Send test alert'} sub="Check that alerts reach this phone" onPress={testing ? undefined : sendTest} />
                </>
              )}
            </View>
            <Text style={st.note}>
              {alerts.error ?? 'All alerts follow your All / India / Global choice. At most 8 a day; turn off any type at any time.'}
            </Text>
          </View>

          <View>
            <Text style={st.section}>Appearance</Text>
            <View style={st.group}>
              <View style={st.row}>
                <View style={[st.rowIcon, { backgroundColor: t.chip }]}><Ionicons name={t.isDark ? 'moon' : 'sunny'} size={17} color={accent} /></View>
                <Text style={[st.rowLabel, { flex: 1 }]}>Theme</Text>
                <View style={st.segment}>
                  {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => {
                    const active = mode === m;
                    return (
                      <Pressable key={m} onPress={() => setMode(m)} style={[st.segItem, active && { backgroundColor: accent }]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                        <Text style={[st.segText, { color: active ? (t.isDark ? '#0b1222' : '#fff') : t.textMuted }]}>{m === 'system' ? 'Auto' : m === 'light' ? 'Light' : 'Night'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <Text style={st.note}>Auto follows your phone's Light or Dark setting.</Text>
          </View>

          <View>
            <Text style={st.section}>Storage</Text>
            <View style={st.group}>
              <SettingRow {...rt} icon="trash" label={clearing ? 'Clearing…' : 'Clear cache'} sub="Photos and saved news. Bookmarks and settings are kept." onPress={clearing ? undefined : clearCache} />
            </View>
            <Text style={st.note}>Photos are also cleaned up automatically every week.</Text>
          </View>

          <View>
            <Text style={st.section}>FinGist</Text>
            <View style={st.group}>
              <SettingRow {...rt} icon="map" label="Show app tour" onPress={onShowTour} />
              <View style={st.divider} />
              <SettingRow {...rt} icon="share-social" label="Share FinGist" onPress={shareApp} />
              <View style={st.divider} />
              <SettingRow {...rt} icon="star" label="Rate FinGist" onPress={rateApp} />
              <View style={st.divider} />
              <SettingRow {...rt} icon="chatbubble-ellipses" label="Send feedback" onPress={feedback} />
            </View>
          </View>

          <View>
            <Text style={st.section}>Legal</Text>
            <View style={st.group}>
              <SettingRow {...rt} icon="document-text" label="Terms & Conditions" onPress={() => openPage(config.termsUrl, 'Terms & Conditions')} />
              <View style={st.divider} />
              <SettingRow {...rt} icon="lock-closed" label="Privacy Policy" onPress={() => openPage(config.privacyUrl, 'Privacy Policy')} />
            </View>
          </View>

          <View>
            <Text style={st.section}>About</Text>
            <View style={[st.group, { padding: 14, gap: 10 }]}>
              <Text style={st.about}><Text style={st.aboutBold}>AI-generated summaries. </Text>Summaries and labels are written automatically from the publisher's headline and description and can contain mistakes. Check the original article before acting on any information.</Text>
              <Text style={st.about}><Text style={st.aboutBold}>Not investment advice. </Text>FinGist is a news service. Nothing in the app is a recommendation to buy, sell or hold any security. Consult a SEBI-registered adviser before investing.</Text>
              <Text style={st.about}><Text style={st.aboutBold}>Sources. </Text>{`News belongs to its publishers; FinGist shows headlines, short summaries and links. Sources: ${SOURCES}.`}</Text>
              <Text style={st.about}><Text style={st.aboutBold}>Photos. </Text>Representative images from Unsplash and Pexels under their free licences; not photos of the actual events.</Text>
            </View>
          </View>
          <Text style={st.version}>FinGist {config.version}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
    h1: { fontSize: 26, fontWeight: '800', color: t.text },
    section: { fontSize: 12.5, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
    group: { backgroundColor: t.card, borderRadius: 16, borderWidth: t.isDark ? 1 : 0, borderColor: t.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 15.5, fontWeight: '600', color: t.text },
    rowSub: { fontSize: 12.5, color: t.textMuted, marginTop: 1 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 58 },
    note: { color: t.textMuted, fontSize: 12.5, marginTop: 8, marginLeft: 4 },
    segment: { flexDirection: 'row', backgroundColor: t.tabIdle, borderRadius: 10, padding: 2 },
    segItem: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
    segText: { fontSize: 12, fontWeight: '700' },
    about: { color: t.textBody, fontSize: 14, lineHeight: 20 },
    aboutBold: { fontWeight: '800', color: t.text },
    version: { textAlign: 'center', color: t.textMuted, fontSize: 12 },
  });
