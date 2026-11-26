import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAlerts } from '../lib/alerts';
import { BRAND, useTheme } from '../theme';

/**
 * One-time card asking whether the user wants breaking-news alerts.
 * Shown from the second app open, after a short delay, never again once answered.
 */
export function AlertsPrompt() {
  const t = useTheme();
  const alerts = useAlerts();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const due = !alerts.prefs.promptSeen && !alerts.prefs.enabled && alerts.prefs.opens >= 2;

  useEffect(() => {
    if (!due) return;
    const id = setTimeout(() => {
      setShow(true);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
    }, 8000);
    return () => clearTimeout(id);
  }, [due, anim]);

  if (!show || !due) return null;

  const hide = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShow(false));
    alerts.markPromptSeen();
  };

  return (
    <Animated.View style={[s.wrap, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
      <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={s.iconWrap}><Ionicons name="notifications" size={22} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: t.text }]}>Stay ahead of the market</Text>
          <Text style={[s.text, { color: t.textMuted }]}>Morning market mood, market open update and important breaking news. Max 8 a day, quiet at night.</Text>
          <View style={s.buttons}>
            <Pressable onPress={async () => { await alerts.setEnabled(true); hide(); }} style={s.primary}>
              <Text style={s.primaryText}>{alerts.busy ? 'Turning on…' : 'Turn on alerts'}</Text>
            </Pressable>
            <Pressable onPress={hide} style={s.secondary} hitSlop={6}>
              <Text style={[s.secondaryText, { color: t.textMuted }]}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, bottom: 90 },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, shadowColor: '#0b1530', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  text: { fontSize: 13.5, marginTop: 2 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  primary: { backgroundColor: BRAND.navy, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { paddingVertical: 9 },
  secondaryText: { fontWeight: '700' },
});
