// js/cloud-sync.js — Supabase 云同步模块
// 从 index.html 拆出（P2-2 架构优化），依赖全局 sb/currentUser/progressRecords/offers
// 必须在 index.html 主脚本之后加载（依赖 saveProgress/saveOffers 定义）

// ── Cloud Sync ──
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
  if (!currentUser) return;
  try {
    const { data: cp } = await sb.from('progress_records').select('id').eq('user_id', currentUser.id);
    const cloudIds = new Set((cp || []).map(r => r.id));
    const toUpload = progressRecords.filter(r => !cloudIds.has(r.id)).map(_progressToUpload);
    if (toUpload.length > 0) await sb.from('progress_records').upsert(toUpload, { onConflict: 'id' });

    const { data: co } = await sb.from('offers').select('id').eq('user_id', currentUser.id);
    const cloudOfferIds = new Set((co || []).map(r => r.id));
    const offersToUpload = offers.filter(o => !cloudOfferIds.has(o.id)).map(_offerToUpload);
    if (offersToUpload.length > 0) await sb.from('offers').upsert(offersToUpload, { onConflict: 'id' });
  } catch (e) { console.error('[sync] mergeLocalToCloud:', e); showToast('数据同步失败，请检查网络'); }
}

async function syncFromCloud() {
  if (!currentUser) return;
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
  } catch (e) { console.error('[sync] syncFromCloud:', e); showToast('同步失败，请检查网络'); }
}

async function syncNow() {
  if (!currentUser) { showToast('请先登录'); return; }
  showToast('同步中...');
  await mergeLocalToCloud();
  await syncFromCloud();
  showToast('同步完成');
}

// Debounced cloud writes
let _syncPTimer = null, _syncOTimer = null;

async function syncToCloud(table, records, mapper) {
  if (!currentUser) return;
  try {
    const rows = records.map(mapper);
    if (rows.length > 0) await sb.from(table).upsert(rows, { onConflict: 'id' });
  } catch (e) { console.error(`[sync] syncToCloud(${table}):`, e); showToast('数据同步失败'); }
}

// 删除云端记录（仅在用户明确删除时调用）
async function deleteFromCloud(table, ids) {
  if (!currentUser || !ids || ids.length === 0) return;
  try {
    await sb.from(table).delete().in('id', ids);
  } catch (e) { console.error(`[sync] deleteFromCloud(${table}):`, e); }
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
