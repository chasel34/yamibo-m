import React from 'react';
import { Linking, Pressable, StyleProp, ImageStyle, Text, View } from 'react-native';
import CachedImage from './CachedImage';
import { StripeImg } from './ui';
import { useTheme, FONTS } from '../theme';
import { displayImageUrl } from '../api';

interface RemoteImageProps {
  src?: string | null;
  cap?: string;
  onPress?: () => void;
  style?: StyleProp<ImageStyle>;
  width?: number;
  height?: number;
}

// Post-body image: loads the real attachment, keeps aspect ratio, falls back to
// the striped placeholder if it can't load.
export default function RemoteImage({ src, cap, onPress, style, width, height }: RemoteImageProps) {
  const { t } = useTheme();
  const [ratio, setRatio] = React.useState(width && height ? width / height : 1.5);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    setErr(false);
    setRatio(width && height ? width / height : 1.5);
  }, [src, width, height]);

  if (!src || err) {
    return (
      <Pressable onPress={() => {
        const original = displayImageUrl(src);
        if (original) Linking.openURL(original);
      }}>
        <StripeImg h={150} cap="图片加载失败" radius={10} style={{ marginTop: 6 }} />
        <View style={{ paddingVertical: 9, marginBottom: 14 }}>
          <Text style={{ color: t.accentInk, fontFamily: FONTS.body, fontSize: 13 }}>查看原图：{cap || src || '图片'}</Text>
        </View>
      </Pressable>
    );
  }
  const onLoad = (e: any) => {
    const s = e?.nativeEvent?.source || e?.source || {};
    if (s.width && s.height) setRatio(s.width / s.height);
  };
  return (
    <Pressable onPress={onPress}>
      <CachedImage
        source={{ uri: displayImageUrl(src) || src }}
        onLoad={onLoad}
        onError={() => setErr(true)}
        contentFit="contain"
        recyclingKey={src ?? undefined}
        style={[{ width: '100%', aspectRatio: ratio, borderRadius: 10, backgroundColor: t.card2, marginTop: 6, marginBottom: 14 }, style]}
      />
    </Pressable>
  );
}
