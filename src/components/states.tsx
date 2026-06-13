import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Lily from './Lily';
import { useTheme, FONTS } from '../theme';

export function Loader({ label }: { label?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <ActivityIndicator size="small" color={t.accent} />
      {label ? <Text style={{ marginTop: 12, color: t.muted, fontFamily: FONTS.head, fontSize: 13 }}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 70, paddingHorizontal: 40 }}>
      <Lily size={52} stroke={1.4} color={t.faint} />
      <Text style={{ fontFamily: FONTS.head, fontSize: 16, fontWeight: '700', color: t.ink, marginTop: 20, marginBottom: 8, textAlign: 'center' }}>出了点小问题</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: t.muted, textAlign: 'center', lineHeight: 21 }}>{message || '加载失败，请稍后再试'}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ marginTop: 20, height: 40, paddingHorizontal: 24, borderRadius: 999, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: '600', color: t.accentInk }}>重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ label = '空空如也', sub = '安安静静，等一朵花开' }: { label?: string; sub?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
      <Lily size={58} stroke={1.4} color={t.faint} />
      <Text style={{ fontFamily: FONTS.head, fontSize: 17, fontWeight: '700', color: t.ink, marginTop: 22, marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: t.muted }}>{sub}</Text>
    </View>
  );
}
