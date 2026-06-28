import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CollectionsScreen from '../src/screens/Collections';
import { getCollections } from '../src/api';
import { AuthContext, ToastContext } from '../src/context';
import { ThemeContext, light } from '../src/theme';
import type { CollectionItem, ListResult } from '../src/types';

const mockNavigation = {
  push: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../src/api', () => ({
  getCollections: jest.fn(),
}));

const mockedGetCollections = getCollections as jest.MockedFunction<typeof getCollections>;

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

function collection(id: string, title: string): CollectionItem {
  return {
    id,
    tid: id,
    tag: '收藏',
    title,
    author: { name: '作者' },
    time: '刚刚',
    replies: 0,
    excerpt: '',
  };
}

function collectionsResult(list: CollectionItem[], page = 1, totalPages = 1): ListResult<CollectionItem> {
  return { list, page, totalPages, count: totalPages, perpage: 1 };
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

test('late pagination responses do not overwrite a newer refresh', async () => {
  const requests: Array<{ page: number; deferred: Deferred<ListResult<CollectionItem>> }> = [];
  mockedGetCollections.mockImplementation((page = 1) => {
    const d = deferred<ListResult<CollectionItem>>();
    requests.push({ page, deferred: d });
    return d.promise;
  });

  const screen = await renderWithProviders(<CollectionsScreen />);

  await waitFor(() => expect(requests.map((r) => r.page)).toEqual([1]));
  await resolveDeferred(requests[0].deferred, collectionsResult([collection('1', '初始收藏')], 1, 2));
  await waitFor(() => expect(screen.getByText('初始收藏')).toBeTruthy());

  await fireEvent.press(screen.getByText('下一页'));
  await waitFor(() => expect(requests.map((r) => r.page)).toEqual([1, 2]));

  const scroll = screen.root!.queryAll((node) => Boolean(node.props.refreshControl))[0];
  await act(async () => {
    scroll.props.refreshControl.props.onRefresh();
    await Promise.resolve();
  });
  await waitFor(() => expect(requests.map((r) => r.page)).toEqual([1, 2, 1]));

  await resolveDeferred(requests[2].deferred, collectionsResult([collection('3', '刷新后的收藏')], 1, 2));
  await waitFor(() => expect(screen.getByText('刷新后的收藏')).toBeTruthy());

  await resolveDeferred(requests[1].deferred, collectionsResult([collection('2', '过期第二页收藏')], 2, 2));
  expect(screen.getByText('刷新后的收藏')).toBeTruthy();
  expect(screen.queryByText('过期第二页收藏')).toBeNull();
});
