import React from 'react';
import { View, Platform } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import './src/uiFontScale'; // installs the global Text fontSize-scaling patch (must run before any render)
import { setUiFontScale, uiFontScaleForLevel, UI_FONT_LEVEL_KEY } from './src/uiFontScale';
import { ThemeContext, THEMES, useTheme } from './src/theme';
import { ToastProvider, useToast, AuthContext } from './src/context';
import { checkAuth, logout as apiLogout } from './src/api';
import { Toast } from './src/components/ui';
import TabBar from './src/components/TabBar';
import type { ThemeName, RootStackParamList } from './src/types';

import LoginScreen from './src/screens/Login';
import ForumScreen from './src/screens/Forum';
import BoardScreen from './src/screens/Board';
import ThreadScreen from './src/screens/Thread';
import ReaderScreen from './src/screens/Reader';
import ImageViewerScreen from './src/screens/ImageViewer';
import ProfileScreen from './src/screens/Profile';
import MessagesScreen from './src/screens/Messages';
import MineScreen from './src/screens/Mine';
import SettingsScreen from './src/screens/Settings';
import CollectionsScreen from './src/screens/Collections';
import HistoryScreen from './src/screens/History';
import AboutScreen from './src/screens/About';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="forum" component={ForumScreen} />
      <Tab.Screen name="messages" component={MessagesScreen} />
      <Tab.Screen name="mine" component={MineScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { booted } = React.useContext(AuthContext);
  const { t } = useTheme();
  const base = t.name === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: t.bg, card: t.bg, text: t.ink, primary: t.accent },
  };
  return (
    <NavigationContainer
      theme={navTheme}
      linking={Platform.OS === 'web' ? {
        prefixes: ['http://localhost:8085'],
        config: {
          screens: {
            thread: 'thread/:tid',
            reader: 'reader/:tid/:authorid',
          },
        },
      } : undefined}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        {!booted ? (
          <RootStack.Screen name="login" component={LoginScreen} options={{ animation: 'fade' }} />
        ) : (
          <>
            <RootStack.Screen name="tabs" component={MainTabs} />
            <RootStack.Screen name="board" component={BoardScreen} />
            <RootStack.Screen name="thread" component={ThreadScreen} />
            <RootStack.Screen name="reader" component={ReaderScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="profile" component={ProfileScreen} />
            <RootStack.Screen name="settings" component={SettingsScreen} />
            <RootStack.Screen name="collections" component={CollectionsScreen} />
            <RootStack.Screen name="history" component={HistoryScreen} />
            <RootStack.Screen name="about" component={AboutScreen} />
            <RootStack.Screen name="viewer" component={ImageViewerScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// Home indicator (.home-indicator)
function HomeIndicator() {
  const { t } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      <View style={{ width: 134, height: 5, borderRadius: 3, backgroundColor: t.ink, opacity: 0.22 }} />
    </View>
  );
}

function ToastLayer() {
  const { msg } = useToast();
  return <Toast msg={msg} />;
}

// Phone frame: on web, center a 375x812 device-sized viewport on the frame color.
function PhoneFrame({ children }: { children?: React.ReactNode }) {
  const { t } = useTheme();
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: t.frame, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 375, height: 812, maxHeight: '100%', backgroundColor: t.bg, overflow: 'hidden', position: 'relative' }}>
          {children}
        </View>
      </View>
    );
  }
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

function Shell() {
  const { t } = useTheme();
  return (
    <PhoneFrame>
      <RootNavigator />
      <ToastLayer />
      <HomeIndicator />
      <ExpoStatusBar style={t.name === 'dark' ? 'light' : 'dark'} hidden />
    </PhoneFrame>
  );
}

export default function App() {
  const [theme, setThemeState] = React.useState<ThemeName>('light');
  const [uiFontLevel, setUiFontLevelState] = React.useState(1);
  const [booted, setBooted] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('yh_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') setThemeState(savedTheme);
        const savedFont = parseInt((await AsyncStorage.getItem(UI_FONT_LEVEL_KEY)) ?? '', 10);
        if (savedFont >= 0 && savedFont <= 2) { setUiFontLevelState(savedFont); setUiFontScale(uiFontScaleForLevel(savedFont)); }
      } catch (e) {}
      // Verify against the real session (proxy/cookies restore login on web).
      try {
        const uid = await checkAuth();
        if (uid) setBooted(true);
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  const setTheme = React.useCallback((tname: ThemeName) => {
    setThemeState(tname);
    AsyncStorage.setItem('yh_theme', tname).catch(() => {});
  }, []);

  const setUiFontLevel = React.useCallback((level: number) => {
    setUiFontScale(uiFontScaleForLevel(level));   // live value read by the Text patch
    setUiFontLevelState(level);                   // new themeValue → useTheme consumers re-render → Text re-scales
    AsyncStorage.setItem(UI_FONT_LEVEL_KEY, String(level)).catch(() => {});
  }, []);

  const auth = React.useMemo(() => ({
    booted,
    enter: () => setBooted(true),                 // after successful real login / guest
    logout: async () => { await apiLogout(); setBooted(false); },
  }), [booted]);

  const themeValue = React.useMemo(() => ({ t: THEMES[theme], theme, setTheme, uiFontLevel, setUiFontLevel }), [theme, setTheme, uiFontLevel, setUiFontLevel]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: THEMES[theme].bg }} />;

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={themeValue}>
        <ToastProvider>
          <AuthContext.Provider value={auth}>
            <Shell />
          </AuthContext.Provider>
        </ToastProvider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
