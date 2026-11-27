import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { StyleSheet, Text, View, type HostInstance } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { Story } from '../lib/types';
import { BRAND, categoryMeta, SENTIMENT } from '../theme';

export type ShareFormat = 'story' | 'post';

/** Logical size of the shared image; it is captured at the phone's pixel density (about 1080 px wide). */
export const SHARE_SIZE: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 360, h: 640 }, // 9:16 – WhatsApp Status, Instagram Stories
  post: { w: 360, h: 450 }, // 4:5 – chats, X, LinkedIn
};

interface Props {
  story: Story;
  format: ShareFormat;
  link: string;
  onPhotoReady?: () => void;
}

/**
 * The image people share: the story as a FinGist card in a branded frame, with a QR code
 * and link to the story page. Always drawn in the light card style so it looks the same
 * in every chat app.
 */
export const ShareCardImage = forwardRef<HostInstance, Props>(function ShareCardImage({ story, format, link, onPhotoReady }, ref) {
  const { w, h } = SHARE_SIZE[format];
  const isStory = format === 'story';
  const cat = categoryMeta(story.category);
  const sentiment = story.sentiment ? SENTIMENT[story.sentiment] : null;
  const date = new Date(story.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const photoH = isStory ? 180 : 118;
  const shortLink = link.replace(/^https?:\/\//, '').replace(/(\/s\/[a-f0-9]{8})[a-f0-9]+$/, '$1…');

  return (
    <View ref={ref} collapsable={false} style={{ width: w, height: h, overflow: 'hidden' }}>
      <LinearGradient colors={['#0a2fb0', BRAND.navy, '#000c3d']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      <View style={[s.top, !isStory && { paddingTop: 12, paddingBottom: 8 }]}>
        <Text style={[s.word, !isStory && { fontSize: 22 }]}>
          Fin<Text style={{ color: BRAND.lime }}>Gist</Text>
        </Text>
        <Text style={s.tagline}>Market news in 60 words</Text>
      </View>

      <View style={[s.card, { flex: 1 }]}>
        <View style={{ height: photoH }}>
          {story.image ? (
            <Image source={{ uri: story.image.url }} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={onPhotoReady} onError={onPhotoReady} />
          ) : (
            <LinearGradient colors={cat.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name={cat.icon} size={56} color="rgba(255,255,255,0.35)" />
            </LinearGradient>
          )}
          <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          <View style={s.photoTop}>
            <View style={s.glass}><Ionicons name={cat.icon} size={11} color="#fff" /><Text style={s.glassText}>{cat.label}</Text></View>
          </View>
          <View style={s.photoBottom}>
            <Text style={s.source} numberOfLines={1}>{story.source}</Text>
            <Text style={s.date}>{date}</Text>
          </View>
        </View>

        <View style={s.body}>
          <Text style={[s.title, !isStory && { fontSize: 16, lineHeight: 21 }]} numberOfLines={isStory ? 4 : 3}>{story.title}</Text>
          {story.summary ? (
            <Text style={[s.summary, !isStory && { fontSize: 12.5, lineHeight: 18 }]} numberOfLines={isStory ? 8 : 4}>{story.summary}</Text>
          ) : null}
          <View style={s.pills}>
            {sentiment && (
              <View style={[s.pill, { backgroundColor: sentiment.bg }]}>
                <Ionicons name={sentiment.icon} size={11} color={sentiment.color} />
                <Text style={[s.pillText, { color: sentiment.color }]}>{sentiment.label}</Text>
              </View>
            )}
            {story.companies.slice(0, isStory ? 3 : 2).map((c) => (
              <View key={c.name} style={[s.pill, { backgroundColor: '#eef2ff' }]}>
                <Text style={[s.pillText, { color: '#1e3a8a' }]} numberOfLines={1}>{c.symbol ?? c.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[s.footer, !isStory && { paddingVertical: 10 }]}>
        <View style={s.qr}>
          <QRCode value={link} size={isStory ? 64 : 52} color={BRAND.navy} backgroundColor="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cta}>Read the full story</Text>
          <Text style={s.link} numberOfLines={1}>{shortLink}</Text>
          <Text style={s.small} numberOfLines={2}>
            Summary by FinGist · Source: {story.source} · Not investment advice{story.image ? ` · Photo: ${story.image.photographer} / ${story.image.providerName}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  top: { alignItems: 'center', paddingTop: 22, paddingBottom: 12 },
  word: { color: '#fff', fontSize: 30, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.8 },
  tagline: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
  card: { marginHorizontal: 14, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  photoTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row' },
  glass: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,23,42,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  glassText: { color: '#fff', fontWeight: '700', fontSize: 10.5 },
  photoBottom: { position: 'absolute', left: 12, right: 12, bottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  source: { color: '#fff', fontWeight: '800', fontSize: 12.5, flexShrink: 1 },
  date: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  body: { padding: 14, paddingBottom: 12, flex: 1 },
  title: { color: '#0b1530', fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.2 },
  summary: { color: '#334155', fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, maxWidth: 140 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  qr: { backgroundColor: '#fff', padding: 5, borderRadius: 8 },
  cta: { color: '#fff', fontWeight: '800', fontSize: 14 },
  link: { color: BRAND.lime, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  small: { color: 'rgba(255,255,255,0.55)', fontSize: 8.5, marginTop: 4, lineHeight: 11 },
});
