import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BRAND } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const LINE = 'M4 60 L44 34 L74 48 L120 10 L176 2';
const LINE_LENGTH = 200;
const MIN_SHOW_MS = 1500;
const MAX_SHOW_MS = 3500;

/**
 * Designed launch screen shown over the app while saved news loads: the FinGist wordmark,
 * a rising market line that draws itself, and the tagline. The phone's own launch screen is
 * plain navy, so this continues from it without a jump, then fades into the news.
 */
export function IntroSplash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const word = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    Animated.sequence([
      Animated.timing(word, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(line, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.timing(tag, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true }),
      ]),
    ]).start();
    const id = setTimeout(() => setMinDone(true), MIN_SHOW_MS);
    return () => clearTimeout(id);
  }, [word, line, tag]);

  // Leave once saved news is ready (after the minimum time), or after the maximum time anyway.
  useEffect(() => {
    if (!minDone) return;
    const fadeOut = () =>
      Animated.timing(out, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setGone(true));
    if (ready) { fadeOut(); return; }
    const id = setTimeout(fadeOut, MAX_SHOW_MS - MIN_SHOW_MS);
    return () => clearTimeout(id);
  }, [minDone, ready, out]);

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 100 }]} pointerEvents="none">
      <LinearGradient colors={['#0a2fb0', BRAND.navy, '#000c3d']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="44%" rx="70%" ry="42%">
            <Stop offset="0" stopColor={BRAND.lime} stopOpacity={0.16} />
            <Stop offset="1" stopColor={BRAND.lime} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>
      <View style={s.center}>
        <Animated.View style={{ opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: word.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
          <Text style={s.word}>
            Fin<Text style={{ color: BRAND.lime }}>Gist</Text>
          </Text>
        </Animated.View>
        <Svg width={180} height={64} viewBox="0 0 180 64" style={{ marginTop: 6 }}>
          <AnimatedPath
            d={LINE}
            stroke={BRAND.lime}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${LINE_LENGTH} ${LINE_LENGTH}`}
            strokeDashoffset={line.interpolate({ inputRange: [0, 1], outputRange: [LINE_LENGTH, 0] })}
          />
        </Svg>
        <Animated.Text style={[s.tagline, { opacity: tag }]}>Market news in 60 words</Animated.Text>
      </View>
      <Animated.Text style={[s.footer, { opacity: tag }]}>India · Global markets</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  word: { color: '#fff', fontSize: 56, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.5 },
  tagline: { color: 'rgba(255,255,255,0.78)', fontSize: 17, fontWeight: '600', marginTop: 10, letterSpacing: 0.2 },
  footer: { position: 'absolute', bottom: 54, alignSelf: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
});
