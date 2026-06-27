import { __private } from '../src/api';

describe('API mappers', () => {
  beforeEach(() => {
    __private.clearFavoriteIndexForTests();
  });

  test('board mapper defaults missing arrays and excludes pinned rows from threads', () => {
    const board = __private.mapBoardData({
      forum: { fid: '5', name: '版块', threadcount: '2' },
      forum_threadlist: [
        { tid: '10', subject: '公告', displayorder: '1', typeid: '9' },
        { tid: '11', subject: '普通', author: 'A', authorid: '1', replies: '7', views: '30', displayorder: '0', dblastpost: '1782000000' },
      ],
      threadtypes: { types: { 9: '公告' } },
      tpp: '20',
      page: '1',
    }, '5', 1);

    expect(board.subs).toEqual([]);
    expect(board.types).toEqual([{ id: '9', name: '公告' }]);
    expect(board.pinned).toHaveLength(1);
    expect(board.threads).toHaveLength(1);
    expect(board.threads[0].replies).toBe(7);
    expect(board.totalPages).toBe(1);
  });

  test('collections expose pagination metadata', () => {
    const result = __private.mapCollections({
      count: '45',
      perpage: '20',
      page: '2',
      list: [
        { idtype: 'tid', id: '100', favid: '9', title: '<b>收藏帖</b>', author: '作者', dateline: '1782000000', replies: '3' },
        { idtype: 'uid', id: 'ignored', title: '用户收藏' },
      ],
    }, 2);

    expect(result.list).toHaveLength(1);
    expect(result.count).toBe(45);
    expect(result.page).toBe(2);
    expect(result.perpage).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  test('collections fall back when perpage is absent', () => {
    const result = __private.mapCollections({
      count: '2',
      list: [
        { idtype: 'tid', id: '1', title: 'A' },
        { idtype: 'tid', id: '2', title: 'B' },
      ],
    }, 1);
    expect(result.perpage).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  test('empty collections keep a stable single page', () => {
    const result = __private.mapCollections({ count: '0', list: [] }, 4);
    expect(result.list).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  test('reminders expose pagination metadata', () => {
    const result = __private.mapReminders({
      count: '41',
      perpage: '20',
      list: [{ id: 'r1', type: 'post', new: '1', note: '<b>有人回复</b>', dateline: '1782000000' }],
    }, 1);
    expect(result.list[0].unread).toBe(true);
    expect(result.totalPages).toBe(3);
  });

  test('private messages expose pagination metadata and missing perpage fallback', () => {
    const result = __private.mapPMs({
      count: '2',
      list: [
        { plid: 'p1', tousername: '同好', message: '<i>你好</i>', isnew: '2', dateline: '1782000000' },
        { pmid: 'p2', msgfromusername: '朋友', lastsummary: '再见', new: '0' },
      ],
    }, 1);
    expect(result.list).toHaveLength(2);
    expect(result.perpage).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  test('favorite pages hydrate the in-memory favorite index', () => {
    const result = __private.mapCollections({
      count: '45',
      perpage: '20',
      page: '2',
      list: [
        { idtype: 'tid', id: '100', favid: '9', title: '收藏帖', author: '作者' },
        { idtype: 'uid', id: 'ignored', title: '用户收藏' },
      ],
    }, 2);

    __private.rememberFavoritePage(result);

    expect(__private.cachedFavoriteState('100')).toEqual({ favorited: true, favid: '9' });
    expect(__private.favoriteIndexSnapshotForTests()).toEqual({
      states: [['100', { favorited: true, favid: '9' }]],
      observedPages: [2],
      totalPages: 3,
    });
  });

  test('favorite lookup policy is bounded unless full scan is requested', () => {
    expect(__private.FAVORITE_LOOKUP_PAGE_LIMIT).toBe(3);
    expect(__private.favoriteScanLimit(10, false)).toBe(3);
    expect(__private.favoriteScanLimit(2, false)).toBe(2);
    expect(__private.favoriteScanLimit(10, true)).toBe(10);
  });

  test('full scans bypass negative cached favorite states without favids', () => {
    __private.rememberFavoriteState('404', { favorited: false });

    expect(__private.cachedFavoriteState('404')).toEqual({ favorited: false });
    expect(__private.cachedFavoriteState('404', true)).toBeNull();
  });
});
