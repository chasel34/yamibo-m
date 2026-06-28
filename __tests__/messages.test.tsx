import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MessagesScreen from '../src/screens/Messages';
import { getPMs, getReminders } from '../src/api';
import { AuthContext, ToastContext } from '../src/context';
import { ThemeContext, light } from '../src/theme';
import type { ListResult, PMItem, Reminder } from '../src/types';

const mockNavigation = {
  push: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../src/api', () => ({
  getReminders: jest.fn(),
  getPMs: jest.fn(),
}));

const mockedGetReminders = getReminders as jest.MockedFunction<typeof getReminders>;
const mockedGetPMs = getPMs as jest.MockedFunction<typeof getPMs>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function resolveDeferred<T>(d: Deferred<T>, value: T) {
  await act(async () => {
    d.resolve(value);
    await Promise.resolve();
  });
}

function remindersResult(list: Reminder[], page = 1, totalPages = 1): ListResult<Reminder> {
  return { list, page, totalPages, count: totalPages, perpage: 1 };
}

function pmsResult(list: PMItem[], page = 1, totalPages = 1): ListResult<PMItem> {
  return { list, page, totalPages, count: list.length, perpage: 20 };
}

function reminder(id: string, text: string): Reminder {
  return { id, type: 'post', icon: 'reply', unread: false, who: '回复提醒', text, time: '刚刚' };
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeContext.Provider value={{ t: light, theme: 'light', setTheme: jest.fn(), uiFontLevel: 1, setUiFontLevel: jest.fn() }}>
      <ToastContext.Provider value={{ msg: null, toast: jest.fn() }}>
        <AuthContext.Provider value={{ booted: true, enter: jest.fn(), logout: jest.fn() }}>
          {ui}
        </AuthContext.Provider>
      </ToastContext.Provider>
    </ThemeContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('private message load errors do not hide loaded reminders after switching back', async () => {
  mockedGetReminders.mockResolvedValue(remindersResult([reminder('r1', '有人回复了你')]));
  mockedGetPMs.mockRejectedValue(new Error('私信加载失败'));

  const screen = await renderWithProviders(<MessagesScreen />);

  await waitFor(() => expect(screen.getByText('有人回复了你')).toBeTruthy());

  await fireEvent.press(screen.getByText('私信'));
  await waitFor(() => expect(screen.getByText('私信加载失败')).toBeTruthy());

  await fireEvent.press(screen.getByText('提醒'));
  expect(screen.getByText('有人回复了你')).toBeTruthy();
  expect(screen.queryByText('私信加载失败')).toBeNull();
});

test('late reminder pagination responses do not overwrite a newer refresh', async () => {
  const requests: Array<{ page: number; deferred: Deferred<ListResult<Reminder>> }> = [];
  mockedGetReminders.mockImplementation((page = 1) => {
    const d = deferred<ListResult<Reminder>>();
    requests.push({ page, deferred: d });
    return d.promise;
  });
  mockedGetPMs.mockResolvedValue(pmsResult([]));

  const screen = await renderWithProviders(<MessagesScreen />);

  await waitFor(() => expect(requests.map((r) => r.page)).toEqual([1]));
  await resolveDeferred(requests[0].deferred, remindersResult([reminder('r1', '初始提醒')], 1, 2));
  await waitFor(() => expect(screen.getByText('初始提醒')).toBeTruthy());

  await fireEvent.press(screen.getByText('下一页'));
  await waitFor(() => expect(requests.map((r) => r.page)).toEqual([1, 2]));

  const scroll = screen.root!.queryAll((node) => Boolean(node.props.refreshControl))[0];
  await act(async () => {
    scroll.props.refreshControl.props.onRefresh();
    await Promise.resolve();
  });
  await waitFor(() => expect(requests.map((r) => r.page)).toEqual([1, 2, 1]));

  await resolveDeferred(requests[2].deferred, remindersResult([reminder('r3', '刷新后的提醒')], 1, 2));
  await waitFor(() => expect(screen.getByText('刷新后的提醒')).toBeTruthy());

  await resolveDeferred(requests[1].deferred, remindersResult([reminder('r2', '过期第二页提醒')], 2, 2));
  expect(screen.getByText('刷新后的提醒')).toBeTruthy();
  expect(screen.queryByText('过期第二页提醒')).toBeNull();
});
