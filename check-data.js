const fs = require('fs');
const jobs = JSON.parse(fs.readFileSync('./data/jobs.json', 'utf-8'));

console.log('=== 数据质量检查 ===\n');

// 检查乱码
const garbled = jobs.filter(j => j.location && j.location.includes('�'));
console.log(`乱码: ${garbled.length} 条`);
garbled.forEach(j => console.log(`  ${j.id} ${j.company}: ${j.location}`));

// 检查城市拼接（>4字符且无后缀）
const concatenated = jobs.filter(j => {
  if (!j.location) return false;
  return j.location.split(/[,，、/|；;\s]+/).some(p => {
    p = p.trim();
    return p.length > 4 && !/[州县区市盟旗]/.test(p) && !p.includes('...') && p !== '-' && p !== '&' && p !== '全国' && p !== '海外';
  });
});
console.log(`\n城市拼接: ${concatenated.length} 条`);
concatenated.forEach(j => console.log(`  ${j.id} ${j.company}: ${j.location}`));

// 检查岗位名无顿号且>20字符
const noSep = jobs.filter(j =>
  j.positions && j.positions.length > 20 && !j.positions.includes('、') && !j.positions.includes('，') && !j.positions.includes(',')
);
console.log(`\n岗位无顿号: ${noSep.length} 条`);
noSep.forEach(j => console.log(`  ${j.id} ${j.company}: ${j.positions.substring(0, 50)}`));

const total = garbled.length + concatenated.length + noSep.length;
console.log(`\n${total === 0 ? '✅ 数据质量良好' : `⚠️ 共 ${total} 条需要关注`}`);
