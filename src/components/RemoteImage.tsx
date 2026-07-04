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

const FALLBACK_IMAGE_RATIO = 1.5;
const RATIO_EPSILON = 0.005;

function imageRatio(width?: number, height?: number): number | null {
  if (!width || !height) return null;
  const ratio = width / height;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

// Post-body image: loads the real attachment, keeps aspect ratio, falls back to
// the striped placeholder if it can't load.
export default function RemoteImage({ src, cap, onPress, style, width, height }: RemoteImageProps) {
  const { t } = useTheme();
  const fixedRatio = imageRatio(width, height);
  const [ratio, setRatio] = React.useState(fixedRatio ?? FALLBACK_IMAGE_RATIO);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    setErr(false);
    setRatio(fixedRatio ?? FALLBACK_IMAGE_RATIO);
  }, [fixedRatio, src]);

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
    const s = e?.source || e?.nativeEvent?.source || {};
    const next = imageRatio(Number(s.width), Number(s.height));
    if (fixedRatio != null) return;
    if (next != null) {
      setRatio((current) => Math.abs(current - next) < RATIO_EPSILON ? current : next);
    }
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
