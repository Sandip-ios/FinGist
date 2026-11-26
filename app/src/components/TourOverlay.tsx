import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { TOUR_STEPS, useTour } from '../lib/tour';
import { BRAND, useTheme } from '../theme';

interface Rect { x: number; y: number; w: number; h: number }

/**
 * First-launch tour: everything is blurred and dimmed except the highlighted part,
 * with a short explanation next to it.
 */
export function TourOverlay() {
  const t = useTheme();
  const tour = useTour();
  const { width: W, height: H } = useWindowDimensions();
  const [rect, setRect] = useState<Rect | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const step = TOUR_STEPS[tour.step];

  // Find where the current target is on screen; skip steps whose target isn't visible.
  useEffect(() => {
    if (!tour.active || !step) return;
    setRect(null);
    fade.setValue(0);
    const node = tour.target(step.target);
    if (!node) { tour.next(); return; }
    const id = setTimeout(() => {
      node.measureInWindow((x, y, w, h) => {
        if (!w || !h || x + w < 0 || x > W || y + h < 0 || y > H) { tour.next(); return; }
        const p = step.pad ?? 6;
        setRect({ x: x - p, y: y - p, w: w + p * 2, h: h + p * 2 });
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, 120);
    return () => clearTimeout(id);
  }, [tour.active, tour.step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tour.active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tour.active, pulse]);

  if (!tour.active || !step) return null;

  const last = tour.step === TOUR_STEPS.length - 1;
  const r = rect;
  // Put the tip on the side with more room; for very tall highlights (the card), inside its lower part.
  const TIP_H = 200;
  let tipTop: number | undefined = H / 2 - 80;
  let tipBottom: number | undefined;
  if (r) {
    const spaceBelow = H - (r.y + r.h);
    const spaceAbove = r.y;
    if (spaceBelow >= TIP_H + 20 && spaceBelow >= spaceAbove) tipTop = r.y + r.h + 14;
    else if (spaceAbove >= TIP_H + 20) { tipTop = undefined; tipBottom = H - r.y + 14; }
    else tipTop = Math.min(r.y + r.h * 0.5, H - TIP_H - 30);
  }

  const Shade = ({ style }: { style: object }) => (
    <View style={[styles.shadeBox, style]} pointerEvents="none">
      {Platform.OS === 'ios' && <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'ios' ? 'rgba(6,11,24,0.45)' : 'rgba(6,11,24,0.72)' }]} />
    </View>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={tour.finish}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { Haptics.selectionAsync().catch(() => {}); tour.next(); }} accessibilityLabel="Next tip">
        {r ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
            {/* Four blurred panels around the highlighted area */}
            <Shade style={{ left: 0, top: 0, width: W, height: Math.max(0, r.y) }} />
            <Shade style={{ left: 0, top: r.y + r.h, width: W, height: Math.max(0, H - r.y - r.h) }} />
            <Shade style={{ left: 0, top: r.y, width: Math.max(0, r.x), height: r.h }} />
            <Shade style={{ left: r.x + r.w, top: r.y, width: Math.max(0, W - r.x - r.w), height: r.h }} />
            <Animated.View
              style={{
                position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h,
                borderRadius: step.radius ?? 16, borderWidth: 2.5, borderColor: BRAND.lime,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
              }}
            />
          </Animated.View>
        ) : (
          <Shade style={{ left: 0, top: 0, right: 0, bottom: 0 }} />
        )}

        <Animated.View style={[styles.tip, { top: tipTop, bottom: tipBottom, backgroundColor: t.card, opacity: fade }]}>
          <Text style={[styles.title, { color: t.text }]}>{step.title}</Text>
          <Text style={[styles.text, { color: t.textBody }]}>{step.text}</Text>
          <View style={styles.footer}>
            <View style={styles.dots}>
              {TOUR_STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: i === tour.step ? BRAND.navy : t.border, width: i === tour.step ? 16 : 6 }]} />
              ))}
            </View>
            {!last && (
              <Pressable onPress={tour.finish} hitSlop={10}>
                <Text style={[styles.skip, { color: t.textMuted }]}>Skip</Text>
              </Pressable>
            )}
            <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); tour.next(); }} style={styles.next}>
              <Text style={styles.nextText}>{last ? 'Start reading' : 'Next'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shadeBox: { position: 'absolute', overflow: 'hidden' },
  tip: { position: 'absolute', left: 16, right: 16, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  text: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 },
  dots: { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  skip: { fontWeight: '700', fontSize: 15 },
  next: { backgroundColor: BRAND.navy, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  nextText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
