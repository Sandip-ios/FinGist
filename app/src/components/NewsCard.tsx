import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { memo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { useBookmarks } from '../lib/bookmarks';
import { useOpenSearch } from '../lib/openSearch';
import { useTour } from '../lib/tour';
import { timeAgo } from '../lib/time';
import { ShareSheet } from './ShareSheet';
import type { Story } from '../lib/types';
import { BRAND, categoryMeta, RELEVANCE, SENTIMENT, sourceColor, useTheme, type Theme } from '../theme';

interface Props {
  story: Story;
  /** Category label on the photo; only needed in "Top stories" (category tabs already show it). */
  showCategory?: boolean;
  /** The first card of Top stories is used by the first-launch tour. */
  tourAnchor?: boolean;
}

function NewsCardImpl({ story, showCategory = true, tourAnchor = false }: Props) {
  const tour = useTour();
  const anchor = (id: 'card' | 'readMore' | 'actions') => (tourAnchor ? (r: HostInstance | null) => tour.register(id, r) : undefined);
  const t = useTheme();
  const s = styles(t);
  const bookmarks = useBookmarks();
  const openSearch = useOpenSearch();
  const saved = bookmarks.isSaved(story.id);
  const cat = categoryMeta(story.category);
  const sentiment = story.sentiment ? SENTIMENT[story.sentiment] : null;
  const relevance = story.relevance ? RELEVANCE[story.relevance] : null;
  const { height: screenH } = useWindowDimensions();
  // Photo scales with the screen so the text still fits on small phones.
  const photoH = Math.round(Math.min(250, Math.max(150, screenH * 0.27)));
  const bookmarkScale = useRef(new Animated.Value(1)).current;

  const openArticle = async () => {
    Haptics.selectionAsync().catch(() => {});
    await WebBrowser.openBrowserAsync(story.url, {
      controlsColor: BRAND.navy,
      toolbarColor: t.isDark ? '#0b1222' : '#ffffff',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    }).catch(() => {});
  };

  const [shareOpen, setShareOpen] = useState(false);
  const share = () => {
    Haptics.selectionAsync().catch(() => {});
    setShareOpen(true);
  };


  const toggleBookmark = () => {
    Animated.sequence([
      Animated.spring(bookmarkScale, { toValue: 1.25, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    bookmarks.toggle(story);
  };

  const regionLabel = story.region === 'india' ? '🇮🇳 India' : story.region === 'global' ? '🌐 Global' : '🇮🇳 India · 🌐 Global';
  const official = story.kind === 'regulator' || story.kind === 'filing';

  return (
    <View style={[s.page, { backgroundColor: t.bg }]}>
      <View style={s.card} ref={anchor('card')} collapsable={false}>
        {/* Photo (or category colours) with labels on top */}
        <View style={[s.banner, { height: story.image ? photoH : 140 }]}>
          {story.image ? (
            <>
              <Image
                source={{ uri: story.image.url }}
                style={[StyleSheet.absoluteFill, { backgroundColor: story.image.color ?? cat.colors[1] }]}
                contentFit="cover"
                transition={250}
                cachePolicy="memory-disk"
                accessible={false}
              />
              <LinearGradient colors={['rgba(0,0,0,0.30)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.70)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
            </>
          ) : (
            <LinearGradient colors={cat.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
              <Ionicons name={cat.icon} size={110} color="rgba(255,255,255,0.08)" style={s.bannerBgIcon} />
            </LinearGradient>
          )}
          <View style={s.bannerTop}>
            {showCategory ? (
              <View style={s.glass}>
                <Ionicons name={cat.icon} size={13} color="#fff" />
                <Text style={s.glassText}>{cat.label}</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={s.glass}>
              <Text style={s.glassText}>{regionLabel}</Text>
            </View>
          </View>
          <View style={s.bannerBottom}>
            <View style={[s.avatar, { backgroundColor: sourceColor(story.source) }]}>
              {official ? <Ionicons name="business" size={12} color="#fff" /> : <Text style={s.avatarText}>{story.source.charAt(0)}</Text>}
            </View>
            <Text style={s.source} numberOfLines={1}>{story.source}</Text>
            <Text style={s.dot}>•</Text>
            <Text style={s.time}>{timeAgo(story.publishedAt)}</Text>
          </View>
        </View>

        {/* Headline, summary and labels */}
        <View style={s.body}>
          <Text style={s.title} accessibilityRole="header" numberOfLines={5}>{story.title}</Text>
          {story.summary ? (
            <Text style={s.summary}>{story.summary}</Text>
          ) : (
            <Text style={s.noSummary}>Summary not available for this story. Tap “Read full story” for the article.</Text>
          )}
          <View style={s.pills}>
            {sentiment && (
              <View style={[s.pill, { backgroundColor: t.isDark ? sentiment.bgDark : sentiment.bg }]}>
                <Ionicons name={sentiment.icon} size={13} color={sentiment.color} />
                <Text style={[s.pillText, { color: t.isDark ? '#e2e8f0' : sentiment.color }]}>{sentiment.label}</Text>
              </View>
            )}
            {relevance && (
              <View style={[s.pill, { backgroundColor: t.tabIdle }]}>
                <View style={s.dots}>
                  {[1, 2, 3].map((d) => (
                    <View key={d} style={[s.dotBar, { height: 4 + d * 3, backgroundColor: d <= relevance.dots ? (t.isDark ? BRAND.lime : BRAND.navy) : t.border }]} />
                  ))}
                </View>
                <Text style={[s.pillText, { color: t.textMuted }]}>{relevance.label}</Text>
              </View>
            )}
            {story.companies.map((c) => (
              <Pressable
                key={c.name}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); openSearch(c.name); }}
                style={({ pressed }) => [s.pill, s.ticker, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`More news about ${c.name}`}
              >
                <Text style={s.tickerText} numberOfLines={1}>{c.symbol ?? c.name}</Text>
                {c.symbol && c.exchange ? <Text style={s.tickerEx}>{c.exchange}</Text> : null}
                <Ionicons name="chevron-forward" size={12} color={t.chipText} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={s.footer}>
          <Pressable ref={anchor('readMore')} onPress={openArticle} style={({ pressed }) => [s.readMore, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]} accessibilityRole="link" accessibilityLabel={`Read full story at ${story.source}`}>
            <Text style={s.readMoreText} numberOfLines={1}>Read full story</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
          <View ref={anchor('actions')} collapsable={false} style={s.actions}>
          <Pressable onPress={toggleBookmark} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark story'}>
            <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? (t.isDark ? BRAND.lime : BRAND.navy) : t.text} />
            </Animated.View>
          </Pressable>
          <Pressable onPress={share} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]} accessibilityLabel="Share story">
            <Ionicons name="share-social-outline" size={21} color={t.text} />
          </Pressable>
          </View>
        </View>
      </View>

      {shareOpen && <ShareSheet story={story} onClose={() => setShareOpen(false)} />}
      <View style={s.below}>
        <Text style={s.belowText} numberOfLines={1}>AI-generated summary · Not investment advice</Text>
        {story.image && (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(story.image!.photographerUrl).catch(() => {})} hitSlop={6} accessibilityRole="link">
            <Text style={s.belowText} numberOfLines={1}>Representative image · Photo: {story.image.photographer} / {story.image.providerName}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const NewsCard = memo(NewsCardImpl);

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
    card: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 26,
      overflow: 'hidden',
      shadowColor: '#0b1530',
      shadowOpacity: t.isDark ? 0 : 0.07,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
      borderWidth: t.isDark ? 1 : 0,
      borderColor: t.border,
    },
    banner: { padding: 14, justifyContent: 'space-between', overflow: 'hidden' },
    bannerBgIcon: { position: 'absolute', right: -14, bottom: -24 },
    bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    glass: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(15,23,42,0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
    glassText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    bannerBottom: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 11 },
    source: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
    dot: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    time: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },
    body: { flex: 1, paddingHorizontal: 18, paddingTop: 14, overflow: 'hidden' },
    title: { color: t.text, fontSize: 20.5, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
    summary: { color: t.textBody, fontSize: 16, lineHeight: 25, marginTop: 10, letterSpacing: 0.05 },
    noSummary: { color: t.textMuted, fontSize: 15, lineHeight: 22, marginTop: 10, fontStyle: 'italic' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, maxWidth: '70%' },
    pillText: { fontSize: 12.5, fontWeight: '700' },
    dots: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    dotBar: { width: 3, borderRadius: 1.5 },
    ticker: { backgroundColor: t.chip },
    tickerText: { color: t.chipText, fontWeight: '800', fontSize: 12.5, flexShrink: 1 },
    tickerEx: { color: t.textMuted, fontSize: 10, fontWeight: '700' },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14 },
    readMore: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND.navy, borderRadius: 25 },
    readMoreText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
    actions: { flexDirection: 'row', gap: 10 },
    iconBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: t.tabIdle },
    below: { alignItems: 'center', paddingTop: 5, gap: 1 },
    belowText: { color: t.textMuted, fontSize: 10.5, textAlign: 'center' },
  });
