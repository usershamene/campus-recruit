// js/cloud-sync.js — Supabase 云同步模块
// 从 index.html 拆出（P2-2 架构优化），依赖全局 sb/currentUser/progressRecords/offers
// 必须在 index.html 主脚本之后加载（依赖 saveProgress/saveOffers 定义）

// ── Cloud Sync ──

// 同步错误分流：按错误特征给出用户可自助处理的提示（P1-3）
function _syncErrorMsg(e) {
  const msg = String((e && (e.message || e.error_description || e.error || e)) || '');
  if (/JWT|token|expired|not authenticated|session|401/i.test(msg)) return '登录已过期，请重新登录';
  if (/403|permission|policy|denied|row-level/i.test(msg)) return '无权限同步该数据';
  if (/fetch|network|timeout|Failed to load|NetworkError|offline/i.test(msg)) return '网络异常，请检查连接';
  return '数据同步失败，请稍后重试';
}

const _progressToUpload = (r) => ({
  id: r.id, user_id: currentUser.id, company: r.company, position: r.position,
  city: r.city || '', apply_date: r.applyDate || null, progress: r.progress || '已投递',
  source_url: r.sourceUrl || '', note: r.note || '', history: r.history || [],
  updated_at: new Date().toISOString()
});

const _offerToUpload = (o) => ({
  id: o.id, user_id: currentUser.id, company: o.company, position: o.position,
  city: o.city || '', monthly_salary: o.monthlySalary || null, annual_package: o.annualPackage || null,
  signing_bonus: o.signingBonus || null, year_end_bonus: o.yearEndBonus || '',
  work_hours: o.workHours || '', insurance: o.insurance || '', housing_subsidy: o.housingSubsidy || null,
  notes: o.notes || '', updated_at: new Date().toISOString()
});

async function mergeLocalToCloud() {
  if (!currentUser) return false;
  try {
    const { data: cp } = await sb.from('progress_records').select('id').eq('user_id', currentUser.id);
    const cloudIds = new Set((cp || []).map(r => r.id));
    const toUpload = progressRecords.filter(r => !cloudIds.has(r.id)).map(_progressToUpload);
    if (toUpload.length > 0) await sb.from('progress_records').upsert(toUpload, { onConflict: 'id' });

    const { data: co } = await sb.from('offers').select('id').eq('user_id', currentUser.id);
    const cloudOfferIds = new Set((co || []).map(r => r.id));
    const offersToUpload = offers.filter(o => !cloudOfferIds.has(o.id)).map(_offerToUpload);
    if (offersToUpload.length > 0) await sb.from('offers').upsert(offersToUpload, { onConflict: 'id' });
    return true;
  } catch (e) { console.error('[sync] mergeLocalToCloud:', e); showToast(_syncErrorMsg(e)); return false; }
}

async function syncFromCloud() {
  if (!currentUser) return false;
  try {
    const { data: cp } = await sb.from('progress_records').select('*').eq('user_id', currentUser.id);
    if (cp) {
      const localMap = new Map(progressRecords.map(r => [r.id, r]));
      for (const cr of cp) {
        const local = localMap.get(cr.id);
        const cloudRec = {
          id: cr.id, company: cr.company, position: cr.position, city: cr.city || '',
          applyDate: cr.apply_date || '', progress: cr.progress || '已投递',
          sourceUrl: cr.source_url || '', note: cr.note || '', history: cr.history || []
        };
        if (!local) {
          progressRecords.push(cloudRec);
        } else if ((cloudRec.history || []).length > (local.history || []).length) {
          Object.assign(local, cloudRec);
        }
      }
      saveProgress();
      renderProgressPage();
    }

    const { data: co } = await sb.from('offers').select('*').eq('user_id', currentUser.id);
    if (co) {
      const offerMap = new Map(offers.map(o => [o.id, o]));
      for (const c of co) {
        if (!offerMap.has(c.id)) {
          offers.push({
            id: c.id, company: c.company, position: c.position, city: c.city || '',
            monthlySalary: c.monthly_salary, annualPackage: c.annual_package,
            signingBonus: c.signing_bonus, yearEndBonus: c.year_end_bonus || '',
            workHours: c.work_hours || '', insurance: c.insurance || '',
            housingSubsidy: c.housing_subsidy, notes: c.notes || '', createdAt: c.created_at
          });
        }
      }
      saveOffers();
      renderOffers();
    }
    return true;
  } catch (e) { console.error('[sync] syncFromCloud:', e); showToast(_syncErrorMsg(e)); return false; }
}

async function syncNow() {
  if (!currentUser) { showToast('请先登录'); return; }
  showToast('同步中...');
  const okUp = await mergeLocalToCloud();
  const okDown = await syncFromCloud();
  // 仅在两条链路都成功时宣告完成；失败原因由各自 catch 提示，避免被"同步完成"覆盖
  if (okUp && okDown) showToast('同步完成');
}

// Debounced cloud writes
let _syncPTimer = null, _syncOTimer = null;

async function syncToCloud(table, records, mapper) {
  if (!currentUser) return;
  try {
    const rows = records.map(mapper);
    if (rows.length > 0) await sb.from(table).upsert(rows, { onConflict: 'id' });
  } catch (e) { console.error(`[sync] syncToCloud(${table}):`, e); showToast(_syncErrorMsg(e)); }
}

// 删除云端记录（仅在用户明确删除时调用）
async function deleteFromCloud(table, ids) {
  if (!currentUser || !ids || ids.length === 0) return;
  try {
    await sb.from(table).delete().in('id', ids);
  } catch (e) {
    console.error(`[sync] deleteFromCloud(${table}):`, e);
    // 失败必须显性化：本地已删、云端未删，下次同步会重新拉回该记录
    showToast('云端删除失败，该记录可能在下次同步后重新出现');
  }
}
async function syncProgressToCloud() { await syncToCloud('progress_records', progressRecords, _progressToUpload); }
async function syncOffersToCloud() { await syncToCloud('offers', offers, _offerToUpload); }

// Patch save functions to auto-sync
const _origSaveProgress = saveProgress;
saveProgress = function() {
  _origSaveProgress();
  if (currentUser) { clearTimeout(_syncPTimer); _syncPTimer = setTimeout(syncProgressToCloud, 2000); }
};
const _origSaveOffers = saveOffers;
saveOffers = function() {
  _origSaveOffers();
  if (currentUser) { clearTimeout(_syncOTimer); _syncOTimer = setTimeout(syncOffersToCloud, 2000); }
};
