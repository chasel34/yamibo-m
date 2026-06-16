import React from 'react';
import { View, Text, Pressable, Image, TextInput, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, Pattern } from 'react-native-svg';
import Icon from './Icon';
import { useTheme, FONTS, Theme } from '../theme';
import { avatarUrl } from '../util';

interface AvatarUser {
  uid?: string;
  avatar?: string;
  name?: string;
}

// ===================== Status bar (faux, ported from .statusbar) =====================
function nowHM(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function StatusBar({ time, color }: { time?: string; color?: string }) {
  const { t } = useTheme();
  const c = color || t.statusbar;
  // Real wall-clock time, ticking each minute (was hardcoded to 9:08).
  const [clock, setClock] = React.useState(nowHM);
  React.useEffect(() => {
    if (time != null) return;
    const id = setInterval(() => setClock(nowHM()), 30000);
    return () => clearInterval(id);
  }, [time]);
  const shown = time != null ? time : clock;
  return (
    <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 30, paddingRight: 26 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: c, fontFamily: FONTS.head, fontVariant: ['tabular-nums'] }}>{shown}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {/* signal */}
        <Svg width={18} height={12} viewBox="0 0 18 12">
          <Rect x="0" y="8" width="3" height="4" rx="1" fill={c} />
          <Rect x="5" y="5.5" width="3" height="6.5" rx="1" fill={c} />
          <Rect x="10" y="3" width="3" height="9" rx="1" fill={c} opacity={0.35} />
          <Rect x="15" y="0.5" width="3" height="11.5" rx="1" fill={c} opacity={0.35} />
        </Svg>
        {/* wifi */}
        <Svg width={17} height={12} viewBox="0 0 17 12">
          <Path d="M8.5 2.5c2.4 0 4.6.9 6.2 2.4l1.2-1.3A11 11 0 0 0 8.5.5 11 11 0 0 0 1.1 3.6l1.2 1.3A9 9 0 0 1 8.5 2.5z" fill={c} />
          <Path d="M8.5 6c1.3 0 2.5.5 3.4 1.4l1.2-1.3A7 7 0 0 0 8.5 4 7 7 0 0 0 3.9 6.1l1.2 1.3A5 5 0 0 1 8.5 6z" fill={c} />
          <Circle cx="8.5" cy="10" r="1.6" fill={c} />
        </Svg>
        {/* battery */}
        <Svg width={26} height={13} viewBox="0 0 26 13">
          <Rect x="0.5" y="0.5" width="21" height="12" rx="3.2" stroke={c} opacity={0.4} fill="none" />
          <Rect x="2" y="2" width="16" height="9" rx="1.8" fill={c} />
          <Rect x="23" y="4" width="1.6" height="5" rx="0.8" fill={c} opacity={0.4} />
        </Svg>
      </View>
    </View>
  );
}

// ===================== Toggle (ported from .toggle) =====================
export function Toggle({ on, onChange }: { on?: boolean; onChange?: (v: boolean) => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={() => { onChange && onChange(!on); }}
      style={{ width: 51, height: 31, borderRadius: 999, backgroundColor: on ? t.accent : t.toggleOff, justifyContent: 'center' }}
    >
      <View style={{
        position: 'absolute', top: 2, left: 2, width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff',
        transform: [{ translateX: on ? 20 : 0 }],
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
      }} />
    </Pressable>
  );
}

// ===================== Avatar (real image with monochrome letter fallback) =====================
export function Avatar({ user, size = 44, radius, uri }: { user?: AvatarUser | null; size?: number; radius?: number; uri?: string | null }) {
  const { t } = useTheme();
  const br = radius != null ? radius : size / 2;
  const src = uri || (user && user.uid ? avatarUrl(user.uid) : null);
  const [err, setErr] = React.useState(false);
  const box: ImageStyle = { width: size, height: size, borderRadius: br, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  React.useEffect(() => { setErr(false); }, [src]);
  if (src && !err) {
    return <Image source={{ uri: src }} onError={() => setErr(true)} style={box} />;
  }
  const label = (user && user.avatar) || (user && user.name && user.name[0]) || '?';
  return (
    <View style={box}>
      <Text style={{ color: t.inkSoft, fontWeight: '600', fontSize: size * 0.4, fontFamily: FONTS.head }}>{label}</Text>
    </View>
  );
}

// ===================== Group label -> plain muted text =====================
const GROUP_TONES: Record<string, keyof Theme> = {
  sprout: 'muted', scholar: 'muted', staff: 'accentInk', reg: 'muted',
};
export function GroupPill({ tone = 'sprout', children }: { tone?: string; children?: React.ReactNode }) {
  const { t } = useTheme();
  const key: keyof Theme = GROUP_TONES[tone] || 'muted';
  return <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t[key] }}>{children}</Text>;
}

// ===================== Stripe placeholder (ported from .stripe) =====================
export function StripeImg({ h = 170, cap = '图片占位', radius, style }: { h?: number; cap?: string; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const br = radius != null ? radius : 16;
  return (
    <View style={[{ height: h, borderRadius: br, backgroundColor: t.card2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <Pattern id="stripes" width={25.46} height={25.46} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={25.46} height={25.46} fill={t.stripeB} />
            <Rect width={12.73} height={25.46} fill={t.stripeA} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#stripes)" />
      </Svg>
      <View style={{ backgroundColor: t.card, opacity: 0.92, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
        <Text style={{ fontSize: 10.5, letterSpacing: 0.4, color: t.muted, fontFamily: 'monospace' }}>{cap}</Text>
      </View>
    </View>
  );
}

// ===================== Nav header (ported from .navhead) =====================
export function NavHeader({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 12, paddingHorizontal: 16, zIndex: 2 }}>
      <NavBack onBack={onBack} />
      <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 18, fontWeight: '700', color: t.ink, flex: 1, textAlign: 'center', paddingHorizontal: 8 }}>{title}</Text>
      {right || <View style={{ width: 40 }} />}
    </View>
  );
}

export function NavBack({ onBack, children }: { onBack?: () => void; children?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onBack} style={({ pressed }) => ({
      width: 40, height: 40, borderRadius: 20, backgroundColor: t.card2,
      alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }],
    })}>
      {children || <Icon name="back" size={21} color={t.inkSoft} />}
    </Pressable>
  );
}

// circular icon button (.iconbtn)
export function IconBtn({ name, size = 20, onPress, color, bg }: { name: string; size?: number; onPress?: () => void; color?: string; bg?: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: 42, height: 42, borderRadius: 21, backgroundColor: bg != null ? bg : t.card2,
      alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.93 : 1 }],
    })}>
      <Icon name={name} size={size} color={color || t.inkSoft} />
    </Pressable>
  );
}

// ===================== Divider (.feed-div / .hr) =====================
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return <View style={[{ height: 1, backgroundColor: t.line, marginHorizontal: 22 }, style]} />;
}
export function HLine({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return <View style={[{ height: 1, backgroundColor: t.line }, style]} />;
}

// ===================== Toast (ported from .toast) =====================
export function Toast({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center', zIndex: 60 }}>
      <View style={{ backgroundColor: 'rgba(40,28,24,0.92)', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999 }}>
        <Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 13, fontWeight: '500' }}>{msg}</Text>
      </View>
    </View>
  );
}

// ===================== Flat feed item (ported from .feed-item) =====================
export interface FeedThread {
  tag: string;
  title: string;
  excerpt?: string;
  time: string;
  pinned?: boolean;
  boardName?: string;
}
export function FeedItem({ t: th, onOpen, showBoard = false }: { t: FeedThread; onOpen: (t: FeedThread) => void; showBoard?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onOpen(th)} style={{ paddingVertical: 16, paddingHorizontal: 22 }}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6, color: t.muted, textTransform: 'uppercase', marginBottom: 8 }}>
        {showBoard ? th.boardName : th.tag}{th.pinned ? '  ·  置顶' : ''}
      </Text>
      <Text style={{ fontFamily: FONTS.head, color: t.ink, fontWeight: '700', fontSize: 17, lineHeight: 22.8, letterSpacing: -0.2, marginBottom: th.excerpt ? 7 : 8 }}>{th.title}</Text>
      {th.excerpt ? (
        <Text numberOfLines={2} style={{ fontFamily: FONTS.body, color: t.inkSoft, fontSize: 13.5, lineHeight: 21, marginBottom: 9 }}>{th.excerpt}</Text>
      ) : null}
      <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted, fontWeight: '500' }}>{th.time}</Text>
    </Pressable>
  );
}

// ===================== Board icon (line icons, per design app/data.jsx) =====================
// 真实板块不带设计稿里的 icon 名，按板块名关键字映射到同一套描边图标。顺序敏感：
// 更具体的信号（TXT/图/动漫…）先判，最后兜底 forum。
export function boardIcon(name?: string): string {
  const n = name || '';
  const has = (...ss: string[]) => ss.some((s) => n.includes(s));
  if (has('TXT', 'txt', '打包', '离线', '離線', '下载', '下載')) return 'doc';
  if (has('图', '圖')) return 'eye';
  if (has('动漫', '動漫', '番', '动画', '動畫')) return 'sparkle';
  if (has('海域')) return 'wave';
  if (has('游戏', '遊戲', 'galgame', 'GalGame', 'Galgame', '手游')) return 'game';
  if (has('影', '剧', '劇', '映', '電影', '电影')) return 'film';
  if (has('资源', '資源', '交流', '周边', '周邊', '集市')) return 'box';
  if (has('小说', '小說', '译文', '譯文', '文学', '文學', '漫画', '漫畫', '原创', '原創', '同人', '书', '書')) return 'book';
  if (has('管理', '站务', '站務', '公告')) return 'bell';
  if (has('指南', '新人', '报到', '報到', '帮助', '幫助', '问题', '問題')) return 'sprout';
  if (has('评价', '評價', '世界杯', '专版', '專版', '精华', '精華')) return 'star';
  return 'forum';
}

// ===================== Flat board / sub-board row (ported from .flatrow) =====================
export interface BoardRowItem {
  fid: string;
  name: string;
  desc?: string;
  today: number;
}
export function BoardRow<T extends BoardRowItem>({ b, onOpen, last }: { b: T; onOpen: (b: T) => void; last?: boolean }) {
  const { t } = useTheme();
  return (
    <View>
      <Pressable onPress={() => onOpen(b)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 22 }}>
        <Icon name={boardIcon(b.name)} size={22} stroke={1.6} color={t.inkSoft} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: b.desc ? 3 : 0 }}>
            <Text style={{ fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '700', color: t.ink }}>{b.name}</Text>
            {b.today > 0 ? <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.accentInk }}>{b.today}</Text> : null}
          </View>
          {b.desc ? <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 13.5, color: t.muted }}>{b.desc}</Text> : null}
        </View>
        <Icon name="chevRight" size={18} color={t.faint} />
      </Pressable>
      {!last && <View style={{ height: 1, backgroundColor: t.line, marginLeft: 58, marginRight: 22 }} />}
    </View>
  );
}

// ===================== Sub-board chip (子板块 · 等分一排, ported from .SubBoardChip) =====================
export function SubBoardChip<T extends { fid: string; name: string; today: number }>({ s, onOpen }: { s: T; onOpen: (s: T) => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onOpen(s)} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.lineStrong }}>
      <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 13.5, fontWeight: '600', color: t.ink, flexShrink: 1 }}>{s.name}</Text>
      {s.today > 0 ? <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '700', color: t.accentInk }}>{s.today}</Text> : null}
    </Pressable>
  );
}

// ===================== Pinned / notice row (置顶 · 公告, ported from .PinnedRow) =====================
export interface PinnedRowItem {
  title: string;
  kind: 'notice' | 'sticky';
}
export function PinnedRow<T extends PinnedRowItem>({ item, onOpen }: { item: T; onOpen: (i: T) => void }) {
  const { t } = useTheme();
  const notice = item.kind === 'notice';
  return (
    <Pressable onPress={() => onOpen(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 22 }}>
      <View style={{ height: 22, paddingHorizontal: 9, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: notice ? t.accent : t.accentSoft }}>
        <Text style={{ fontFamily: FONTS.head, fontSize: 11, fontWeight: '600', letterSpacing: 0.2, color: notice ? t.onAccent : t.accentInk }}>{notice ? '公告' : '置顶'}</Text>
      </View>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: notice ? t.accentInk : t.ink }}>{item.title}</Text>
    </Pressable>
  );
}

// ===================== Kicker / section label =====================
export function Kicker({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return <Text style={[{ fontFamily: FONTS.head, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6, color: t.muted, textTransform: 'uppercase' }, style as any]}>{children}</Text>;
}

// ===================== Pager (论坛式分页 · 安静排版风, ported from .pager) =====================
export function Pager({ page, totalPages, onJump, cap, extra }: {
  page: number; totalPages: number; onJump: (p: number) => void;
  cap?: string; extra?: React.ReactNode;
}) {
  const { t } = useTheme();
  const [val, setVal] = React.useState(String(page));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => { setVal(String(page)); }, [page]);
  const clamp = (p: number) => Math.max(1, Math.min(totalPages, p));
  const go = (p: number) => { onJump(clamp((p | 0) || 1)); };
  const commit = () => { const n = parseInt(val, 10); if (n) go(n); else setVal(String(page)); };
  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  // 单页：不显示翻页控件，仅保留底部说明
  if (totalPages <= 1) {
    if (!cap && !extra) return null;
    return (
      <View style={{ paddingTop: 18, paddingBottom: 6 }}>
        {cap ? <Text style={[pgcapStyle(t), { paddingHorizontal: 22 }]}>{cap}</Text> : null}
        {extra ? <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 22, paddingTop: 5, paddingBottom: 4 }}>{extra}</View> : null}
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 8, paddingBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 20, paddingHorizontal: 22 }}>
        <Pressable onPress={() => !atFirst && go(page - 1)} disabled={atFirst} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, opacity: atFirst ? 0.45 : pressed ? 0.55 : 1 })}>
          <Icon name="back" size={15} color={atFirst ? t.faint : t.inkSoft} />
          <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: '600', color: atFirst ? t.faint : t.inkSoft, letterSpacing: 0.2 }}>上一页</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Text style={pgcurLStyle(t)}>第</Text>
          <TextInput
            value={val}
            onChangeText={(s) => setVal(s.replace(/[^0-9]/g, ''))}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); commit(); }}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="go"
            style={{
              width: 30, textAlign: 'center', paddingVertical: 0, paddingBottom: 2,
              borderBottomWidth: 1.5, borderBottomColor: focused ? t.accent : t.lineStrong,
              color: t.ink, fontFamily: FONTS.head, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'],
            }}
          />
          <Text style={pgcurLStyle(t)}>/ {totalPages} 页</Text>
        </View>
        <Pressable onPress={() => !atLast && go(page + 1)} disabled={atLast} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, opacity: atLast ? 0.45 : pressed ? 0.55 : 1 })}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: '600', color: atLast ? t.faint : t.inkSoft, letterSpacing: 0.2 }}>下一页</Text>
          <Icon name="chevRight" size={15} color={atLast ? t.faint : t.inkSoft} />
        </Pressable>
      </View>
      {cap ? <Text style={[pgcapStyle(t), { paddingHorizontal: 22, paddingTop: 11, paddingBottom: 4 }]}>{cap}</Text> : null}
      {extra ? <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 22, paddingTop: 5, paddingBottom: 4 }}>{extra}</View> : null}
    </View>
  );
}
function pgcapStyle(t: Theme): any {
  return { textAlign: 'center', fontFamily: FONTS.head, fontSize: 12, color: t.faint, letterSpacing: 0.2 };
}
function pgcurLStyle(t: Theme): any {
  return { fontFamily: FONTS.head, fontSize: 13, fontWeight: '500', color: t.muted };
}

export { GROUP_TONES };
