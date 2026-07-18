const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const META_PATH = path.join(__dirname, 'data', 'update-meta.json');
const JOBS_PATH = path.join(__dirname, 'data', 'jobs.json');

function fetch(url, options = {}, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', ...options.headers },
      timeout: 15000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetch(newUrl, options, redirectCount + 1).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Load metadata ──
function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return { lastUpdate: null };
  }
}

function saveMeta(date) {
  fs.writeFileSync(META_PATH, JSON.stringify({ lastUpdate: date, success: true }, null, 2), 'utf-8');
}

// ── DeepOffer ──
async function fetchDeepOffer(sinceDate) {
  console.log('[deepoffer] Fetching...');
  const jobs = [];
  let offset = 0;
  const pageSize = 20;
  let total = Infinity;
  let emptyCount = 0;
  const maxPages = 50;
  let pages = 0;

  while (offset < total && pages < maxPages) {
    try {
      const { status, data } = await fetch(`https://deepoffer.cn/api/v1/jobs?offset=${offset}&limit=${pageSize}`);
      if (status !== 200) { await sleep(2000); continue; }
      const json = JSON.parse(data);
      total = json.data.total;
      const items = json.data.items || [];
      if (items.length === 0) { emptyCount++; if (emptyCount >= 3) break; await sleep(1000); offset += pageSize; continue; }
      emptyCount = 0;

      for (const item of items) {
        const pubDate = item.update_date || '';
        // Stop if data is older than sinceDate
        if (sinceDate && pubDate && pubDate < sinceDate) { offset = total; break; }
        jobs.push({
          source: 'deepoffer', publishDate: pubDate,
          company: item.company_name || item.company || '',
          positions: item.positions || item.title || '',
          location: item.work_location || item.location || '',
          deadline: item.deadline || '',
          applyUrl: item.apply_url || '',
          announcementUrl: item.announcement_url || '',
          companyType: item.company_type || '',
          industry: item.industry || '',
          recruitmentType: item.recruitment_type || '',
        });
      }
      offset += pageSize;
      pages++;
      process.stdout.write(`\r[deepoffer] ${jobs.length} records`);
      await sleep(100);
    } catch (e) {
      console.error(`\n[deepoffer] Error:`, e.message);
      break; // certificate errors etc — stop immediately
    }
  }
  console.log(`\n[deepoffer] Done: ${jobs.length} records`);
  return jobs;
}

// ── 求职方舟 ──
async function fetchQiuzhifangzhou(daysBack) {
  console.log(`[qiuzhifangzhou] Fetching ${daysBack} days...`);
  const jobs = [];
  const today = new Date();

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    try {
      const { status, data } = await fetch('https://api.qiuzhifangzhou.com/api/campus/getCampusList', {
        method: 'POST',
        body: { dateList: [{ date: dateStr, md5: 'd41d8cd98f00b204e9800998ecf8427e' }] },
      });
      if (status !== 200) continue;
      const json = JSON.parse(data);
      for (const day of (json.campusList || [])) {
        for (const item of (day.datas || [])) {
          jobs.push({
            source: 'qiuzhifangzhou', publishDate: dateStr,
            company: item.company || '',
            positions: item.positions || '',
            location: item.locations || '',
            deadline: item.deadline || '',
            applyUrl: item.applyUrl || '',
            announcementUrl: item.noticeUrl || '',
            companyType: (item.typeTag || []).join(','),
            industry: item.industry || '',
            recruitmentType: item.batch || '',
          });
        }
      }
      process.stdout.write(`\r[qiuzhifangzhou] ${jobs.length} records (day ${i + 1}/${daysBack})`);
    } catch (e) { /* skip */ }
  }
  console.log(`\n[qiuzhifangzhou] Done: ${jobs.length} records`);
  return jobs;
}

// ── OfferStar (HTML) ──
async function fetchOfferstar() {
  console.log('[offerstar] Fetching HTML...');
  try {
    const { status, data: html } = await fetch('https://www.offerstar.cn/recruitment');
    if (status !== 200) { console.log('[offerstar] Failed:', status); return []; }

    const jobs = [];
    const regex = /\{\\?"_id\\?":\\?"[^"]+\\?",[\s\S]*?\}/g;
    for (const m of (html.match(regex) || [])) {
      try {
        const obj = JSON.parse(m.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
        if (obj._id && obj.company) {
          jobs.push({
            source: 'offerstar',
            publishDate: obj.createTime ? new Date(obj.createTime).toISOString().split('T')[0] : '',
            company: obj.company || '',
            positions: obj.positions || obj.title || '',
            location: (obj.normalizedWorkLocations || []).join(',') || obj.workLocation || '',
            deadline: obj.deadline || '',
            applyUrl: obj.referralMethod || '',
            announcementUrl: '',
            companyType: '',
            industry: obj.industry || '',
            recruitmentType: obj.channel || '',
          });
        }
      } catch {}
    }
    console.log(`[offerstar] Done: ${jobs.length} records`);
    return jobs;
  } catch (e) {
    console.error('[offerstar] Error:', e.message);
    return [];
  }
}

// ── Deduplicate ──
function deduplicate(existing, newJobs) {
  const seen = new Map();
  // Index existing by key
  for (const job of existing) {
    const key = `${job.company}|${job.positions}`.toLowerCase().replace(/\s+/g, '');
    seen.set(key, job);
  }
  // Merge new
  for (const job of newJobs) {
    const key = `${job.company}|${job.positions}`.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) {
      seen.set(key, job);
    } else {
      const old = seen.get(key);
      if (!old.applyUrl && job.applyUrl) old.applyUrl = job.applyUrl;
      if (!old.announcementUrl && job.announcementUrl) old.announcementUrl = job.announcementUrl;
      if (!old.deadline && job.deadline) old.deadline = job.deadline;
      if (!old.location && job.location) old.location = job.location;
    }
  }
  return [...seen.values()];
}

// ── Process: normalize, remove expired, clean ──
const TYPE_MAP = {
  // 春招系列 → 统一归入春招/补录
  '26春招': '春招', '26届春招': '春招', '27春招': '春招',
  '25春招': '春招', '24春招': '春招', '23春招': '春招', '29春招': '春招',
  // 秋招系列 → 统一归入秋招/提前批
  '26秋招': '秋招', '27秋招': '秋招', '27届实习': '日常实习',
  '27提前批': '提前批', '26提前批': '提前批',
  // 实习
  '日常实习': '日常实习', '暑期实习': '暑期实习',
  // 基础类型
  '提前批': '提前批', '补录': '补录', '实习': '日常实习', '校招': '校招', '专岗': '其他',
  '春招': '春招', '春招补录': '补录',
};

// ── 国企判定 ──
// 省级/地级市行政区划（用于判断公司名以地名开头）
const PROVINCES = ['北京','天津','上海','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','台湾','内蒙古','广西','西藏','宁夏','新疆','香港','澳门'];
const CITIES = ['石家庄','唐山','秦皇岛','邯郸','邢台','保定','张家口','承德','沧州','廊坊','衡水','太原','大同','阳泉','长治','晋城','朔州','晋中','运城','忻州','临汾','吕梁','沈阳','大连','鞍山','抚顺','本溪','丹东','锦州','营口','阜新','辽阳','盘锦','铁岭','朝阳','葫芦岛','长春','吉林','四平','辽源','通化','白山','松原','哈尔滨','齐齐哈尔','鸡西','鹤岗','双鸭山','大庆','绥化','通辽','赤峰','包头','鄂尔多斯','呼伦贝尔','巴彦淖尔','乌兰察布','呼和浩特','乌海','银川','石嘴山','吴忠','固原','中卫','西宁','拉萨','日喀则','昌都','林芝','山南','那曲','阿里','海口','三亚','儋州','南宁','柳州','桂林','梧州','北海','防城港','钦州','贵港','玉林','百色','贺州','河池','来宾','崇左','贵阳','六盘水','遵义','安顺','铜仁','黔东南','黔南','黔西南','昆明','曲靖','玉溪','保山','昭通','丽江','普洱','临沧','德宏','怒江','迪庆','大理','西双版纳','成都','自贡','攀枝花','泸州','德阳','绵阳','广元','遂宁','内江','乐山','南充','眉山','宜宾','广安','达州','雅安','毕节','文山','红河','拉萨','贵阳','昆明','南宁','海口','福州','厦门','莆田','三明','泉州','漳州','南平','上饶','抚州','吉安','宜春','萍乡','九江','新余','赣州','合肥','芜湖','蚌埠','淮南','马鞍山','淮北','铜陵','安庆','黄山','滁州','阜阳','宿州','六安','亳州','池州','宣城','南昌','景德镇','萍乡','九江','新余','鹰潭','赣州','吉安','宜春','抚州','上饶','济南','青岛','淄博','枣庄','东营','烟台','潍坊','济宁','泰安','威海','日照','临沂','德州','聊城','滨州','菏泽','郑州','开封','洛阳','平顶山','安阳','鹤壁','新乡','焦作','濮阳','许昌','漯河','三门峡','南阳','商丘','信阳','周口','驻马店','武汉','黄石','十堰','宜昌','襄阳','鄂州','荆门','孝感','荆州','黄冈','咸宁','随州','恩施','长沙','株洲','湘潭','衡阳','邵阳','岳阳','常德','张家界','益阳','郴州','永州','怀化','娄底','湘西','广州','韶关','深圳','珠海','汕头','佛山','江门','湛江','茂名','肇庆','惠州','梅州','汕尾','河源','阳江','清远','东莞','中山','潮州','揭阳','云浮','泉州','南宁','柳州','桂林','海口','三亚'];

// 排除词：民企/外企/商业机构（精确匹配，避免误伤）
const SOE_EXCLUDE = [
  '教育培训机构','家教','辅导','补习','网校','在线教育','教育科技','教育集团','学习教育','素质教育','职业教育培训','早教','幼教培训','少儿英语','K12','应试培训','考公培训','考研培训','升学培训','语言培训','外教','双语教学','启蒙教育','兴趣教育','艺术培训','美术培训','音乐培训','舞蹈培训','体育培训','围棋培训','书法培训',
  '机器人','智能','半导体','芯片','集成电路','微电子','新能源','新材料','环保','节能','碳','排放',
  '基金','私募','创投','风投','VC','PE',
  '药','制药','生物','医学','临床','检验','检测',
  '汽车','造车','轮胎','橡胶','汽配','车桥','摩托',
  '食品','餐饮','饮料','乳业','农牧','养殖','饲料','农业','种业','化肥','农药',
  '服装','服饰','鞋','包','美妆','日化','护肤','化妆品','香水','洗护','母婴','婴童','玩具','潮玩','盲盒','手办','模型','积木',
  '咖啡','奶茶','茶饮','饮品','烘焙','蛋糕','面包','甜点','甜品','冰淇淋','雪糕','冰激凌',
  '快递','物流','货运','客运','运输','仓储','供应链管理',
  '互联网','APP','应用','小程序','平台','社区','论坛','博客','微博','微信',
  '夏普','电装','壳牌','拜耳','雅培','法雷奥','斯伦贝谢','德州仪器','Marvell','恩智浦','阿斯麦','光刻','ASML',
  '欧莱雅','Lancome','雅诗兰黛','兰蔻','迪奥','Dior','圣罗兰','YSL',
  '网易','阿里','字节','百度','京东','拼多多','美团','滴滴','快手','携程','小红书','知乎','豆瓣','哔哩哔哩','B站','Bilibili',
  '小米','OPPO','vivo','一加','荣耀','华为','大疆','DJI',
  '蔚来','小鹏','理想','零跑','哪吒','极氪','岚图','问界','智己','飞凡','高合','威马','天际','爱驰','拜腾','前途',
  '新石器','云鲸','追觅','石头','科沃斯','小狗','莱克','必胜','飞利浦','松下','索尼','三星','LG','博世','西门子','施耐德','ABB','霍尼韦尔',
  '安踏','李宁','特步','361','匹克','鸿星尔克','乔丹','探路者','凯乐石','伯希和','挪客','牧高笛','火枫','迪卡侬',
  '方太','老板','华帝','美的','格力','海尔','海信','TCL','创维','康佳','长虹','厦华','熊猫',
  '康师傅','统一','今麦郎','白象','三全','思念','湾仔码头','安井','海欣','国联','绝味','周黑鸭','煌上煌','紫燕','来伊份','良品铺子','三只松鼠','百草味','沃隆','洽洽','甘源',
  '瑞幸','星巴克','Manner','Seesaw','M Stand','永璞','鹰集','连咖啡','库迪','Cotti','喜茶','奈雪','茶颜','霸王茶姬','古茗','茶百道','沪上阿姨','1点点','CoCo','蜜雪冰城','甜啦啦','书亦','益禾堂','丘大叔','爷爷不泡茶','茉莉奶白','喜姐','夸父','张亮','杨国福','马记永','陈香贵','张拉拉','牛约堡','牛街',
  '贝壳','链家','我爱我家','中原','世茂','融创','万科','恒大','碧桂园','金地','龙湖','华润','招商','越秀','深业','天健','岭南','城建','绿城','远洋','首开','泰禾','中骏','禹洲','弘阳','金茂','招商蛇口','华润置地','中海地产','保利发展','中国金茂','中国奥园','雅居乐','时代中国','龙光','合景','泰富','阳光城','建发','国贸','华发',
  '卓越','平行线','晓禾','星火','治乾','文卓','壹思唯','外教社','新东方','学而思','猿辅导','作业帮','好未来','跟谁学','高途','沪江','有道','乐其',
  '歌尔','舜宇','立讯','蓝思','伯恩','华星光电','京东方','维信诺','和辉','彩虹','天马','信利',
  '顺丰','京东物流','菜鸟','中通','圆通','申通','韵达','极兔','百世','德邦','安能','天地华宇','壹米滴答','快狗','货拉拉','满帮','路歌','G7',
  '58','赶集','百姓网','安居客','房天下','乐居','搜狐焦点','新浪乐居',
  '途虎','养车','车享家','瓜子','二手车','优信','人人车','淘车',
  '滴滴','顺风车','哈啰','青桔','美团单车','永安行','摩拜','ofo','小黄车','小蓝车',
  '饿了么','蜂鸟','盒马','生鲜','新零售','山姆','会员','Costco','沃尔玛','家乐福','麦德龙','卜蜂莲花','大润发','永辉','华润万家','物美','京客隆','红旗','联华','华联',
  '名创优品','MINISO','KKV','调色师','WOW',
  '屈臣氏','万宁','莎莎','丝芙兰','海澜之家','海澜','七匹狼','九牧王','柒牌','虎都',
  '优衣库','GU','ZARA','H&M','UR','C&A',
  '耐克','Nike','阿迪达斯','Adidas','Puma','Reebok','New Balance','Asics','Skechers','Fila','Kappa',
  '乐读','tap4fun','海艺互娱','点点互动','FunPlus','多益网络','游族','莉莉丝','米哈游','叠纸','鹰角','库洛','散爆','沐瞳','朝夕光年','天美','光子','北极光','魔方','育碧','EA','动视','暴雪','微软','任天堂','世嘉','SNK','卡普空','光荣','科乐美','万代南梦宫','史克威尔艾尼克斯','艺电',
  '管理咨询','财务咨询','法律咨询','人力资源服务',
  '娱乐','影视','游戏','动漫','广告','营销','公关','品牌',
  '连锁','零售','商贸','贸易','进出口','房产','房地产','物业','家政','劳务','外包','派遣',
  '旅行社','景区','会展',
  '摩根士丹利','高盛','贝恩','麦肯锡','波士顿咨询','罗兰贝格','埃森哲','德勤','普华永道','安永','毕马威','四大会计师事务所',
  '雀巢','安利','大众汽车','丹纳赫','阿特拉斯','卡地亚','路易威登','爱马仕','Chanel','Gucci','Prada','Burberry','Hermes','Cartier','Tiffany','Bvlgari','VanCleef','Piaget','Rolex','Omega','TAGHeuer','Breitling','IWC','JaegerLeCoultre','VacheronConstantin','AudemarsPiguet','Panerai','Hublot','RichardMille','RogerDubuis','UlysseNardin','Chopard','Montblanc','浪琴','Longines','美度','Mido','天梭','Tissot','斯沃琪','Swatch','西铁城','Citizen','精工','Seiko','东方双狮','Orient','卡西欧','Casio','罗西尼','雷达','Rado','依波','Ebohr','飞亚达','Fiyta','海鸥','Sea-Gull',
];

function isSOE(companyName, applyUrl, announceUrl) {
  if (!companyName) return false;
  if (SOE_EXCLUDE.some(kw => companyName.includes(kw))) return false;

  // 规则1：明显标志词（国资/国有/国家/国资委等）— 不论位置
  const explicitSignals = ['国资','国有','国资委','国有资本','市属国企','区属国企','县属国企','省属国企','市国企','省属国企'];
  if (explicitSignals.some(s => companyName.includes(s))) return true;

  // 规则2：公司名以行政区划开头 → 国企特征（排除已知的民企/外企）
  const provMatch = PROVINCES.filter(p => companyName.startsWith(p));
  const cityMatch = CITIES.filter(c => companyName.startsWith(c));
  if (provMatch.length > 0 || cityMatch.length > 0) {
    // 地名开头 + 不含排除词 → 大概率国企
    // 排除：阿里（阿里巴巴）、德州仪器、新东方等已在 SOE_EXCLUDE 中
    return true;
  }

  // 规则3：投递/公告链接含 gov.cn 或 seac（国家移民管理局）等政府域名
  const link = (applyUrl || '') + ' ' + (announceUrl || '');
  if (/\.(gov\.cn|gov\.hk|gov\.mo|gov\.tw)/.test(link)) return true;
  if (/\/seac\//.test(link)) return true;

  // 规则4：强信号（城投/交投/地铁/水务/中铁/中建等）
  const strongSignals = [
    '城投','水投','铁投','交控','交投','产投','农投','能投','投控','金控','科创投',
    '电网','铁路','机场','港口','航道','高速',
    '水务','公交','地铁','供水','供气','供热','燃气',
    '农信','农商行','农发行','国开行',
    '中铁','中建','中交','中核','中石化','中石油','中航','中粮','中远','中海',
    '中信','中化','中电','中烟','中旅','中车','中油','中储','中冶','中节能','中智',
    '中轻','中纺','中盐','中金','中煤','中船',
    '事业单位','行政机关','管委会',
    '局','委','办','厅','处',
  ];
  if (strongSignals.some(s => companyName.includes(s))) return true;

  // 规则5：央企前缀（中国/中华/国家/中央）+ 机构词
  const hasChinaPrefix = ['中国','中华','国家','中央'].some(p => companyName.includes(p));
  const institutionWords = ['院','所','中心','银行','保险','证券','信托','电信','移动','联通','邮政','民航','气象','铁路','公路','航道','港口','码头','航运','海运','航天','航空','电科','发电','核电','水电','火电','风电','光伏','燃气','水务','地铁','公交','西电','电工','电气','电力'];
  const hasInstitution = institutionWords.some(s => companyName.includes(s));
  if (hasChinaPrefix && hasInstitution) return true;

  // 规则6：弱信号 ≥ 2（银行+保险、邮政+电信等组合）
  const weakSignals = [
    '中国','中华','国家','全国','中央',
    '银行','保险','证券','信托','理财','院','所','中心',
    '电信','移动','联通','铁塔','邮政','烟草','民航','气象',
    '公路','港口','码头','航运','海运','航天','航空','电科','西电','电工','电气','电力',
    '发电','核电','水电','火电','风电','光伏',
  ];
  const weakMatched = weakSignals.filter(s => companyName.includes(s));
  if (weakMatched.length >= 2) return true;

  return false;
}

// ── 岗位名智能分隔 ──
function splitPositions(text) {
  if (!text) return text;
  // 如果已经有顿号分隔，直接返回
  if (/[、，,]/.test(text)) return text;

  // 先处理括号内的内容（避免误分隔）
  let result = text;
  const brackets = [];
  result = result.replace(/[（(][^）)]*[）)]/g, (m) => {
    brackets.push(m);
    return `__BR${brackets.length - 1}__`;
  });

  // 将空格替换为顿号
  result = result.replace(/\s+/g, '、');

  // 岗位后缀关键词（排除容易误匹配的：类、开发、测试、岗、管理）
  const suffixes = '工程师|经理|专员|助理|岗位|方向|管培生|培训生|研究员|设计师|分析师|实习生|教师|教练|顾问|主管|总监|副总|总裁|会计|出纳|审计|法务|律师|编辑|记者|运营|销售|客服|前台|秘书|文员|司机|保安|保洁|厨师|护士|医生|药师|技工|技师|工人|师傅|职类|业务|承做|人员|序列|咨询';
  // 在后缀后面添加顿号（如果后面紧跟中文或英文）
  const regex = new RegExp(`(${suffixes})(?=[一-龥a-zA-Z])`, 'g');
  result = result.replace(regex, '$1、');

  // 恢复括号内容
  result = result.replace(/__BR(\d+)__/g, (_, i) => brackets[parseInt(i)]);

  // 清理多余的顿号
  result = result.replace(/、+/g, '、').replace(/、$/, '');
  return result;
}

function inferType(job) {
  // 组合所有文本用于推断
  const text = [
    job.recruitmentType || '',
    job.company || '',
    job.positions || '',
    job.announcementUrl || '',
  ].join(' ');

  // 1. 明确标注的年份+类型 → 统一去掉届数
  if (/27秋招|27届秋招|27秋/.test(text)) return '秋招';
  if (/26秋招|26届秋招|26秋/.test(text)) return '秋招';
  if (/27提前批|27届提前批/.test(text)) return '提前批';
  if (/26提前批|26届提前批/.test(text)) return '提前批';
  if (/27实习|27届实习/.test(text)) return '日常实习';

  // 2. 秋招/提前批
  if (/秋招|秋季招聘|秋招提前批/.test(text)) return '秋招';
  if (/提前批|早鸟|SP\.SP|SSP/.test(text)) return '提前批';

  // 3. 实习
  if (/日常实习|日常实习/.test(text)) return '日常实习';
  if (/暑期实习|暑实习|Summer Intern/.test(text)) return '暑期实习';
  if (/实习|internship|实习生/.test(text)) return '日常实习';

  // 4. 春招相关
  if (/春招补录|春季补录/.test(text)) return '补录';
  if (/26春招|26届春招/.test(text)) return '春招';
  if (/27春招|27届春招/.test(text)) return '春招';
  if (/春招|春季招聘/.test(text)) return '春招';

  // 5. 补录
  if (/补录|扩招|追加招聘|第二批|第三批|第四批|第五批/.test(text)) return '补录';

  // 6. 校招兜底
  if (/校招|校园招聘|社会招聘|社招/.test(text)) {
    return /社会招聘|社招/.test(text) ? '其他' : '校招';
  }

  return '校招';
}

function processData(jobs) {
  const today = new Date().toISOString().split('T')[0];

  const cleaned = jobs.filter(job => {
    const fields = [job.company, job.positions, job.location, job.applyUrl, job.announcementUrl];
    const hasLoginWall = fields.some(f => f && /登录后可见/.test(f));
    if (hasLoginWall) {
      console.log(`  [filtered] ${job.company} / ${job.source}`);
      return false;
    }
    return true;
  });
  const loginWallCount = jobs.length - cleaned.length;

  for (const job of cleaned) {
    const rawType = (job.recruitmentType || '').trim();
    // 1. 国企判定优先
    if (isSOE(job.company, job.applyUrl, job.announcementUrl)) {
      job.recruitmentType = '国企招聘';
      continue;
    }
    // 2. TYPE_MAP 规范化
    job.recruitmentType = TYPE_MAP[rawType] || rawType;
    // 3. 修正年份标记错误的春招
    if (/^2\d春招$/.test(job.recruitmentType)) {
      job.recruitmentType = '春招';
    }
    // 4. 数据源类型不明确或为空，从标题/岗位名推断
    if (!rawType || !TYPE_MAP[rawType]) {
      job.recruitmentType = inferType(job);
    }
    // 5. 数据源类型存在但推断更具体，优先使用推断
    if (rawType && TYPE_MAP[rawType]) {
      const inferred = inferType(job);
      if (inferred !== '校招' && inferred !== rawType) {
        job.recruitmentType = inferred;
      }
    }
  }

  const filtered = cleaned.filter(job => {
    const dl = (job.deadline || '').trim();
    if (!dl || dl === '尽快投递' || dl === '-') return true;
    return dl.replace(/\//g, '-') >= today;
  });

  for (const job of filtered) {
    let p = (job.positions || '').trim();
    p = p.replace(/[,，、;；\s]+$/, '');
    p = p.replace(/^本次共[计招聘]*\d+人[、，,]?\s*/, '');
    if (/^具体.*详见附件/.test(p)) p = '详见公告';
    // 智能分隔岗位名
    p = splitPositions(p);
    if (p.length > 80) p = p.substring(0, 80) + '...';
    job.positions = p;
  }

  filtered.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
  filtered.forEach((job, i) => { job.id = i + 1; });
  return { processed: filtered, loginFiltered: loginWallCount, expired: cleaned.length - filtered.length };
}

// ── Main ──
async function main() {
  console.log('=== Campus Recruitment Incremental Update ===\n');

  const meta = loadMeta();
  const lastUpdate = meta.lastUpdate ? new Date(meta.lastUpdate) : null;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Calculate days to fetch
  let daysBack = 7; // default: 1 week
  if (lastUpdate) {
    const diffMs = now - lastUpdate;
    daysBack = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 2); // +1 day buffer, min 2
  }
  const sinceDate = lastUpdate ? lastUpdate.toISOString().split('T')[0] : null;
  console.log(`Last update: ${sinceDate || 'never'}`);
  console.log(`Fetching: ${daysBack} days back\n`);

  // Fetch new data
  const [deepoffer, qiuzhifangzhou, offerstar] = await Promise.all([
    fetchDeepOffer(sinceDate),
    fetchQiuzhifangzhou(daysBack),
    fetchOfferstar(),
  ]);

  console.log('\n=== 抓取结果 ===');
  console.log(`求职方舟: ${qiuzhifangzhou.length} 条（${daysBack} 天）`);
  console.log(`OfferStar: ${offerstar.length} 条`);
  console.log(`DeepOffer: ${deepoffer.length} 条`);
  console.log(`本次抓取合计: ${qiuzhifangzhou.length + offerstar.length + deepoffer.length} 条`);

  const newJobs = [...deepoffer, ...qiuzhifangzhou, ...offerstar];

  // Load existing data
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8')); } catch {}
  const existingCount = existing.length;

  // Merge & dedup
  const merged = deduplicate(existing, newJobs);
  const addedCount = merged.length - existingCount;

  // Process: normalize, remove expired, clean
  const { processed, loginFiltered, expired } = processData(merged);
  const expiredCount = expired;

  console.log('\n=== 增量更新结果 ===');
  console.log(`原有数据: ${existingCount} 条`);
  console.log(`本次新增: ${addedCount} 条`);
  console.log(`登录墙过滤: ${loginFiltered} 条`);
  console.log(`过期移除: ${expiredCount} 条`);
  console.log(`最终总量: ${processed.length} 条`);

  // Stats
  const typeStats = {};
  processed.forEach(j => { typeStats[j.recruitmentType] = (typeStats[j.recruitmentType] || 0) + 1; });
  console.log('\n=== 类型分布 ===');
  Object.entries(typeStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v + '\t' + k));

  // Save
  fs.writeFileSync(JOBS_PATH, JSON.stringify(processed, null, 2), 'utf-8');
  saveMeta(now.toISOString());
  console.log(`\nSaved: ${JOBS_PATH}`);
  console.log(`Next update will fetch from: ${todayStr}`);

  // Identify NEW companies without profiles (only from this update)
  const profilesPath = path.join(__dirname, 'data', 'company-profiles.json');
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8')); } catch {}
  const existingCompanySet = new Set(existing.map(j => j.company));
  const newCompanies = [...new Set(processed.filter(j => !existingCompanySet.has(j.company)).map(j => j.company))];
  const missingNew = newCompanies.filter(c => !profiles[c]);
  const pendingPath = path.join(__dirname, 'data', 'pending-profiles.json');
  if (missingNew.length > 0) {
    fs.writeFileSync(pendingPath, JSON.stringify(missingNew, null, 2), 'utf-8');
    console.log(`\n⚠ ${missingNew.length} new companies need profiles → data/pending-profiles.json`);
    console.log(`ACTION_REQUIRED: GENERATE_PROFILES`);
  } else {
    fs.writeFileSync(pendingPath, JSON.stringify([], null, 2), 'utf-8');
    console.log('\n✓ All new companies have profiles');
  }
}

main().catch(console.error);
