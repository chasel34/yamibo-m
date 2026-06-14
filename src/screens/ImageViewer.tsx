import React from 'react';
import { Animated, Image, PanResponder, Pressable, Text, View, ViewStyle } from 'react-native';
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

function ViewerImage({ item }: { item?: ViewerItem }) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [item && item.src]);
  if (item && item.src && !err) {
    return (
      <Image
        source={{ uri: displayImageUrl(item.src) || item.src }}
        onError={() => setErr(true)}
        resizeMode="contain"
        style={{ width: '100%', height: '100%', maxHeight: 520 }}
      />
    );
  }
  return (
    <View style={{ width: '100%', height: '100%', maxHeight: 520, justifyContent: 'center' }}>
      <StripeImg h={520} radius={12} cap={item && item.cap ? item.cap : '图片占位'} style={{ width: '100%', maxHeight: '100%' }} />
    </View>
  );
}

export default function ImageViewerScreen({ route }: NativeStackScreenProps<RootStackParamList, 'viewer'>) {
  const nav = useNav();
  const images: ViewerItem[] = route.params?.images?.length ? route.params.images : [{ cap: '图片占位' }];
  const n = images.length;
  const initialIndex = Math.min(Math.max(route.params?.index || 0, 0), n - 1);
  const [i, setI] = React.useState(initialIndex);
  const [pageWidth, setPageWidth] = React.useState(0);
  const dragX = React.useRef(new Animated.Value(0)).current;
  const circBtn: ViewStyle = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' };

  const goTo = React.useCallback((nextIndex: number) => {
    if (!pageWidth || nextIndex === i) return;
    const clamped = Math.min(Math.max(nextIndex, 0), n - 1);
    Animated.timing(dragX, {
      toValue: (i - clamped) * pageWidth,
      duration: 340,
      useNativeDriver: true,
    }).start(() => {
      setI(clamped);
      dragX.setValue(0);
    });
  }, [dragX, i, n, pageWidth]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      n > 1
      && Math.abs(gesture.dx) > 6
      && Math.abs(gesture.dx) > Math.abs(gesture.dy)
    ),
    onPanResponderMove: (_, gesture) => {
      let dx = gesture.dx;
      if ((i === 0 && dx > 0) || (i === n - 1 && dx < 0)) dx *= 0.32;
      dragX.setValue(dx);
    },
    onPanResponderRelease: (_, gesture) => {
      const threshold = Math.min(90, pageWidth * 0.22);
      if (gesture.dx <= -threshold && i < n - 1) goTo(i + 1);
      else if (gesture.dx >= threshold && i > 0) goTo(i - 1);
      else {
        Animated.spring(dragX, {
          toValue: 0,
          speed: 24,
          bounciness: 0,
          useNativeDriver: true,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(dragX, {
        toValue: 0,
        speed: 24,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
    },
  }), [dragX, goTo, i, n, pageWidth]);

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
      <View
        style={{ flex: 1, overflow: 'hidden' }}
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {pageWidth > 0 && (
          <Animated.View
            style={{
              height: '100%',
              flexDirection: 'row',
              width: pageWidth * n,
              transform: [{ translateX: Animated.add(dragX, -i * pageWidth) }],
            }}
          >
            {images.map((item, k) => (
              <View key={k} style={{ width: pageWidth, height: '100%', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
                <ViewerImage item={item} />
              </View>
            ))}
          </Animated.View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 14, paddingBottom: 8 }}>
        {images.map((_, k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={`查看第 ${k + 1} 张图片`}
            onPress={() => goTo(k)}
            style={{ width: k === i ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? '#fff' : 'rgba(255,255,255,0.35)' }}
          />
        ))}
      </View>
      <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: FONTS.head, fontSize: 12, paddingTop: 4, paddingBottom: 22 }}>左右滑动切换</Text>
    </View>
  );
}
