// ===== Nav context (shared across all script files) =====
window.Nav = React.createContext(null);
window.useNav = () => React.useContext(window.Nav);

// ===== Mock data =====
window.DATA = (function(){

  const ME = {
    id:"me", name:"清弓", group:"百合幼苗", groupTone:"sprout",
    avatar:"清", avatarTone:"#c25a7a",
    register:"2021年3月 加入",
    bio:"摇曳的日常最治愈。考据党 / 偶尔产粮 / 提灯喵汉化组潜水成员。",
    gender:"女", constellation:"双鱼座", location:"上海",
    stats:{ themes:128, replies:892, collections:64, follow:57, fans:113 },
    credits:[
      {label:"总积分", value:2480, max:3000, key:"total"},
      {label:"金钱", value:1560, max:2000, key:"money"},
      {label:"贡献", value:320, max:500, key:"contrib"},
      {label:"人气", value:880, max:1000, key:"pop"},
    ],
  };

  const OTHER = {
    id:"u2", name:"灯子的领带", group:"百合の研究者", groupTone:"scholar",
    avatar:"灯", avatarTone:"#9a6db0",
    register:"2019年7月 加入",
    bio:"終将成为你 厨力过载。考据 / 翻译 / 同人文搬运。轻易不冒泡，冒泡必长贴。",
    gender:"女", constellation:"天秤座", location:"广州",
    stats:{ themes:412, replies:3380, collections:209, follow:88, fans:1924 },
    credits:[
      {label:"总积分", value:12840, max:15000, key:"total"},
      {label:"金钱", value:9200, max:12000, key:"money"},
      {label:"贡献", value:2150, max:3000, key:"contrib"},
      {label:"人气", value:6400, max:8000, key:"pop"},
    ],
  };

  // ---- 排序模式（全板块通用） ----
  const sortModes = ["全部","最新","热门","精华"];

  // ---- 每个板块各自的「分类」（首项恒为 公告）----
  const CAT = {
    notice:["公告","版本更新","活动","规范"],
    newcomer:["公告","报到","自我介绍","求助"],
    acg:["公告","季番","完结","剧场版","漫画","声优"],
    sea:["公告","熟肉","生肉","字幕","求资源"],
    lit:["公告","原创","同人文","长评","短篇","翻译"],
    game:["公告","GalGame","手游","乙女向","攻略"],
    film:["公告","电影","剧集","纪录","真人改"],
    trade:["公告","周边交换","实体本","求购"],
    lit_ln:["公告","轻小说","文学/文艺小说","其他小说","外文原创"],
    lit_txt:["公告","整本打包","系列合集","单本"],
    acg_season:["公告","本周","吐槽","考据"],
    acg_finished:["公告","神作","冷门佳作","补番"],
    acg_manga:["公告","连载","完结","短篇"],
  };

  // ---- 子板块（本身就是完整 board，可被 push 进 BoardScreen）----
  const litSubs = [
    {id:"lit_ln", icon:"book", name:"轻小说/译文区", desc:"百合小说汉化 · 生肉 · 译文", today:77, themes:"1327", posts:"4.1万", color:"#9a6db0", cats:CAT.lit_ln,
      announce:"看轻小说，当文明人，禁止盗转，违者封号。请尊重他人汉化成果，已盗转者请自行删除或自觉联系平台下架，谢谢配合！"},
    {id:"lit_txt", icon:"doc", name:"TXT小说区", desc:"整本打包 · 离线阅读", today:24, themes:"860", posts:"2.3万", color:"#3d7ea6", cats:CAT.lit_txt},
  ];
  const acgSubs = [
    {id:"acg_season", icon:"sparkle", name:"季番讨论", desc:"当季新番追番楼", today:64, themes:"9.2千", posts:"6.7万", color:"#c25a7a", cats:CAT.acg_season},
    {id:"acg_finished", icon:"star", name:"完结回顾", desc:"经典回看 · 考古", today:31, themes:"7.4千", posts:"4.1万", color:"#9a6db0", cats:CAT.acg_finished},
    {id:"acg_manga", icon:"book", name:"漫画连载", desc:"连载追更 · 短篇", today:33, themes:"5.1千", posts:"3.0万", color:"#3f8f6a", cats:CAT.acg_manga},
  ];

  // boards grouped
  const groups = [
    {
      id:"miaotang", name:"庙堂", desc:"官方 · 站务",
      boards:[
        {id:"notice", icon:"bell", name:"站务公告", desc:"版本更新、活动与社区规范", today:6, themes:"1.2千", posts:"3.4万", color:"#a8453b", cats:CAT.notice},
        {id:"newcomer", icon:"sprout", name:"新人报到", desc:"第一次来？在这里和大家打个招呼", today:33, themes:"4.8万", posts:"21万", color:"#3f8f6a", cats:CAT.newcomer},
      ],
    },
    {
      id:"jianghu", name:"江湖", desc:"主要分区",
      boards:[
        {id:"acg", icon:"sparkle", name:"動漫區", desc:"二次元百合作品讨论 · 番剧 · 漫画", today:128, themes:"3.2万", posts:"18万", color:"#c25a7a", cats:CAT.acg, subs:acgSubs},
        {id:"sea", icon:"wave", name:"海域區", desc:"资源交流 · 熟肉生肉 · 汉化分享", today:96, themes:"2.7万", posts:"15万", color:"#3d7ea6", cats:CAT.sea},
        {id:"lit", icon:"book", name:"文學區", desc:"原创百合 · 同人文 · 长评短评", today:64, themes:"1.9万", posts:"9.6万", color:"#9a6db0", cats:CAT.lit, subs:litSubs},
        {id:"game", icon:"game", name:"遊戲區", desc:"GalGame · 手游 · 乙女与百合向", today:33, themes:"8.4千", posts:"5.1万", color:"#3f8f6a", cats:CAT.game},
        {id:"film", icon:"film", name:"影視區", desc:"真人电影 · 剧集 · 纪录", today:21, themes:"6.2千", posts:"3.8万", color:"#c98a3c", cats:CAT.film},
      ],
    },
    {
      id:"ziyuan", name:"集市", desc:"交流 · 周边",
      boards:[
        {id:"trade", icon:"box", name:"資源交流區", desc:"周边交换 · 实体本 · 同好集结", today:54, themes:"1.1万", posts:"7.2万", color:"#a8453b", cats:CAT.trade},
      ],
    },
  ];

  const hot = [
    {id:"h1", title:"「摇曳百合」第八季制作决定，来盘一盘十年前的那些梗", board:"動漫區", date:"6月10日", tone:"#c25a7a"},
    {id:"h2", title:"終将成为你 番外·灯子视角 熟肉补完计划", board:"海域區", date:"6月10日", tone:"#3d7ea6"},
    {id:"h3", title:"2026 上半年百合新番口碑榜（持续更新）", board:"動漫區", date:"6月9日", tone:"#9a6db0"},
    {id:"h4", title:"征集：你心里「最治愈的一幕」是哪一格？", board:"文學區", date:"6月8日", tone:"#3f8f6a"},
  ];

  const tags = ["全部","摇曳百合","citrus","终将成为你","安达与岛村","孤独摇滚","lycoris recoil","我推的孩子","水星的魔女"];

  const u = (name, tone, group, gt) => ({name, avatar:name[0], avatarTone:tone, group, groupTone:gt});
  const users = {
    a: u("提灯喵汉化组","#a8453b","汉化担当","staff"),
    b: u("橘里橘气","#c25a7a","百合幼苗","sprout"),
    c: u("灯子的领带","#9a6db0","百合の研究者","scholar"),
    d: u("摇曳的向日葵","#3f8f6a","百合幼苗","sprout"),
    e: u("comaki","#3d7ea6","常驻观测者","reg"),
    f: u("水星来客","#c98a3c","百合幼苗","sprout"),
  };

  const threads = [
    { id:"t1", board:"acg", tag:"摇曳百合",
      title:"【提灯喵汉化组】[結野ちり]阿菊小姐想要搞姬附身 17",
      author:users.a, time:"45分钟前", views:"3.2k", replies:128,
      excerpt:"第 17 话熟肉如约而至～这一话阿菊的小心思真的太可爱了，结尾那一格的眼神请大家自行体会。一如既往，喜欢请支持正版。",
      image:true, imgCap:"封面 · 汉化扉页" },
    { id:"t2", board:"acg", tag:"终将成为你",
      title:"关于——为什么不能接受女角色「性转」这件事",
      author:users.c, time:"1小时前", views:"5.1k", replies:342,
      excerpt:"想认真聊聊一个老话题。性转作为同人创作手法由来已久，但放在百合语境下，它到底消解了什么、又保留了什么？欢迎理性讨论，不要上升。",
      image:false },
    { id:"t3", board:"acg", tag:"孤独摇滚",
      title:"孤独摇滚 波奇与喜多，算百合吗（理性向长文）",
      author:users.e, time:"2小时前", views:"8.4k", replies:516,
      excerpt:"先说结论：我认为「是否是百合」并不重要，重要的是这段关系给了我们什么。下面从分镜、台词与作画三个层面展开聊聊……",
      image:true, imgCap:"插图 · 同人贺图" },
    { id:"t4", board:"acg", tag:"水星的魔女",
      title:"水星的魔女 婚后日常脑洞合集，太甜了根本停不下来",
      author:users.f, time:"3小时前", views:"2.7k", replies:97,
      excerpt:"楼主开个坑，专门收集苏莱塔和米奥琳涅的婚后日常脑洞。一楼自割腿肉，欢迎大家在评论区接龙补完！",
      image:true, imgCap:"插图 · 婚后日常" },
    { id:"t5", board:"acg", tag:"citrus",
      title:"citrus 重温杂感：十年回看，依然是那个夏天",
      author:users.b, time:"5小时前", views:"1.9k", replies:64,
      excerpt:"最近又把 citrus 翻出来重看了一遍。抛开当年的争议不谈，柚子和芽衣这对的化学反应放到今天依然很能打。",
      image:false },
    { id:"t6", board:"acg", tag:"安达与岛村",
      title:"安达与岛村 小说第 10 卷读后，关于「距离」的那点事",
      author:users.d, time:"昨天", views:"1.2k", replies:41,
      excerpt:"第 10 卷依旧是细腻得让人窒息的日常。安达的患得患失被写得入木三分，岛村视角的几段独白尤其戳人。",
      image:false },
  ];

  // category for the seeded 動漫區 threads
  const _acgCat = { t1:"漫画", t2:"季番", t3:"完结", t4:"季番", t5:"完结", t6:"完结" };
  threads.forEach(t=>{ t.cat = _acgCat[t.id]||"季番"; t.essence = (t.id==="t1"||t.id==="t3"); });

  // ---- authored threads for 文學區 ----
  const litThreads = [
    {id:"l1", board:"lit", cat:"原创", tag:"原创", novelId:"book_sheng", novelKind:"长篇连载", title:"《盛夏与她的制服裙》第三章 已更（长篇连载）", author:users.b, time:"38分钟前", views:"2.1k", replies:86, essence:true, image:true, imgCap:"封面 · 自绘扈页",
      excerpt:"承接上一章的天台告白，这一章把镜头交给了学姐。她的犹豫不是不爱，而是太清楚要付出什么。"},
    {id:"l2", board:"lit", cat:"长评", tag:"长评", title:"长评 | 论百合文学里「沉默」作为一种告白", author:users.c, time:"2小时前", views:"4.3k", replies:152, essence:true,
      excerpt:"很多最动人的瞬间都发生在没有台词的地方。本文从三部作品出发，聊聊留白如何承载情感。"},
    {id:"l3", board:"lit", cat:"同人文", tag:"同人文", title:"【同人】终将成为你 · 毕业后十年的某个雨天", author:users.d, time:"3小时前", views:"1.6k", replies:73,
      excerpt:"侑和燈子早已是旁人眼中的老夫老妻，可有些话过了十年依然只敢在雨声里说。"},
    {id:"l4", board:"lit", cat:"短篇", tag:"短篇", novelId:"book_kanto", novelKind:"短篇", title:"短篇 | 便利店关东煮与她的第十七个冬天", author:users.f, time:"5小时前", views:"980", replies:34,
      excerpt:"三千字的小品。关于一份总是多买一份的关东煮，和一句始终没说出口的话。"},
    {id:"l5", board:"lit", cat:"翻译", tag:"翻译", novelId:"book_sun", novelKind:"中篇连载", title:"【译文】日文原创短篇《向日葵不会说谎》全 5 话完", author:users.a, time:"昨天", views:"3.7k", replies:118, image:true, imgCap:"译文扈页 · 向日葵",
      excerpt:"经原作者授权翻译。一个关于盛夏、向日葵田与两个女孩的故事。已全部完结，欢迎品读。"},
    {id:"l6", board:"lit", cat:"原创", tag:"原创", title:"开新坑《她比月色更轻》设定与人物先行公开", author:users.e, time:"昨天", views:"1.2k", replies:51,
      excerpt:"动笔前先放出世界观和两位主角的设定，想听听大家的想法再决定连载节奏。"},
  ];

  // ---- authored threads for 轻小说/译文区（对照原版参考图）----
  const lnThreads = [
    {id:"ln1", board:"lit_ln", cat:"公告", tag:"公告", title:"轻小说/译文区版规——禁止发布限制级内容、禁止机翻（修订于2026.6.10）",
      author:{name:"hongyuny", avatar:"h", avatarTone:"#c25a7a", group:"汉化担当", groupTone:"staff"}, time:"2020-4-8", views:"1.7万", replies:37, essence:true,
      excerpt:"本区由2020年4月6日设立，用于发布百合小说汉化、小说生肉等（同人除外）。一、明令禁止：1、机翻；2、限制级内容……"},
    {id:"ln2", board:"lit_ln", cat:"轻小说", tag:"轻小说", title:"【汉化】《邻座的她总在看我》第 1-3 卷 合并补完", author:users.a, time:"1小时前", views:"5.4k", replies:96, essence:true, image:true, imgCap:"汉化扈页 · 第1卷",
      excerpt:"感谢翻译校对嵌字的辛苦付出。三卷合并版已补全前作所有勘误，喜欢请支持正版文库本。"},
    {id:"ln3", board:"lit_ln", cat:"文学/文艺小说", tag:"文艺小说", title:"文艺向 | 一篇被低估的昭和百合短篇，值得一读", author:users.c, time:"3小时前", views:"2.2k", replies:58,
      excerpt:"语言克制到近乎冷淡，却在结尾一句话里把所有情绪推到顶点。强烈推荐给喜欢文学性的读者。"},
    {id:"ln4", board:"lit_ln", cat:"外文原创", tag:"外文原创", title:"【生肉】日文原创新连载《放学后的标本室》求合作汉化", author:users.f, time:"昨天", views:"1.4k", replies:29,
      excerpt:"个人很喜欢但精力有限，放出生肉链接，求有爱的汉化组或个人合作，细水长流即可。"},
    {id:"ln5", board:"lit_ln", cat:"其他小说", tag:"其他小说", title:"求推荐：有没有成年人视角、职场背景的百合小说？", author:users.d, time:"昨天", views:"3.1k", replies:144,
      excerpt:"看腻了校园题材，想找一些社会人视角、慢热细腻的作品，最好有汉化或译文，谢谢大家。"},
  ];

  // ---- 置顶 / 公告（紧凑单行）----
  const PINNED = {
    lit_ln:[
      {kind:"notice", title:"欢迎光临。"},
      {kind:"sticky", title:"如何找回账号 / 如何修改密码"},
      {kind:"sticky", title:"百合会新人须知 / 论坛规则"},
      {kind:"sticky", title:"轻小说区目录编辑教程（持续更新）"},
      {kind:"sticky", title:"禁止转载就是禁止转载"},
    ],
    lit:[
      {kind:"notice", title:"文學區发帖规范与版权声明"},
      {kind:"sticky", title:"原创百合长期征文活动 · 第七期"},
    ],
    acg:[
      {kind:"sticky", title:"動漫區追番礼仪与剧透折叠须知"},
    ],
  };

  // ---- 生成器：没有手写帖子的板块用这个填充，保证不空 ----
  const GEN_POOL = [
    {title:"这对的化学反应放到今天依然很能打，安利向", excerpt:"抛开当年的争议不谈，放到今天依然很能打。简单写写为什么现在还值得入坑。", image:false},
    {title:"考据：原作里那几处留白到底在暗示什么", excerpt:"整理了几个一直被忽略的细节，配合分镜一起看会有完全不同的解读。", image:true, imgCap:"考据图 · 分镜对照"},
    {title:"求一个在线阅读 / 资源，手机端看着方便", excerpt:"找了一圈没找到合适的版本，蹲一个手机端友好的，感激不尽。", image:false},
    {title:"楼主开个坑，专门收集婚后日常脑洞", excerpt:"一楼自割腿肉，欢迎大家在评论区接龙补完，甜度不限！", image:true, imgCap:"插图 · 婚后日常"},
    {title:"理性讨论：是不是百合不重要，重要的是这段关系", excerpt:"先说结论，再从角色弧光和叙事结构两个层面慢慢展开聊聊。", image:false},
    {title:"十年老粉的碎碎念，谢谢你们陪我到现在", excerpt:"从追连载到现在已经第十年了，想找个地方好好说说这些年的心情。", image:false},
    {title:"新人第一帖，请多关照（附自推清单）", excerpt:"潜水很久终于注册了，附上这些年最爱的几部，求同好交流。", image:false},
    {title:"整理了一份入坑指南，会持续更新", excerpt:"按时间线和题材分了类，新人友好，老观众也欢迎补充纠错。", image:true, imgCap:"整理图 · 入坑指南"},
  ];
  // 翻页填充用的扩充帖池（增加每页内容多样性）
  const EXT_POOL = [
    {title:"年度盘点：那些让我「DNA 动了」的名场面", excerpt:"按播出年份排了个序，每部挑一格最戳我的画面，欢迎大家补充。", image:true, imgCap:"盘点图 · 名场面"},
    {title:"冷门安利：这部被严重低估，真的没人看吗", excerpt:"播出时几乎没水花，但质量在线，剧情和作画都很稳，强烈安利。", image:false},
    {title:"讨论：百合作品里你最吃哪种「关系张力」", excerpt:"青梅竹马、欢喜冤家、师生、上下属……来聊聊各自的本命设定。", image:false},
    {title:"汉化进度同步贴（每周更新，置顶勿沉）", excerpt:"本周已嵌字校对完成，预计周末放出，感谢大家的耐心等待。", image:false},
    {title:"资源整理：高清扫图与字体打包，自取", excerpt:"整理了一份网盘合集，含扫图、字体与嵌字模板，长期有效。", image:true, imgCap:"资源图 · 打包预览"},
    {title:"作画考据：这个分镜其实致敬了二十年前的老番", excerpt:"对比了两组画面，构图和运镜几乎一致，作者明显是老观众。", image:true, imgCap:"对照图 · 分镜致敬"},
    {title:"求助：手机端阅读哪个客户端体验最好？", excerpt:"用过几个都不太顺手，想找个排版舒服、夜间模式好用的，求推荐。", image:false},
    {title:"自割腿肉：随手写了段小甜饼，请笑纳", excerpt:"睡前脑洞产物，没怎么校对，逻辑别太较真，单纯图一乐。", image:false},
    {title:"投票：下一期共读选哪一部？三选一", excerpt:"列了三个候选，评论区扣 1/2/3，下周根据票数开新楼。", image:false},
    {title:"补番记录：一口气刷完，来还愿了", excerpt:"拖了好久终于补完，结果一晚上看完，后劲太大睡不着，记录一下。", image:false},
    {title:"细节党：第几集那一帧，背景里藏了彩蛋", excerpt:"逐帧看才发现的，背景海报上的字其实是后面剧情的伏笔。", image:true, imgCap:"彩蛋图 · 背景细节"},
    {title:"长评 | 关于「成长」与「告别」的一点私货", excerpt:"写得有点长也有点私人，权当一个老观众的碎碎念，轻喷。", image:false},
    {title:"新人提问：入坑顺序有讲究吗，从哪部开始好", excerpt:"完全的新人，作品太多无从下手，想问问大家推荐的入坑路线。", image:false},
    {title:"周边晒单：终于集齐了这一套，圆满了", excerpt:"花了大半年才凑齐，开箱晒一下，附购买渠道避雷提醒。", image:true, imgCap:"晒单图 · 周边合影"},
  ];
  const _uarr = [users.a, users.b, users.c, users.d, users.e, users.f];
  const _gtimes = ["12分钟前","1小时前","2小时前","4小时前","昨天","前天"];
  const _gviews = ["3.2k","1.1k","8.4k","2.7k","960","1.9k"];
  const _greplies = [128,42,516,97,18,64];
  const _rtimes = ["38分钟前","32分钟前","27分钟前","20分钟前","15分钟前","11分钟前","8分钟前","5分钟前","3分钟前","刚刚"];
  function genThreads(board){
    const cats = (board.cats||[]).filter(c=>c!=="公告");
    return GEN_POOL.map((g,i)=>({
      id: board.id+"_g"+i, board:board.id,
      cat: cats.length? cats[i%cats.length] : board.name,
      tag: cats.length? cats[i%cats.length] : board.name,
      title: g.title, author:_uarr[i%_uarr.length], time:_gtimes[i%_gtimes.length],
      views:_gviews[i%_gviews.length], replies:_greplies[i%_greplies.length],
      excerpt:g.excerpt, image:g.image, imgCap:g.imgCap, essence:(i%3===0),
    }));
  }

  const AUTHORED = { acg:threads, lit:litThreads, lit_ln:lnThreads };

  // ---- 板块总帖数（确定性，便于稳定分页）----
  function boardTotal(board){
    let h=0; for(let i=0;i<board.id.length;i++) h=(h*31+board.id.charCodeAt(i))>>>0;
    const pages = 4 + (h % 13);     // 4..16 页
    const partial = 1 + (h % 20);   // 末页 1..20 条
    return (pages-1)*20 + partial;
  }
  // 返回某板块「完整」帖子列表（真实帖在前，其余确定性生成填充）
  function fullListFor(board){
    const base = (AUTHORED[board.id] || genThreads(board)).slice();
    const total = Math.max(base.length, boardTotal(board));
    const cats = (board.cats||[]).filter(c=>c!=="公告");
    const POOL = GEN_POOL.concat(EXT_POOL);
    const out = base.slice();
    for(let i=base.length; i<total; i++){
      const g = POOL[i % POOL.length];
      out.push({
        id: board.id+"_f"+i, board:board.id,
        cat: cats.length? cats[(i*2) % cats.length] : board.name,
        tag: cats.length? cats[(i*2) % cats.length] : board.name,
        title: g.title, author:_uarr[(i*3+1) % _uarr.length], time:_gtimes[i % _gtimes.length],
        views:_gviews[i % _gviews.length], replies:_greplies[i % _greplies.length],
        excerpt:g.excerpt, image:g.image, imgCap:g.imgCap, essence:(i%4===0),
      });
    }
    return out;
  }

  // returns { pinned:[...], list:[...] } for any board
  function threadsFor(board){
    const pinned = (PINNED[board.id]||[]).map((p,i)=>({
      id: board.id+"_p"+i, board:board.id, kind:p.kind, title:p.title, cat:"公告",
      author:users.a, time:"置顶", views:"—", replies:0,
      excerpt:"该帖为板块置顶公告，请仔细阅读后再参与讨论。",
    }));
    const list = (AUTHORED[board.id] || genThreads(board)).slice();
    return { pinned, list };
  }

  // floors for thread detail (t1)
  const floors = [
    { floor:1, op:true, user:users.a, time:"45分钟前",
      blocks:[
        {t:"text", v:"第 17 话熟肉如约而至～感谢翻译、校对和嵌字组的辛苦付出。这一话阿菊的小心思真的太可爱了。"},
        {t:"img", cap:"汉化扉页 · 第17话"},
        {t:"text", v:"结尾那一格的眼神请大家自行体会。一如既往，喜欢本作请支持正版单行本。下载与在线阅读见二楼。"},
        {t:"emoji", v:"（｡･ω･｡）ﾉ♡"},
      ] },
    { floor:2, op:false, user:users.b, time:"40分钟前",
      blocks:[
        {t:"text", v:"沙发！感谢汉化组，这一话的分镜也太会了吧。"},
        {t:"img", cap:"读者贺图"},
      ] },
    { floor:3, op:false, user:users.c, time:"32分钟前",
      blocks:[
        {t:"quote", who:"橘里橘气", v:"这一话的分镜也太会了吧"},
        {t:"text", v:"同意，尤其是中段那个跨页，留白处理得很高级。作者这两年进步肉眼可见。"},
      ] },
    { floor:4, op:false, user:users.e, time:"20分钟前",
      blocks:[
        {t:"text", v:"蹲一个在线阅读，手机端看着方便。再次感谢汉化组！(*ﾟ▽ﾟ*)"},
      ] },
  ];

  // ---- 帖子楼层（按帖确定性生成：1楼=楼主，其余为回复）----
  function _opFloor(thread){
    const blocks = [{t:"text", v: thread.excerpt || "楼主暂未填写正文。"}];
    if(thread.image) blocks.push({t:"img", cap: thread.imgCap || "楼主配图"});
    blocks.push({t:"text", v:"以上为楼主原帖。理性讨论，禁止剧透与上升真人，谢谢配合。"});
    return { floor:1, op:true, user:thread.author, time:thread.time, blocks };
  }
  function _replyBlocks(i, thread){
    const q = (thread.excerpt||"").slice(0,15);
    const V = [
      [{t:"text", v:"沙发！感谢楼主，这一篇真的戳到我了。"}],
      [{t:"text", v:"蹲一个后续，手机端看着方便，先码住慢慢看。"}],
      [{t:"quote", who:thread.author.name, v:q+"…"},{t:"text", v:"这一段我也很有共鸣，留白处理得很高级。"}],
      [{t:"text", v:"理性讨论，不要上升真人。就作品论作品我是赞同楼主的。"},{t:"emoji", v:"(*ﾟ▽ﾟ*)"}],
      [{t:"text", v:"考据了一下，这里其实呼应了前面的伏笔，作者很会埋线。"}],
      [{t:"img", cap:"读者贺图"},{t:"text", v:"手痒画了张图，献丑了～"}],
      [{t:"text", v:"十年老粉路过，谢谢你们陪我到现在，泪目。"}],
      [{t:"text", v:"占楼支持，等更新。楼主加油，不要太监啊！"}],
      [{t:"text", v:"已收藏，写得太好了，求楼主开个长期连载。"}],
    ];
    return V[i % V.length];
  }
  function _opReplyBlocks(i){
    const V = [
      [{t:"text", v:"楼主回来统一回复一下：谢谢大家的支持，看到这么多人喜欢真的很开心～"}],
      [{t:"text", v:"补充一点：前面有同学问到的设定，原帖第二段其实有说明，可以翻回去看看。"}],
      [{t:"text", v:"已经记下大家的建议了，下一话会注意节奏，感谢各位的耐心指正！"}],
      [{t:"text", v:"楼主冒个泡：评论区好热闹，我都一条条看了，抱抱每一位。"}],
    ];
    return V[Math.floor(i/6) % V.length];
  }
  function floorsFor(thread){
    const N = Math.min(thread.replies || 0, 360);  // 上限保护
    const arr = [ _opFloor(thread) ];
    for(let i=0;i<N;i++){
      const opReply = N>=6 && (i+1)%6===0;          // 楼主穿插回帖
      arr.push({
        floor: i+2, op:opReply,
        user: opReply ? thread.author : _uarr[(i+1) % _uarr.length],
        time: _rtimes[i % _rtimes.length],
        blocks: opReply ? _opReplyBlocks(i) : _replyBlocks(i, thread),
      });
    }
    return arr;
  }

  const reminders = [
    {id:"r1", type:"reply", icon:"reply", unread:true, who:"灯子的领带", text:"回复了你的主题「摇曳百合 第八季制作决定」", time:"12分钟前"},
    {id:"r2", type:"at", icon:"at", unread:true, who:"comaki", text:"在「孤独摇滚 算百合吗」中 @ 了你", time:"1小时前"},
    {id:"r3", type:"like", icon:"heart", unread:false, who:"摇曳的向日葵", text:"收藏了你的主题「最治愈的一幕」", time:"3小时前"},
    {id:"r4", type:"sys", icon:"info", unread:false, who:"系统通知", text:"客户端已升级到 v1.0，新增深色模式与离线阅读", time:"昨天"},
  ];

  const dms = [
    {id:"d1", user:users.c, last:"那篇番外我熟肉做好了，晚点发你～", time:"刚刚", unread:2},
    {id:"d2", user:users.a, last:"扉页字体用思源宋体就好，辛苦啦", time:"2小时前", unread:0},
    {id:"d3", user:users.f, last:"婚后日常那个坑我也想接一棒！", time:"昨天", unread:0},
  ];

  return { ME, OTHER, groups, hot, tags, sortModes, threads, threadsFor, fullListFor, floors, floorsFor, reminders, dms, users };
})();
