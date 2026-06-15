// ===================== Reading-mode data (books = chapters) =====================
// Three forum shapes (长篇带链接目录 / 中篇纯文本目录 / 短篇无目录) are all
// abstracted into the same model: a book is a list of chapters; only the OP's
// own posts become body text. Reader replies live per-chapter, off the main flow.

window.BOOKS = (function(){
  const U = window.DATA.users;

  // —— prose pools (warm, restrained 百合 register) ——
  const P = [
    "天台的风比楼下要凉一些。她把校服外套往身上拢了拢，没有回头，却清楚地知道身后那个人一直没走。",
    "「学姐。」她听见自己的声音，比想象中要轻，轻得几乎要被风吹散。说出口的那一刻，她才发现原来有些话攒了那么久，竟也只是这样短短两个字。",
    "放学后的走廊很安静，夕阳把两个人的影子拉得很长，长到几乎要叠在一起。她数着脚下的地砖，一格，又一格，不敢抬头。",
    "其实从很早以前，从那个递来一支铅笔的午后开始，有些东西就已经悄悄变了。只是那时候谁都没有说，谁也都不敢说。",
    "「我没有在生气。」她说，声音却分明带着一点委屈的尾音。对方笑了，伸手替她把被风吹乱的刘海别到耳后，动作自然得像是做过千百遍。",
    "图书馆角落的位置是她们的秘密。书页翻动的声音、笔尖划过纸面的沙沙声、还有偶尔交换一个眼神时那一瞬间的停顿——都被收进同一段安静的下午里。",
    "她一直以为喜欢一个人是热烈的、张扬的，后来才慢慢明白，原来更多的时候，它只是想多看对方一眼，想让对方今天过得好一点，仅此而已。",
    "雨下起来的时候，她们躲进了便利店的屋檐下。关东煮的热气在玻璃上结成一层白雾，她伸出手指，在上面慢慢写下一个名字，又在被看见之前匆匆抹去。",
    "「如果……我是说如果。」她停顿了很久，久到对方以为她不会再说下去，「如果有一天我们不在同一所学校了，你还会记得我吗？」",
    "答案其实她早就知道了。可有些确认，非要亲耳听见才算数。哪怕明知道会脸红，会心跳得厉害，会在很多个夜里反复回想。",
    "教室里只剩下她们两个人。值日的水桶搁在一边，夕光斜斜地铺在课桌上。她忽然觉得，这样的时刻要是能停下来就好了，停在谁都还没有说出口的此刻。",
    "「这个给你。」她把那本翻得起了毛边的小说推过去，封面上有一行被反复抚摸过的字。「我最喜欢的一本，借你看，要还的。」——所以，我们还会再见面，对吧。",
    "她们并肩走在回家的那条小路上，谁都没有再提起白天的事。可十指之间的距离一点点地缩短，最后，一根小指轻轻勾住了另一根。这就够了。",
    "毕业那天，礼堂里放着那首听了三年的曲子。她在人群里一眼就找到了那个身影，对方也正好回过头来，朝她笑了笑，像是说：我在这里。",
    "很多年以后，当她再次路过那座天台，风还是那样凉。她想起那个没能说完的下午，忽然就笑了——原来有些喜欢，是会一直留在原地等人的。",
    "「我喜欢你。」这一次，她没有再把它写在雾气上，也没有再藏进书页里。她看着对方的眼睛，一字一句，认认真真地，把它说了出来。",
  ];

  const QUOTE = [
    {who:"译者注", v:"原文此处用了一个很微妙的助词，直译会失味，这里按语气译作「呐」。"},
    {who:"前情提要", v:"上一话结尾，学姐把那本小说留在了她的课桌里，扉页上写着一行字。"},
  ];

  function body(seed, opening){
    const out = [];
    if(opening) out.push({t:"text", v:opening});
    const n = 6 + (seed*5 % 7);              // 6–12 paragraphs
    for(let k=0;k<n;k++){
      const pi = (seed*3 + k*7) % P.length;
      out.push({t:"text", v:P[pi]});
      if(k===2 && seed%4===0) out.push({t:"img", cap:"插图 · 自绘扉页"});
      if(k===4 && seed%3===1) out.push({t:"quote", who:QUOTE[seed%2].who, v:QUOTE[seed%2].v});
      if(k===1 && seed%5===2) out.push({t:"link", v:"原作者 pixiv 主页", href:"#"});
    }
    return out;
  }

  // —— per-chapter reader comments ——
  const CPOOL = [
    {u:U.b, v:"啊啊啊这一话的留白太会了，看完默默坐了五分钟。"},
    {u:U.d, v:"学姐别走啊！！！楼主你快更新（跪）"},
    {u:U.e, v:"细节控狂喜，别刘海那一下我直接原地去世。"},
    {u:U.f, v:"蹲一个后续，手机上看排版好舒服。"},
    {u:U.c, v:"这段独白写得真好，克制又戳人，收藏了。"},
    {u:U.a, v:"译者辛苦！这一话的语气把握得很准。"},
    {u:U.b, v:"便利店那段……我也想在玻璃上写名字（小声）"},
    {u:U.d, v:"前排，催更使我快乐，作者加油！"},
  ];
  function comments(seed){
    const n = seed%5===0 ? 0 : (1 + (seed*3 % 8));
    const times = ["3分钟前","12分钟前","1小时前","2小时前","昨天","3天前"];
    return Array.from({length:n}, (_,k)=>{
      const c = CPOOL[(seed+k)%CPOOL.length];
      return {id:seed+"-"+k, user:c.u, time:times[(seed+k)%times.length], text:c.v, likes:(seed*2+k*3)%41};
    });
  }

  const SUBS = ["天台上未说出口的话","夕阳、值日与一支铅笔","图书馆角落的秘密","雨檐下的关东煮","被风吹乱的刘海","借你的那本小说","回家路上的那条小路","毕业礼堂里的回头","很多年以后的那阵风","小指勾住小指","白雾上的名字","没有台词的午后","第三人称的她","距离这种东西","盛夏不会结束"];

  function makeChapters(count, prefix, openings){
    return Array.from({length:count}, (_,i)=>{
      const seed = i+1;
      return {
        id: prefix+"-c"+seed,
        no: seed,
        title: "第"+seed+"话 · "+SUBS[i%SUBS.length],
        blocks: body(seed, openings && openings[i]),
        comments: comments(seed),
      };
    });
  }

  // ① 长篇连载（带链接目录）—— 连载中 · 待更新
  const sheng = {
    id:"book_sheng",
    title:"盛夏与她的制服裙",
    author: U.b,
    shape:"长篇连载",
    status:"serial",
    statusText:"连载中",
    updated:"3天前更新 · 第128话",
    intro:"一个关于天台、夕阳和一句迟到了三年的告白的故事。从那个递来铅笔的午后写起，慢慢悠悠，不急着抵达盛夏的尽头。",
    chapters: makeChapters(128, "sheng", {
      0:"那是高一开学第二周的事。她忘了带铅笔，正手足无措的时候，斜后方递过来一支——浅蓝色的、笔身上贴着一小片向日葵贴纸。「给。」对方头也没抬。她道了谢，却在很久以后才明白，那个午后递过来的并不只是一支铅笔。",
    }),
  };

  // ② 中篇连载（纯文本目录，无链接）/ 译文 —— 全 5 话完
  const sun = {
    id:"book_sun",
    title:"向日葵不会说谎",
    author: U.a,
    shape:"中篇译文",
    status:"complete",
    statusText:"完结",
    updated:"已完结",
    intro:"经原作者授权翻译。一个关于盛夏、向日葵田与两个女孩的故事。共五话，已全部完结。",
    chapters: makeChapters(5, "sun", {
      0:"夏天是从向日葵田开始的。那一年我十六岁，第一次见到她的时候，她正站在一整片金黄里，逆着光，伸手去够一朵比她还高的向日葵。她回过头，问我：「你也是来看花的吗？」",
    }),
  };

  // ③ 短篇（无目录，整篇在首楼）—— 单章 · 完结
  const kanto = {
    id:"book_kanto",
    title:"便利店关东煮与她的第十七个冬天",
    author: U.f,
    shape:"短篇",
    status:"complete",
    statusText:"完结",
    updated:"已完结",
    intro:"三千字的小品。关于一份总是多买一份的关东煮，和一句始终没说出口的话。",
    chapters: (function(){
      const seed=8;
      return [{
        id:"kanto-c1", no:1, title:"便利店关东煮与她的第十七个冬天",
        blocks: body(seed, "便利店的关东煮一到冬天就卖得特别好。她每天放学都会拐进去，买两份——一份萝卜，一份鱼饼。萝卜是她自己的，鱼饼是给那个总是比她晚到十分钟的人留的。"),
        comments: comments(seed),
      }];
    })(),
  };

  const map = { book_sheng:sheng, book_sun:sun, book_kanto:kanto };
  return {
    map,
    get(id){ return map[id]; },
    chapterCountText(b){ return b.shape==="短篇" ? "短篇" : ("全 "+b.chapters.length+" 话"); },
  };
})();
