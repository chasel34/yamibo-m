import { Text, Pressable } from 'react-native';
import Icon from './Icon';
import { useTheme, FONTS } from '../theme';

interface MRowProps {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
}

// Shared list row used by Mine / About (ported from .flatrow + MRow in screens_c.jsx).
export default function MRow({ icon, label, sub, onPress, danger }: MRowProps) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 22 }}>
      <Icon name={icon} size={21} color={danger ? t.accent : t.inkSoft} />
      <Text style={{ flex: 1, fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '500', color: danger ? t.accent : t.ink }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted }}>{sub}</Text> : null}
      <Icon name="chevRight" size={18} color={t.faint} style={{ marginLeft: 8 }} />
    </Pressable>
  );
}
