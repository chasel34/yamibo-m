import React from 'react';
import { Image, Pressable, StyleProp, ImageStyle } from 'react-native';
import { StripeImg } from './ui';
import { useTheme } from '../theme';

interface RemoteImageProps {
  src?: string | null;
  cap?: string;
  onPress?: () => void;
  style?: StyleProp<ImageStyle>;
}

// Post-body image: loads the real attachment, keeps aspect ratio, falls back to
// the striped placeholder if it can't load.
export default function RemoteImage({ src, cap, onPress, style }: RemoteImageProps) {
  const { t } = useTheme();
  const [ratio, setRatio] = React.useState(1.5);
  const [err, setErr] = React.useState(false);

  if (!src || err) {
    return (
      <Pressable onPress={onPress}>
        <StripeImg h={180} cap={cap || '图片'} radius={10} style={{ marginTop: 6, marginBottom: 14 }} />
      </Pressable>
    );
  }
  const onLoad = (e: any) => {
    const s = e?.nativeEvent?.source || e?.source || {};
    if (s.width && s.height) setRatio(s.width / s.height);
  };
  return (
    <Pressable onPress={onPress}>
      <Image
        source={{ uri: src }}
        onLoad={onLoad}
        onError={() => setErr(true)}
        resizeMode="cover"
        style={[{ width: '100%', aspectRatio: Math.max(0.6, Math.min(ratio, 2)), borderRadius: 10, backgroundColor: t.card2, marginTop: 6, marginBottom: 14 }, style]}
      />
    </Pressable>
  );
}
