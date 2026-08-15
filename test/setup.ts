// 测试渲染器没有真实布局（onLayout / measure 全是 0），LegendList 量不到视口就不挂载任何行。
// 仿 FlashList 官方 jest mock 的做法：测试里退化成非虚拟化全量渲染，只保数据流语义。
jest.mock('@legendapp/list/react-native', () => {
  const actual = jest.requireActual('@legendapp/list/react-native');
  const React = require('react');
  const { ScrollView, View } = require('react-native');
  const render = (Comp: any) => (Comp == null ? null : React.isValidElement(Comp) ? Comp : React.createElement(Comp));
  const LegendList = React.forwardRef((props: any, ref: any) => {
    const {
      data = [], renderItem, extraData,
      ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ItemSeparatorComponent,
      refreshControl, horizontal,
    } = props;
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: jest.fn(), scrollToOffset: jest.fn(), scrollToEnd: jest.fn(), scrollToItem: jest.fn(),
    }));
    const children = data.map((item: any, index: number) =>
      React.createElement(React.Fragment, { key: props.keyExtractor ? props.keyExtractor(item, index) : index },
        renderItem({ item, index, extraData }),
        ItemSeparatorComponent && index < data.length - 1
          ? React.createElement(ItemSeparatorComponent, { leadingItem: item })
          : null));
    return React.createElement(ScrollView, { refreshControl, horizontal },
      render(ListHeaderComponent),
      data.length === 0 ? render(ListEmptyComponent) : React.createElement(View, null, children),
      render(ListFooterComponent));
  });
  return { ...actual, LegendList };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});
