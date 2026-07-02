import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import * as Updates from 'expo-updates';
import Lily from './components/Lily';
import Icon from './components/Icon';
import { HLine } from './components/ui';
import { useToast } from './context';
import { FONTS, useTheme } from './theme';
import { APP_DISPLAY_VERSION } from './appInfo';

type SheetPhase = 'idle' | 'checking' | 'none' | 'ota-found' | 'downloading' | 'ready' | 'error' | 'unsupported';

interface AppUpdatesContextValue {
  staged: boolean;
  checking: boolean;
  openCheck: () => void;
}

const AppUpdatesContext = React.createContext<AppUpdatesContextValue>({
  staged: false,
  checking: false,
  openCheck: () => {},
});

export const useAppUpdates = () => React.useContext(AppUpdatesContext);

export function runtimeUpdatesSupported() {
  return !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled && !!Updates.channel;
}

export function AppUpdatesProvider({ children }: { children: React.ReactNode }) {
  const updates = Updates.useUpdates();
  const { toast } = useToast();
  const supported = runtimeUpdatesSupported();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<SheetPhase>('idle');
  const [staged, setStaged] = React.useState(false);
  const [bannerOpen, setBannerOpen] = React.useState(false);
  const [restarting, setRestarting] = React.useState(false);
  const backgroundAfterDownload = React.useRef(false);
  const manualDownloadRunning = React.useRef(false);

  React.useEffect(() => {
    if (!supported || !updates.isUpdatePending) return;
    setStaged(true);
    setBannerOpen((open) => open || phase !== 'ready');
  }, [phase, supported, updates.isUpdatePending]);

  const closeSheet = React.useCallback(() => {
    if (phase === 'checking') return;
    setSheetOpen(false);
    if (phase !== 'downloading') setPhase('idle');
  }, [phase]);

  const openCheck = React.useCallback(async () => {
    setBannerOpen(false);
    setSheetOpen(true);
    if (staged || updates.isUpdatePending) {
      setStaged(true);
      setPhase('ready');
      return;
    }
    if (!supported) {
      setPhase('unsupported');
      return;
    }
    setPhase('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      setPhase(result.isAvailable ? 'ota-found' : 'none');
    } catch (e) {
      setPhase('error');
    }
  }, [staged, supported, updates.isUpdatePending]);

  const startDownload = React.useCallback(async () => {
    if (!supported || manualDownloadRunning.current) return;
    manualDownloadRunning.current = true;
    backgroundAfterDownload.current = false;
    setPhase('downloading');
    try {
      await Updates.fetchUpdateAsync();
      setStaged(true);
      if (backgroundAfterDownload.current) {
        setSheetOpen(false);
        setBannerOpen(true);
        setPhase('idle');
      } else {
        setPhase('ready');
      }
    } catch (e) {
      if (backgroundAfterDownload.current) toast('下载更新失败，请稍后再试');
      else setPhase('error');
    } finally {
      manualDownloadRunning.current = false;
      backgroundAfterDownload.current = false;
    }
  }, [supported, toast, updates.isUpdatePending]);

  const downloadInBackground = React.useCallback(() => {
    backgroundAfterDownload.current = true;
    setSheetOpen(false);
    setPhase('idle');
    toast('将在后台继续下载');
  }, [toast]);

  const restartNow = React.useCallback(async () => {
    setBannerOpen(false);
    setSheetOpen(false);
    setRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch (e) {
      setRestarting(false);
      toast('重启失败，请稍后再试');
    }
  }, [toast]);

  const retry = React.useCallback(() => {
    openCheck();
  }, [openCheck]);

  const value = React.useMemo(() => ({
    staged: staged || updates.isUpdatePending,
    checking: phase === 'checking',
    openCheck,
  }), [openCheck, phase, staged, updates.isUpdatePending]);

  return (
    <AppUpdatesContext.Provider value={value}>
      {children}
      <UpdateSheet
        open={sheetOpen}
        phase={phase}
        progress={updates.downloadProgress || 0}
        onClose={closeSheet}
        onDownload={startDownload}
        onBackground={downloadInBackground}
        onRestart={restartNow}
        onRetry={retry}
      />
      <UpdateReadyBanner open={bannerOpen} onLater={() => setBannerOpen(false)} onRestart={restartNow} />
      <RestartOverlay on={restarting || updates.isRestarting} />
    </AppUpdatesContext.Provider>
  );
}

export function UpdateStatusChip() {
  const { t } = useTheme();
  return (
    <View style={{
      height: 26, paddingHorizontal: 11, borderRadius: 999, alignItems: 'center',
      justifyContent: 'center', backgroundColor: t.accentSoft,
    }}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600', color: t.accentInk }}>重启生效</Text>
    </View>
  );
}

function UpdateSheet({ open, phase, progress, onClose, onDownload, onBackground, onRestart, onRetry }: {
  open: boolean;
  phase: SheetPhase;
  progress: number;
  onClose: () => void;
  onDownload: () => void;
  onBackground: () => void;
  onRestart: () => void;
  onRetry: () => void;
}) {
  const { t, theme } = useTheme();
  if (!open) return null;
  const lockClose = phase === 'checking' || phase === 'downloading';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={lockClose ? undefined : onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          disabled={lockClose}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,12,8,0.42)' }}
        />
        <View style={{
          backgroundColor: t.card, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingTop: 10, paddingHorizontal: 22, paddingBottom: 26,
          shadowColor: '#000', shadowOpacity: theme === 'dark' ? 0.28 : 0.16,
          shadowRadius: 28, shadowOffset: { width: 0, height: -10 }, elevation: 12,
        }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: t.lineStrong, alignSelf: 'center', marginBottom: 6 }} />
          <SheetContent
            phase={phase}
            progress={progress}
            onClose={onClose}
            onDownload={onDownload}
            onBackground={onBackground}
            onRestart={onRestart}
            onRetry={onRetry}
          />
        </View>
      </View>
    </Modal>
  );
}

function SheetContent({ phase, progress, onClose, onDownload, onBackground, onRestart, onRetry }: {
  phase: SheetPhase;
  progress: number;
  onClose: () => void;
  onDownload: () => void;
  onBackground: () => void;
  onRestart: () => void;
  onRetry: () => void;
}) {
  switch (phase) {
    case 'checking':
      return <CheckingState />;
    case 'none':
      return <MessageState icon="check" title="已是最新版本" body={`你正在使用最新版本 百合会 ${APP_DISPLAY_VERSION}，无需更新。`} primary="知道了" onPrimary={onClose} />;
    case 'ota-found':
      return (
        <MessageState
          icon="download"
          title="发现新版本"
          body="更新很小，将在后台下载，完成后由你决定何时重启。"
          primary="下载更新"
          primaryIcon="download"
          onPrimary={onDownload}
          secondary="稍后"
          onSecondary={onClose}
        />
      );
    case 'downloading':
      return <DownloadingState progress={progress} onBackground={onBackground} />;
    case 'ready':
      return (
        <MessageState
          icon="sparkle"
          title="更新已准备好"
          body="重启应用后即可用上最新版本。下次自行打开也会自动生效，不必着急。"
          primary="立即重启"
          primaryIcon="refresh"
          onPrimary={onRestart}
          secondary="稍后"
          onSecondary={onClose}
        />
      );
    case 'unsupported':
      return <MessageState icon="info" title="暂不支持在线更新" body="当前版本（开发版本或未配置更新通道）暂不支持在线更新，可前往发布页获取最新版本。" primary="知道了" onPrimary={onClose} soft />;
    case 'error':
      return <MessageState icon="wave" title="检查更新失败" body="网络好像不太稳定，没能完成检查。歇一会儿再试也不迟。" primary="重试" primaryIcon="refresh" onPrimary={onRetry} secondary="稍后" onSecondary={onClose} soft />;
    default:
      return null;
  }
}

function CheckingState() {
  const { t } = useTheme();
  return (
    <View style={{ paddingVertical: 34, alignItems: 'center', gap: 16 }}>
      <ActivityIndicator size="small" color={t.accent} />
      <Text style={{ fontFamily: FONTS.head, fontSize: 15, fontWeight: '600', color: t.inkSoft }}>正在检查更新...</Text>
    </View>
  );
}

function DownloadingState({ progress, onBackground }: { progress: number; onBackground: () => void }) {
  const { t } = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <View style={{ paddingBottom: 4 }}>
      <Medallion name="download" />
      <SheetTitle>正在下载更新...</SheetTitle>
      <Text style={{ fontFamily: FONTS.head, fontSize: 22, fontWeight: '700', color: t.ink, textAlign: 'center', marginTop: 10 }}>
        {pct > 0 ? `${pct}%` : '下载中'}
      </Text>
      <View style={{ width: '100%', height: 5, borderRadius: 3, backgroundColor: t.card2, marginTop: 16, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.max(4, pct)}%`, backgroundColor: t.accent, borderRadius: 3 }} />
      </View>
      <SheetBody>下载时可以继续阅读，不会打断你。</SheetBody>
      <GhostButton onPress={onBackground}>在后台下载</GhostButton>
    </View>
  );
}

function MessageState({ icon, title, body, primary, primaryIcon, onPrimary, secondary, onSecondary, soft }: {
  icon: string;
  title: string;
  body: string;
  primary: string;
  primaryIcon?: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
  soft?: boolean;
}) {
  return (
    <View style={{ paddingBottom: 4 }}>
      <Medallion name={icon} soft={soft} />
      <SheetTitle>{title}</SheetTitle>
      <SheetBody>{body}</SheetBody>
      <PrimaryButton icon={primaryIcon} onPress={onPrimary}>{primary}</PrimaryButton>
      {secondary && onSecondary ? <GhostButton onPress={onSecondary}>{secondary}</GhostButton> : null}
    </View>
  );
}

function Medallion({ name, soft }: { name: string; soft?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{
      width: 56, height: 56, borderRadius: 17, marginTop: 8, alignSelf: 'center',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: soft ? t.card2 : t.accentSoft,
    }}>
      <Icon name={name} size={26} stroke={1.7} color={soft ? t.inkSoft : t.accentInk} />
    </View>
  );
}

function SheetTitle({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return <Text style={{ fontFamily: FONTS.head, fontSize: 19, fontWeight: '700', color: t.ink, textAlign: 'center', marginTop: 16 }}>{children}</Text>;
}

function SheetBody({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <Text style={{ fontFamily: FONTS.body, fontSize: 14.5, color: t.inkSoft, textAlign: 'center', marginTop: 11, lineHeight: 25, paddingHorizontal: 6 }}>
      {children}
    </Text>
  );
}

function PrimaryButton({ children, icon, onPress }: { children: React.ReactNode; icon?: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      height: 52, borderRadius: 999, marginTop: 22, backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
      opacity: pressed ? 0.72 : 1,
    })}>
      {icon ? <Icon name={icon} size={19} color={t.onAccent} /> : null}
      <Text style={{ fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '700', color: t.onAccent }}>{children}</Text>
    </Pressable>
  );
}

function GhostButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      height: 52, borderRadius: 999, marginTop: 10, backgroundColor: t.card2,
      alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1,
    })}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '600', color: t.inkSoft }}>{children}</Text>
    </Pressable>
  );
}

function UpdateReadyBanner({ open, onLater, onRestart }: { open: boolean; onLater: () => void; onRestart: () => void }) {
  const { t } = useTheme();
  if (!open) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 52, paddingHorizontal: 14, paddingBottom: 26 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card,
        borderWidth: 1, borderColor: t.line, borderRadius: 18, paddingVertical: 13,
        paddingLeft: 16, paddingRight: 13, shadowColor: '#000', shadowOpacity: 0.14,
        shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 9,
      }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={20} color={t.accentInk} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: '700', color: t.ink }}>新版本已准备好</Text>
          <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.muted, marginTop: 2 }}>重启后生效</Text>
        </View>
        <Pressable onPress={onLater} style={{ height: 34, paddingHorizontal: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 13, fontWeight: '600', color: t.inkSoft }}>稍后</Text>
        </Pressable>
        <Pressable onPress={onRestart} style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 13, fontWeight: '600', color: t.onAccent }}>立即重启</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RestartOverlay({ on }: { on: boolean }) {
  const { t } = useTheme();
  if (!on) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <Lily size={62} stroke={1.5} color={t.accent} />
      <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: '600', color: t.muted }}>正在重启...</Text>
    </View>
  );
}

export function UpdateInfoRows({ onCheck }: { onCheck: () => void }) {
  const { t } = useTheme();
  const { staged } = useAppUpdates();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, paddingHorizontal: 18 }}>
        <View style={{ width: 26, alignItems: 'center' }}><Icon name="info" size={20} color={t.inkSoft} /></View>
        <Text style={{ fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '500', color: t.ink, flex: 1 }}>当前版本</Text>
        <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted }}>{APP_DISPLAY_VERSION}</Text>
      </View>
      <HLine style={{ marginLeft: 57, marginRight: 18 }} />
      <Pressable onPress={onCheck} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, paddingHorizontal: 18 }}>
        <View style={{ width: 26, alignItems: 'center' }}><Icon name="refresh" size={20} color={staged ? t.accent : t.inkSoft} /></View>
        <Text style={{ fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '500', color: t.ink, flex: 1 }}>检查更新</Text>
        {staged ? <UpdateStatusChip /> : <Icon name="chevRight" size={18} color={t.faint} style={{ marginLeft: 8 }} />}
      </Pressable>
    </>
  );
}
