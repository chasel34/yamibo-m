import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { Avatar, NavBack, Divider, HLine } from '../components/ui';
import MRow from '../components/MRow';
import { Loader, ErrorView } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getProfile, getSelfProfile } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UserProfile, RootStackParamList } from '../types';

function StatCell({ n, label, onPress }: { n: number | string; label: string; onPress?: (() => void) | null }) {
  const { t } = useTheme();
  return (
    <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={onPress || undefined} disabled={!onPress}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 19, fontWeight: '700', color: t.ink }}>{n}</Text>
      <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, color: t.muted, fontWeight: '500', marginTop: 3 }}>{label}</Text>
    </Pressable>
  );
}
function InfoRow({ label, v }: { label: string; v?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 15, paddingHorizontal: 22, alignItems: 'center' }}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 14.5, color: t.muted, width: 64, fontWeight: '500' }}>{label}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: t.ink2, flex: 1, lineHeight: 24 }}>{v}</Text>
    </View>
  );
}
export default function ProfileScreen({ route }: NativeStackScreenProps<RootStackParamList, 'profile'>) {
  const nav = useNav();
  const { t } = useTheme();
  const paramUid = route.params?.uid;
  const wantSelf = route.params?.self;

  const [u, setU] = React.useState<UserProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const r = wantSelf ? await getSelfProfile() : await getProfile(paramUid);
      setU(r.user);
    } catch (e) { setError(e.message); }
  }, [paramUid, wantSelf]);
  React.useEffect(() => { load(); }, [load]);

  const self = u ? u.self : wantSelf;
  const div = <Divider />;
  const divFull = <HLine />;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 12, paddingHorizontal: 16, justifyContent: 'space-between' }}>
        <NavBack onBack={nav.pop} />
        <View style={{ flex: 1 }} />
        {self
          ? <NavBack onBack={() => nav.push('settings', {})}><Icon name="gear" size={19} color={t.inkSoft} /></NavBack>
          : <NavBack onBack={() => nav.toast('更多')}><Icon name="share" size={18} color={t.inkSoft} /></NavBack>}
      </View>

      {error ? <ErrorView message={error} onRetry={load} />
        : !u ? <Loader label="加载资料…" />
        : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingHorizontal: 24, paddingBottom: 4 }}>
              <Avatar user={u} size={78} />
              <Text style={{ fontFamily: FONTS.head, fontSize: 23, fontWeight: '700', color: t.ink, marginTop: 16 }}>{u.name}</Text>
              <Text style={{ fontFamily: FONTS.head, fontSize: 13, color: t.muted, fontWeight: '500', marginTop: 7 }}>{u.group}{u.register ? ' · ' + u.register : ''}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 14.5, color: t.inkSoft, marginTop: 14, lineHeight: 24, maxWidth: 290, textAlign: 'center' }}>{u.bio}</Text>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: 22, paddingHorizontal: 16 }}>
              <StatCell n={u.stats.themes} label="主题" />
              <StatCell n={u.stats.replies} label="回复" />
              <StatCell n={u.stats.collections} label="收藏" onPress={self ? () => nav.push('collections', {}) : null} />
              <StatCell n={u.stats.follow} label="关注" />
              <StatCell n={u.stats.fans} label="粉丝" />
            </View>
            {divFull}
            <InfoRow label="性别" v={u.gender} />
            {div}
            <InfoRow label="星座" v={u.constellation} />
            {div}
            <InfoRow label="所在地" v={u.location} />
            {divFull}
            {self ? (
              <>
                <MRow icon="bookmark" label="我的收藏" onPress={() => nav.push('collections', {})} />
                <HLine style={{ marginLeft: 56, marginRight: 22 }} />
                <MRow icon="doc" label="我的发帖" onPress={() => nav.toast('我的发帖：v2 开放')} />
                <HLine style={{ marginLeft: 56, marginRight: 22 }} />
                <MRow icon="logout" label="退出登录" danger onPress={() => nav.logout()} />
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 12, paddingTop: 22, paddingHorizontal: 22 }}>
                  <View style={{ flex: 1, height: 52, borderRadius: 999, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                    <Text style={{ color: t.onAccent, fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '600' }}>关注</Text>
                  </View>
                  <View style={{ flex: 1, height: 52, borderRadius: 999, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                    <Text style={{ color: t.inkSoft, fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '600' }}>私信</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 12, color: t.faint, paddingTop: 14 }}>v1 暂未开放关注 / 私信</Text>
              </>
            )}
            <View style={{ height: 30 }} />
          </ScrollView>
        )}
    </Screen>
  );
}
