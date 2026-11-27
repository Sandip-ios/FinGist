import RNMaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TOUR_STEPS, useTour } from '../lib/tour';
import { BRAND, useTheme } from '../theme';

// The library's class typings don't match this React version's JSX types; the component itself is fine.
const MaskedView = RNMaskedView as unknown as React.ComponentType<{ style?: object; maskElement: React.ReactElement; children?: React.ReactNode }>;

interface Rect { x: number; y: number; w: number; h: number; r: number }

const MOVE_MS = 420;

/** Whole screen minus a rounded hole (even-odd fill), so the cut-out matches the rounded outline. */
function holePath(W: number, H: number, rect: Rect | null): string {
  const screen = `M0 0H${W}V${H}H0Z`;
  if (!rect) return screen;
  const { x, y, w, h } = rect;
  const k = Math.min(rect.r, w / 2, h / 2);
  return `${screen} M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), r: lerp(a.r, b.r, p) });

/**
 * First-launch tour: everything is blurred and dimmed except the highlighted part, with a short
 * explanation next to it. Between steps the highlight glides and resizes to the next part of the
 * screen, and the tip card slides along with it.
 */
export function TourOverlay() {
  const t = useTheme();
  const tour = useTour();
  const { width: W, height: H } = useWindowDimensions();
  const [shown, setShown] = useState<Rect | null>(null);
  const shownRef = useRef<Rect | null>(null);
  const [tipH, setTipH] = useState(190);
  const appear = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const tipTop = useRef(new Animated.Value(H / 2)).current;
  const content = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const step = TOUR_STEPS[tour.step];

  // Where the tip card goes: the side with more room, or inside very tall highlights (the card).
  const tipTopFor = (r: Rect) => {
    const below = H - (r.y + r.h);
    const above = r.y;
    if (below >= tipH + 20 && below >= above) return r.y + r.h + 14;
    if (above >= tipH + 20) return r.y - 14 - tipH;
    return Math.min(r.y + r.h * 0.5, H - tipH - 30);
  };

  /** Glide the highlight (and the tip) from where it is now to the new target. */
  const moveTo = (target: Rect) => {
    const from = shownRef.current;
    const nextTip = tipTopFor(target);
    if (!from) {
      shownRef.current = target;
      setShown(target);
      tipTop.setValue(nextTip);
      Animated.timing(appear, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      return;
    }
    progress.stopAnimation();
    progress.setValue(0);
    progress.removeAllListeners();
    progress.addListener(({ value }) => {
      const r = lerpRect(from, target, value);
      shownRef.current = r;
      setShown(r);
    });
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: MOVE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(tipTop, { toValue: nextTip, duration: MOVE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(content, { toValue: 0.15, duration: 120, useNativeDriver: false }),
        Animated.timing(content, { toValue: 1, duration: 260, useNativeDriver: false }),
      ]),
    ]).start(() => progress.removeAllListeners());
  };

  // Find where the current target is on screen; skip steps whose target isn't visible.
  useEffect(() => {
    if (!tour.active) {
      shownRef.current = null;
      setShown(null);
      appear.setValue(0);
      return;
    }
    if (!step) return;
    const node = tour.target(step.target);
    if (!node) { tour.next(); return; }
    const measure = (first: boolean) =>
      node.measureInWindow((x, y, w, h) => {
        if (!w || !h || x + w < 0 || x > W || y + h < 0 || y > H) { if (first) tour.next(); return; }
        const p = step.pad ?? 6;
        const target = { x: x - p, y: y - p, w: w + p * 2, h: h + p * 2, r: step.radius ?? 16 };
        if (first) moveTo(target);
        else if (shownRef.current && Math.abs(shownRef.current.y - target.y) > 2) moveTo(target); // screen was still settling
      });
    const id = setTimeout(() => measure(true), 120);
    const id2 = setTimeout(() => measure(false), 520);
    return () => { clearTimeout(id); clearTimeout(id2); };
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
  const path = holePath(W, H, shown);
  const dim = Platform.OS === 'ios' ? 'rgba(6,11,24,0.45)' : 'rgba(6,11,24,0.72)';
  const next = () => { Haptics.selectionAsync().catch(() => {}); tour.next(); };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={tour.finish}>
      <Pressable style={StyleSheet.absoluteFill} onPress={next} accessibilityLabel="Next tip">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]} pointerEvents="none">
          {/* Blur (iPhone) and dim layer, both with the same rounded hole. */}
          {Platform.OS === 'ios' && (
            <MaskedView style={StyleSheet.absoluteFill} maskElement={<Svg width={W} height={H}><Path d={path} fill="#000" fillRule="evenodd" /></Svg>}>
              <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
            </MaskedView>
          )}
          <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            <Path d={path} fill={dim} fillRule="evenodd" />
          </Svg>
          {shown && (
            <Animated.View
              style={{
                position: 'absolute', left: shown.x, top: shown.y, width: shown.w, height: shown.h,
                borderRadius: Math.min(shown.r, shown.w / 2, shown.h / 2), borderWidth: 2.5, borderColor: BRAND.lime,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
              }}
            />
          )}
        </Animated.View>

        <Animated.View
          onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (Math.abs(h - tipH) > 2) setTipH(h); }}
          style={[styles.tip, { top: tipTop, backgroundColor: t.card, opacity: appear }]}
        >
          <Animated.View style={{ opacity: content }}>
            <Text style={[styles.title, { color: t.text }]}>{step.title}</Text>
            <Text style={[styles.text, { color: t.textBody }]}>{step.text}</Text>
          </Animated.View>
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
            <Pressable onPress={next} style={styles.next}>
              <Text style={styles.nextText}>{last ? 'Start reading' : 'Next'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
