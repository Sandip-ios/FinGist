import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet } from 'react-native';
import { BRAND } from '../theme';

const MIN_SHOW_MS = 1400;
const MAX_SHOW_MS = 3500;
// The same full-screen design is the iPhone launch screen (app.json → expo-splash-screen → ios),
// shown the instant the app opens. This screen continues it seamlessly and adds the live spinner.
const SPLASH = require('../../assets/splash-full.png');

/** Launch design with "Loading latest news…", shown until saved news is ready, then fades into the app. */
export function IntroSplash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const [minDone, setMinDone] = useState(false);
  // iPhone already shows this design natively; Android shows a plain background first, so fade in.
  const appear = useRef(new Animated.Value(Platform.OS === 'ios' ? 1 : 0)).current;
  const loading = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native launch screen only once this identical screen has drawn its image.
    Animated.parallel([
      Animated.timing(appear, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(loading, { toValue: 1, duration: 400, delay: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const id = setTimeout(() => setMinDone(true), MIN_SHOW_MS);
    return () => clearTimeout(id);
  }, [appear, loading]);

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
    <Animated.View style={[StyleSheet.absoluteFill, s.root, { opacity: out }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]}>
        <Image
          source={SPLASH}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onDisplay={() => SplashScreen.hideAsync().catch(() => {})}
          onError={() => SplashScreen.hideAsync().catch(() => {})}
        />
      </Animated.View>
      <Animated.View style={[s.loading, { opacity: loading, transform: [{ translateY: loading.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <ActivityIndicator size="small" color={BRAND.blue} />
        <Animated.Text style={s.loadingText}>Loading latest news…</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { zIndex: 100, backgroundColor: '#eef3fb' },
  loading: { position: 'absolute', left: 0, right: 0, bottom: '9%', alignItems: 'center', gap: 10 },
  loadingText: { color: '#3a4a72', fontSize: 15, fontWeight: '600' },
});

// Safety net: never leave the native launch screen up if the image cannot draw.
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 2500);
