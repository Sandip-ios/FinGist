import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, useTheme } from '../theme';

const SOURCES = 'Economic Times, Mint, BusinessLine, CNBC-TV18, MarketWatch, Reserve Bank of India, SEBI, US Federal Reserve';

export function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const Section = ({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: string }) => (
    <View style={[s.section, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={s.sectionHead}>
        <Ionicons name={icon} size={18} color={t.isDark ? BRAND.lime : BRAND.navy} />
        <Text style={[s.sectionTitle, { color: t.text }]}>{title}</Text>
      </View>
      <Text style={[s.sectionText, { color: t.textMuted }]}>{children}</Text>
    </View>
  );
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: t.bg, paddingBottom: insets.bottom }]}>
        <View style={s.header}>
          <Text style={[s.h1, { color: t.text }]}>About FinGist</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close-circle" size={30} color={t.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Section icon="flash" title="Market news in 60 words">
            FinGist brings Indian and global market news as short cards. Each card shows the original headline first, then a short summary in simple English. Tap “Read more” to open the full article on the publisher's site.
          </Section>
          <Section icon="sparkles" title="AI-generated summaries">
            Summaries, categories, sentiment and relevance labels are generated automatically by AI from the publisher's headline and description. They can contain mistakes. Always check the original article before acting on any information.
          </Section>
          <Section icon="shield-checkmark" title="Not investment advice">
            FinGist is a news service only. Nothing in this app is a recommendation to buy, sell or hold any security. Sentiment and relevance labels describe the news, not the stock. Consult a SEBI-registered adviser before investing.
          </Section>
          <Section icon="newspaper" title="Sources">
            {`News belongs to its publishers. FinGist shows only headlines, short summaries and links to the original articles. Current sources: ${SOURCES}.`}
          </Section>
          <Text style={[s.version, { color: t.textMuted }]}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  h1: { fontSize: 24, fontWeight: '800' },
  section: { borderRadius: 16, padding: 14, borderWidth: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionText: { fontSize: 14.5, lineHeight: 21 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});
