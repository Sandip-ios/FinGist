import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '../lib/time';
import type { Story } from '../lib/types';
import { BRAND, categoryMeta, RELEVANCE, SENTIMENT, useTheme, type Theme } from '../theme';

interface Props {
  story: Story;
  index: number;
  total: number;
}

function NewsCardImpl({ story, index, total }: Props) {
  const t = useTheme();
  const cat = categoryMeta(story.category);
  const sentiment = story.sentiment ? SENTIMENT[story.sentiment] : null;
  const relevance = story.relevance ? RELEVANCE[story.relevance] : null;
  const s = styles(t);

  const openArticle = async () => {
    Haptics.selectionAsync().catch(() => {});
    await WebBrowser.openBrowserAsync(story.url, {
      controlsColor: BRAND.navy,
      toolbarColor: t.isDark ? '#0b1222' : '#ffffff',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    }).catch(() => {});
  };

  const share = () => {
    const text = story.summary ? `${story.title}\n\n${story.summary}` : story.title;
    Share.share({ message: `${text}\n\nRead more: ${story.url}\n\nvia FinGist` }).catch(() => {});
  };

  const regionLabel = story.region === 'india' ? '🇮🇳 India' : story.region === 'global' ? '🌐 Global' : '🇮🇳🌐 India & Global';

  return (
    <View style={s.page}>
      <View style={s.card}>
        <LinearGradient colors={cat.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
          <Ionicons name={cat.icon} size={110} color="rgba(255,255,255,0.08)" style={s.bannerBgIcon} />
          <View style={s.bannerTop}>
            <View style={s.catPill}>
              <Ionicons name={cat.icon} size={14} color="#fff" />
              <Text style={s.catText}>{cat.label}</Text>
            </View>
            <Text style={s.region}>{regionLabel}</Text>
          </View>
          <View style={s.bannerBottom}>
            <Text style={s.source} numberOfLines={1}>
              {story.kind === 'regulator' || story.kind === 'filing' ? '🏛 ' : ''}
              {story.source}
            </Text>
            <Text style={s.time}>{timeAgo(story.publishedAt)}</Text>
          </View>
        </LinearGradient>

        <View style={s.body}>
          <Text style={s.title} accessibilityRole="header">
            {story.title}
          </Text>

          {story.summaryStatus === 'ready' && story.summary ? (
            <Text style={s.summary}>{story.summary}</Text>
          ) : story.summaryStatus === 'pending' ? (
            <PendingSummary t={t} />
          ) : (
            <Text style={s.noSummary}>Summary not available for this story. Tap “Read more” for the full article.</Text>
          )}

          {story.companies.length > 0 && (
            <View style={s.chips}>
              {story.companies.map((c) => (
                <View key={c.name} style={s.chip}>
                  <Text style={s.chipText}>{c.symbol ? `${c.symbol}` : c.name}</Text>
                  {c.symbol && c.exchange ? <Text style={s.chipEx}>{c.exchange}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {(sentiment || relevance) && (
            <View style={s.badges}>
              {sentiment && (
                <View style={[s.badge, { borderColor: sentiment.color }]}>
                  <Ionicons name={sentiment.icon} size={14} color={sentiment.color} />
                  <Text style={[s.badgeText, { color: sentiment.color }]}>{sentiment.label}</Text>
                </View>
              )}
              {relevance && (
                <View style={[s.badge, { borderColor: t.border }]}>
                  <View style={s.dots}>
                    {[1, 2, 3].map((d) => (
                      <View key={d} style={[s.dot, { backgroundColor: d <= relevance.dots ? BRAND.lime : t.border }]} />
                    ))}
                  </View>
                  <Text style={[s.badgeText, { color: t.textMuted }]}>{relevance.label}</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Text style={s.disclaimer}>
            {story.summaryStatus === 'ready' && story.summary ? 'AI-generated summary · ' : ''}Not investment advice
          </Text>
        </View>

        <View style={s.footer}>
          <Pressable onPress={openArticle} style={({ pressed }) => [s.readMore, pressed && { opacity: 0.85 }]} accessibilityRole="link">
            <Text style={s.readMoreText} numberOfLines={1}>
              Read more at {story.source}
            </Text>
            <Ionicons name="open-outline" size={16} color="#fff" />
          </Pressable>
          <Pressable onPress={share} hitSlop={10} style={s.iconBtn} accessibilityLabel="Share story">
            <Ionicons name="share-social-outline" size={22} color={t.text} />
          </Pressable>
        </View>
      </View>
      <Text style={s.counter}>
        {index + 1} / {total}
      </Text>
    </View>
  );
}

function PendingSummary({ t }: { t: Theme }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ marginTop: 14 }}>
      {[100, 94, 97, 60].map((w, i) => (
        <Animated.View key={i} style={{ height: 14, width: `${w}%`, borderRadius: 7, backgroundColor: t.shimmer, marginBottom: 10, opacity: pulse }} />
      ))}
      <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>✨ Writing a quick summary…</Text>
    </View>
  );
}

export const NewsCard = memo(NewsCardImpl);

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
    card: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: t.isDark ? 0 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
      borderWidth: t.isDark ? 1 : 0,
      borderColor: t.border,
    },
    banner: { height: 150, padding: 16, justifyContent: 'space-between' },
    bannerBgIcon: { position: 'absolute', right: -14, bottom: -24 },
    bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    catText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
    region: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
    bannerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    source: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1, marginRight: 8 },
    time: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
    body: { flex: 1, paddingHorizontal: 18, paddingTop: 16 },
    title: { color: t.text, fontSize: 21, lineHeight: 28, fontWeight: '800', letterSpacing: -0.2 },
    summary: { color: t.text, fontSize: 16.5, lineHeight: 25, marginTop: 12, opacity: 0.92 },
    noSummary: { color: t.textMuted, fontSize: 15, lineHeight: 22, marginTop: 12, fontStyle: 'italic' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.chip, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    chipText: { color: t.chipText, fontWeight: '700', fontSize: 13 },
    chipEx: { color: t.textMuted, fontSize: 10, fontWeight: '600' },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeText: { fontSize: 12.5, fontWeight: '600' },
    dots: { flexDirection: 'row', gap: 3 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    disclaimer: { color: t.textMuted, fontSize: 11.5, marginBottom: 10 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
    readMore: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND.navy, paddingVertical: 13, borderRadius: 14 },
    readMoreText: { color: '#fff', fontWeight: '700', fontSize: 15, flexShrink: 1 },
    iconBtn: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.tabIdle },
    counter: { textAlign: 'center', color: t.textMuted, fontSize: 11, marginTop: 4 },
  });
