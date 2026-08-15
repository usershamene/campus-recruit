// js/profiles.js — 企业简介懒加载模块
// 从 index.html 拆出（P2-2 架构优化），自包含，无依赖
// 暴露全局：companyProfiles / ensureCompanyProfiles() / getCompanyProfile(name)

// ── Company Profiles (pre-generated) ──
// companyProfiles: null = 未加载（懒加载）；加载后为对象
let companyProfiles = null;
let _profilesPromise = null;
const PROFILE_BRANDS = ['新东方','中国移动','拼多多','蔚来','安踏','OPPO','vivo','腾讯','百度','京东','美团','字节跳动','华为','荣耀','小红书','快手','哔哩哔哩','蚂蚁集团','科大讯飞','好未来','华图教育','理想汽车','海尔','小鹏','招商银行','交通银行','宁波银行','中信银行','华泰证券','中信证券','国信证券','长江证券','开源证券','东方财富','申万宏源','中国化学','中国电科','中国能建','中国电信','中国联通','昂纳科技','虹科','博西家电','施耐德','戴尔','多益网络','华勤技术','无忧传媒','歌尔','李宁','森马','传音控股','宇通集团','春秋航空','吉利','三一集团','安利','沃尔沃','特斯拉','上汽通用','博世','万豪','汇丰银行','诺华','达能','荷美尔','美泰','芬欧汇川','杜邦','英科','溢达','豪迈','中天科技','三生制药','景旺电子','深南电路','士兰半导体','源氏木语','当虹科技','浩鲸科技','杰士德集团','天士力','安富利','百多力','森玛仕','锐捷网络','德力西','宝宝巴士','恒瑞','帆软','大参林','奥马冰箱','物产中大','青山实业','养生堂','复星医药','恒越基金','海信','启明创投','轻舟智航','臻驱科技','嘉立创','紫金山实验室','中国商飞','华工科技','中创新航','华润','格力','顺丰','大华股份','致欧家居','用友','诗悦网络','龙蟠科技','朴朴','北方华创','鼎桥技术','海兴电力','英科医疗','金科服务','正浩EcoFlow','韶音科技','图拉斯','卡游动漫','积加科技','峰岹科技','安谋科技','广药集团','中国建研院','联通华盛','数字浙江','神龙汽车','毕马威','万得','中汇信息','中华商务','中核龙安','奥乐齐','搜狐','中车永济','史丹利','新忆科技','湖北农业发展','湖南盐业','中粮信托','中国有研','中国三峡能源','中国重型机械','中信兴业','艾宾信息','天津海河设计','ZENO芝诺','众成清泰','广州市交通规划','惠州交投','甘肃科技','岚图汽车','百图生科','美敦力','凯瑞斯德','视客眼镜','舜宇','工业富联','重庆鸽牌','山东九羊','国家电投','诚通证券','Ratingdog','高途','邦泰集团','微派','苇航教育','启胜','瑞诺技术','杰拉电竞','华耀智合','百多力','安富利','贵州中烟','中国电信','中国联通','中国邮政储蓄银行','中信银行','申万宏源','华泰证券','国信证券','长江证券','开源证券','东方财富','招商银行','交通银行','宁波银行','长沙银行','中国光大银行','恒越基金','中粮信托','诚通证券','汇丰银行','中信证券'];

// 懒加载：company-profiles.json（2.3MB）仅在首次需要时拉取，避免拖慢首屏

function ensureCompanyProfiles() {
  if (companyProfiles) return Promise.resolve(companyProfiles);
  if (_profilesPromise) return _profilesPromise;
  _profilesPromise = fetch('data/company-profiles.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(d => { companyProfiles = d; return d; })
    .catch(e => { _profilesPromise = null; console.error('[profiles] 加载失败:', e); throw e; });
  return _profilesPromise;
}

function getCompanyProfile(companyName) {
  if (companyProfiles[companyName]) return companyProfiles[companyName];
  // Fallback 1: strip common suffixes
  const cleaned = companyName
    .replace(/[-–—]\s*(补录|急招|新增岗位|岗位扩招|岗位扩容|剩余岗位|末班车|倒计时|精选岗位|线上实习|春招|秋招|校招|开放日|专场|第二批|第三批|第四批|公告[三四五六七八九]|扩招|实习|招募|管培|专科|新增研发岗位|紧急招人|线上专场|海外留学生招聘|海外技术类|基础研究部|AI实习生专项|顶尖人才\s*项目|顶尖人才专项|破界计划|英才计划|千帆计划|云弧计划|星辰计划|寻梦实习|逐梦计划|马当路练习生|BML|营销专项|法律助理岗|智能驾驶|物流与制造领域专场|小语种专场|理工科专场|战略实习生项目|菁兵维保实习生|数字金融训练营|转正实习|企业服务团队|急招岗位|岗位补录|战略与投资平台|AI原生工程师)[\s]*/g, '')
    .replace(/[\(（]\s*(第[一二三四五六七八九十]+[次阶段批]|补录|社招\+?|实习|春招|秋招|校招|专科|博士岗位|剩余岗位|末班车|IT岗位专场|化工专场|急招|营销体系|新增岗位|第二波|核心岗位|国际发行部|旗下)\s*[\)）]/g, '')
    .replace(/[\(（]\s*[一二三四五六七八九十]+\s*[\)）]/g, '');
  if (cleaned !== companyName && companyProfiles[cleaned]) return companyProfiles[cleaned];
  // Fallback 2: match parent brand
  for (const brand of PROFILE_BRANDS) {
    if (companyName.includes(brand) && companyProfiles[brand]) return companyProfiles[brand];
  }
  return null;
}
