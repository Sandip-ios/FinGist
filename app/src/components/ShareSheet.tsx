import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { config } from '../lib/config';
import type { Story } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { SHARE_SIZE, ShareCardImage, type ShareFormat } from './ShareCardImage';

/** Link to the story's FinGist page (rich preview + "Read full story" + "Get the app"). */
export const storyLink = (id: string) => `${config.apiUrl}/s/${id}`;

/** Share a story as a designed image (Story 9:16 or Post 4:5) with a QR code and link, or as a link. */
export function ShareSheet({ story, onClose }: { story: Story; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [format, setFormat] = useState<ShareFormat>('story');
  const [photoReady, setPhotoReady] = useState(!story.image);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const shot = useRef<HostInstance>(null);
  const link = storyLink(story.id);
  const text = `${story.title}\n\nRead more on FinGist: ${link}`;

  // Fit the preview into the sheet while the image itself keeps its full size.
  const size = SHARE_SIZE[format];
  const maxW = Math.min(W - 64, 300);
  const maxH = H * (format === 'story' ? 0.5 : 0.42);
  const scale = Math.min(maxW / size.w, maxH / size.h);

  const shareImage = async () => {
    if (!shot.current) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const uri = await captureRef(shot.current, { format: 'png', quality: 1, result: 'tmpfile' });
      if (Platform.OS === 'ios') {
        // iOS share sheet takes the image and the text with the link together.
        await Share.share({ url: uri, message: text });
      } else {
        // Android sends the image; the link is copied so it can be pasted with it.
        await Clipboard.setStringAsync(link);
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share story' });
      }
    } catch (e) {
      if (!String((e as Error).message).toLowerCase().includes('cancel')) Alert.alert('Could not share', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (ok) Linking.openURL(url).catch(() => {});
    else Share.share({ message: text }).catch(() => {});
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const more = () => Share.share({ message: text }).catch(() => {});

  const Action = ({ icon, label, onPress, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean }) => (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [s.action, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[s.actionIcon, { backgroundColor: primary ? BRAND.navy : t.tabIdle }]}>
        {primary && busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={22} color={primary ? '#fff' : icon === 'logo-whatsapp' ? '#25D366' : t.text} />}
      </View>
      <Text style={[s.actionText, { color: t.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={[s.grabber, { backgroundColor: t.border }]} />
        <View style={s.headerRow}>
          <Text style={[s.h1, { color: t.text }]}>Share story</Text>
          <View style={[s.segment, { backgroundColor: t.tabIdle }]}>
            {(['story', 'post'] as ShareFormat[]).map((f) => {
              const active = f === format;
              return (
                <Pressable key={f} onPress={() => setFormat(f)} style={[s.segItem, active && { backgroundColor: t.isDark ? BRAND.lime : BRAND.navy }]}>
                  <Text style={[s.segText, { color: active ? (t.isDark ? '#0b1222' : '#fff') : t.textMuted }]}>{f === 'story' ? 'Story 9:16' : 'Post 4:5'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <View style={{ width: size.w * scale, height: size.h * scale, borderRadius: 14, overflow: 'hidden', backgroundColor: BRAND.navy }}>
            <View style={{ width: size.w, height: size.h, transform: [{ scale }], transformOrigin: 'top left' }}>
              <ShareCardImage ref={shot} story={story} format={format} link={link} onPhotoReady={() => setPhotoReady(true)} />
            </View>
          </View>
          {!photoReady && <Text style={[s.hint, { color: t.textMuted }]}>Preparing photo…</Text>}
        </View>

        <View style={s.actions}>
          <Action icon="image" label="Share image" onPress={shareImage} primary />
          <Action icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} />
          <Action icon={copied ? 'checkmark' : 'link'} label={copied ? 'Copied!' : 'Copy link'} onPress={copyLink} />
          <Action icon="ellipsis-horizontal" label="More" onPress={more} />
        </View>
        {Platform.OS === 'android' && <Text style={[s.hint, { color: t.textMuted }]}>When sharing the image, the link is copied too: paste it as the message.</Text>}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,11,24,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: '800' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  segText: { fontSize: 12.5, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12.5, fontWeight: '600' },
});
