import React from 'react';
import { View, Text, Pressable, Image, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Icon from '../components/Icon';
import { StripeImg } from '../components/ui';
import { useNav } from '../useNav';
import { FONTS } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { displayImageUrl } from '../api';

interface ViewerItem {
  src?: string | null;
  cap?: string;
}

function ViewerImage({ item, zoom }: { item?: ViewerItem; zoom: boolean }) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [item && item.src]);
  if (item && item.src && !err) {
    return (
      <Image
        source={{ uri: displayImageUrl(item.src) || item.src }}
        onError={() => setErr(true)}
        resizeMode="contain"
        style={{ width: '100%', height: zoom ? 560 : 460, transform: [{ scale: zoom ? 1.15 : 1 }] }}
      />
    );
  }
  return (
    <View style={{ width: '100%' }}>
      <StripeImg h={zoom ? 440 : 340} radius={12} cap={(item && item.cap ? item.cap : '图片占位') + (zoom ? ' · 已放大' : '')} />
    </View>
  );
}

export default function ImageViewerScreen({ route }: NativeStackScreenProps<RootStackParamList, 'viewer'>) {
  const nav = useNav();
  const images: ViewerItem[] = route.params?.images || [{ cap: '图片占位' }];
  const [i, setI] = React.useState<number>(route.params?.index || 0);
  const [zoom, setZoom] = React.useState(false);
  const n = images.length;
  const circBtn: ViewStyle = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' };

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0a09' }}>
      {/* dark status bar */}
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 30, paddingRight: 26 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: FONTS.head }}>9:08</Text>
        <Svg width={18} height={12} viewBox="0 0 18 12">
          <Rect x="0" y="8" width="3" height="4" rx="1" fill="#fff" />
          <Rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff" />
          <Rect x="10" y="3" width="3" height="9" rx="1" fill="#fff" />
          <Rect x="15" y="0.5" width="3" height="11.5" rx="1" fill="#fff" opacity={0.4} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable style={circBtn} onPress={nav.closeViewer}><Icon name="close" size={20} color="#fff" /></Pressable>
        <Text style={{ color: '#fff', fontFamily: FONTS.head, fontWeight: '600', fontSize: 15 }}>{i + 1} / {n}</Text>
        <Pressable style={circBtn} onPress={nav.notImplemented}><Icon name="download" size={20} color="#fff" /></Pressable>
      </View>
      <Pressable onPress={() => setZoom(!zoom)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <ViewerImage item={images[i]} zoom={zoom} />
        {n > 1 && (
          <>
            <Pressable style={[circBtn, { position: 'absolute', left: 18 }]} onPress={() => setI((i - 1 + n) % n)}><Icon name="back" size={20} color="#fff" /></Pressable>
            <Pressable style={[circBtn, { position: 'absolute', right: 18 }]} onPress={() => setI((i + 1) % n)}><Icon name="chevRight" size={20} color="#fff" /></Pressable>
          </>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 14, paddingBottom: 8 }}>
        {images.map((_, k) => (
          <View key={k} style={{ width: k === i ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? '#fff' : 'rgba(255,255,255,0.35)' }} />
        ))}
      </View>
      <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: FONTS.head, fontSize: 12, paddingTop: 4, paddingBottom: 22 }}>点按图片可缩放 · 左右切换</Text>
    </View>
  );
}
