import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlerts } from '../lib/alerts';
import { config } from '../lib/config';
import type { RegionFilter } from '../lib/types';
import { BRAND, useTheme, type Theme } from '../theme';

const SOURCES = 'Economic Times, Mint, BusinessLine, CNBC-TV18, MarketWatch, Reserve Bank of India, SEBI, US Federal Reserve';

function storeUrl(): string {
  if (Platform.OS === 'ios' && config.iosAppStoreId) return `https://apps.apple.com/app/id${config.iosAppStoreId}`;
  if (Platform.OS === 'android') return `https://play.google.com/store/apps/details?id=${config.androidPackage}`;
  return config.websiteUrl;
}

/** Settings and info: alerts, share/rate/feedback, legal pages, about. */
export function MoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const st = styles(t);
  const insets = useSafeAreaInsets();
  const alerts = useAlerts();
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

  const Row = ({ icon, label, sub, onPress, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, pressed && onPress && { backgroundColor: t.tabIdle }]}>
      <View style={[st.rowIcon, { backgroundColor: t.chip }]}><Ionicons name={icon} size={17} color={accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowLabel}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.textMuted} /> : null)}
    </Pressable>
  );

  const regionOptions: { id: RegionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'india', label: '🇮🇳 India' },
    { id: 'global', label: '🌍 Global' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
              <Row
                icon="notifications"
                label="News alerts"
                right={<Switch value={alerts.prefs.enabled} disabled={alerts.busy} onValueChange={(v) => { void alerts.setEnabled(v); }} trackColor={{ true: BRAND.navy }} />}
              />
              {alerts.prefs.enabled && (
                <>
                  <View style={st.divider} />
                  <Row icon="sunny" label="Morning market mood" sub="Weekdays, about 8:45 am" right={<Switch value={alerts.prefs.morning} onValueChange={(v) => { void alerts.update({ morning: v }); }} trackColor={{ true: BRAND.navy }} />} />
                  <View style={st.divider} />
                  <Row icon="trending-up" label="Market open update" sub="Weekdays, about 9:30 am" right={<Switch value={alerts.prefs.marketOpen} onValueChange={(v) => { void alerts.update({ marketOpen: v }); }} trackColor={{ true: BRAND.navy }} />} />
                  <View style={st.divider} />
                  <Row icon="flash" label="Breaking news" sub="Important stories during the day" right={<Switch value={alerts.prefs.breaking} onValueChange={(v) => { void alerts.update({ breaking: v }); }} trackColor={{ true: BRAND.navy }} />} />
                  <View style={st.divider} />
                  <View style={st.row}>
                    <View style={[st.rowIcon, { backgroundColor: t.chip }]}><Ionicons name="earth" size={17} color={accent} /></View>
                    <Text style={[st.rowLabel, { flex: 1 }]}>Breaking news for</Text>
                    <View style={st.segment}>
                      {regionOptions.map((o) => {
                        const active = alerts.prefs.region === o.id;
                        return (
                          <Pressable key={o.id} onPress={() => alerts.update({ region: o.id })} style={[st.segItem, active && { backgroundColor: accent }]}>
                            <Text style={[st.segText, { color: active ? (t.isDark ? '#0b1222' : '#fff') : t.textMuted }]}>{o.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={st.divider} />
                  <Row
                    icon="moon"
                    label="Quiet hours (10 pm–7 am)"
                    right={<Switch value={alerts.prefs.quietHours} onValueChange={(v) => alerts.update({ quietHours: v })} trackColor={{ true: BRAND.navy }} />}
                  />
                </>
              )}
            </View>
            <Text style={st.note}>
              {alerts.error ?? 'At most 8 alerts a day in total. Turn off any type, or all alerts, at any time.'}
            </Text>
          </View>

          <View>
            <Text style={st.section}>FinGist</Text>
            <View style={st.group}>
              <Row icon="share-social" label="Share FinGist" onPress={shareApp} />
              <View style={st.divider} />
              <Row icon="star" label="Rate FinGist" onPress={rateApp} />
              <View style={st.divider} />
              <Row icon="chatbubble-ellipses" label="Send feedback" onPress={feedback} />
            </View>
          </View>

          <View>
            <Text style={st.section}>Legal</Text>
            <View style={st.group}>
              <Row icon="document-text" label="Terms & Conditions" onPress={() => openPage(config.termsUrl, 'Terms & Conditions')} />
              <View style={st.divider} />
              <Row icon="lock-closed" label="Privacy Policy" onPress={() => openPage(config.privacyUrl, 'Privacy Policy')} />
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
