'use strict';
// ===== RESEARCH: four branches of royal learning (the magister studies, the realm changes) =====
const TECH = {
  rotation: { b: 0, n: 'Трёхполье', d: 'Поля отдыхают по очереди. Доход провинций +8%, амбары +2 меры в день.', cost: 14 },
  ledgers: { b: 0, n: 'Учётные книги', d: 'Двойная запись: расхождение книг и сундуков видно в подсказке казны. Доход +4%.', cost: 20, req: 'rotation' },
  mills: { b: 0, n: 'Водяные мельницы', d: 'Мельницы на реках: амбары +4 меры в день, доход +6%.', cost: 28, req: 'ledgers' },
  fairs: { b: 0, n: 'Ярмарки', d: 'Купцы съезжаются со всех земель: доход городов +10%, слава короля растёт.', cost: 36, req: 'mills' },
  drill: { b: 1, n: 'Строевая выучка', d: 'Учения маршала дают вдвое больше опыта.', cost: 14 },
  mail: { b: 1, n: 'Кольчуги', d: 'Частое плетение колец: войска короны крепче в рукопашной (≈+8%).', cost: 18, req: 'drill' },
  crossbow: { b: 1, n: 'Арбалеты', d: 'Мастера натяжного ворота: арбалетчики и лучники короны бьют точнее (≈+15% меткости).', cost: 26, req: 'mail' },
  engines: { b: 1, n: 'Осадные машины', d: 'Требушеты и тараны: осадные работы войск короны идут на 40% быстрее.', cost: 36, req: 'crossbow' },
  ciphers: { b: 2, n: 'Шифры', d: 'Чужим шпионам труднее, а Око раскрывает тайны двора чаще.', cost: 14 },
  pigeons: { b: 2, n: 'Почтовые голуби', d: 'Голуби несут вести из своих крепостей за полдня — быстрее любого гонца.', cost: 20, req: 'ciphers' },
  informants: { b: 2, n: 'Осведомители', d: 'Сеть Ока растёт сама: раз в сезон +1 к сети в одной из держав.', cost: 28, req: 'pigeons' },
  antidotes: { b: 2, n: 'Противоядия', d: 'Лекари знают яды и травы: болезни реже уносят членов королевской семьи.', cost: 36, req: 'informants' },
  posts: { b: 3, n: 'Почтовые станции', d: 'Смена коней на трактах: гонцы скачут в 1,6 раза быстрее. Приказы и донесения приходят раньше.', cost: 14 },
  laws: { b: 3, n: 'Свод законов', d: 'Единый закон: волнения в провинциях утихают быстрее, судья работает лучше.', cost: 20, req: 'posts' },
  chancery: { b: 3, n: 'Канцелярия', d: 'Приказы по форме и печати: умелые советники почти не обижаются на «Приказ».', cost: 28, req: 'laws' },
  townhalls: { b: 3, n: 'Ратуши', d: 'Города управляют собой: доход +6%, смута в провинциях спадает.', cost: 36, req: 'chancery' },
};
const BRANCHES = [{ n: 'Хозяйство', ic: 'i_gold' }, { n: 'Война', ic: 'i_sword' }, { n: 'Тайное знание', ic: 'i_eye' }, { n: 'Управление', ic: 'i_seal' }];
const branchTechs = b => Object.keys(TECH).filter(k => TECH[k].b === b);
function hasTech(k) { return !!(G && G.tech && G.tech.done && G.tech.done[k]); }
// v3.6: every subject keeps its own progress (T.pp); the magister's idle time becomes «вдохновение» (T.insp);
// a subject of a later age may be studied early — dearer the further away its age is, and experiments cost gold
const INSP_MAX = 60;
function techInit(T) { T = T || G.tech; if (!T) return T; if (!T.pp) { T.pp = {}; if (T.cur && T.prog) T.pp[T.cur] = T.prog; T.insp = Math.min(INSP_MAX, T.bank || 0); T.auto = 1; T.first = T.cur || Object.keys(T.done || {}).length ? 1 : 0; } return T; }
const techEraOf = k => TECH[k].era || 0, techNowEra = () => typeof eraNow === 'function' ? eraNow() : 0;
function techOpen(k) { const t = TECH[k]; return !!t && !hasTech(k) && (!t.req || hasTech(t.req)); }
function techAvail(k) { return techOpen(k) && techEraOf(k) <= techNowEra(); }
function techAhead(k) { return techOpen(k) && techEraOf(k) > techNowEra(); }
// too early: ×(1 + 0.6 per year left until the age), at most ×4; experiments: 1 gold a day per age ahead
function techEraK(k) { const e = techEraOf(k); if (e <= techNowEra() || typeof eraDays !== 'function') return 1; return Math.min(4, 1 + eraDays(e) / DAYS_YEAR * 0.6); }
function techCost(k) { return Math.round(TECH[k].cost * techEraK(k)); }
const techGoldDay = k => techAhead(k) ? techEraOf(k) - techNowEra() : 0;
function techPP(k) { const T = techInit(); return T && T.pp ? T.pp[k] || 0 : 0; }
function techFrac(k) { return k && TECH[k] ? clamp(techPP(k) / techCost(k), 0, 1) : 0; }
function techState(k) { return hasTech(k) ? 'done' : G.tech.cur === k ? 'cur' : techAvail(k) ? 'avail' : techAhead(k) ? 'ahead' : 'locked'; }
// research points. ext: a one-off gift (a treatise, a scholar's petition, a prayer) rather than the magister's daily work
function techProgress(p, ext) { const T = techInit(); if (!T) return; if (hasTech('printing')) p *= 1.25;
  if (!T.cur || T.done[T.cur] || !TECH[T.cur]) { T.cur = null; T.insp = Math.min(INSP_MAX, (T.insp || 0) + p * (ext ? 1 : 0.5)); return; }
  if (projDone('libwing')) p *= 1.15; if (projDone('observatory')) p *= 1.05;
  const k = T.cur, ahead = techAhead(k);
  if (!ext && T.insp > 0) { const use = Math.min(T.insp, ahead ? 1 : 0.75); T.insp -= use; p += use * (ahead ? 2 : 1); } // insight: twice as dear where the age has not yet come
  T.pp[k] = (T.pp[k] || 0) + p; T.prog = T.pp[k]; const t = TECH[k], cost = techCost(k);
  if (T.pp[k] >= cost) { T.done[k] = G.day + 1; const over = T.pp[k] - cost; delete T.pp[k]; T.prog = 0; T.cur = null; T.insp = Math.min(INSP_MAX, (T.insp || 0) + over * 0.5); T.last = k; if (ahead) T.early = (T.early || 0) + 1;
    techApply(k); log('Магистр: изучено знание «' + t.n + '»' + (ahead ? ' — раньше своего времени' : '') + '. ' + t.d, 'good'); if (typeof Snd !== 'undefined') Snd.sfx('chime');
    if (G.court && G.court.orders.magister && G.court.orders.magister.k === 'research') G.court.orders.magister.fin = 1; } }
function techApply(k) { if (k === 'fairs') prestige(5); if (k === 'laws') for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - 8); }
// economy multiplier for the crown (called from realmEconomy)
function techIncK() { return 1 + (projDone('mint') ? 0.05 : 0) + (hasTech('rotation') ? 0.08 : 0) + (hasTech('ledgers') ? 0.04 : 0) + (hasTech('mills') ? 0.06 : 0) + (hasTech('townhalls') ? 0.06 : 0); }
// battle: tech shows as experience of the crown's soldiers
function techXp(realm, xp) { if (realm !== 0 || !G.tech) return xp; const o = Object.assign({}, xp); if (hasTech('mail')) for (const t of UT) o[t] = (o[t] || 0) + 18; if (hasTech('crossbow')) { o.archer = (o.archer || 0) + 36; o.xbow = (o.xbow || 0) + 36; } return o; }
function researchDaily() { if (!G.court) return; const C = G.court;
  // the magister without a subject is never idle: he reads, writes to scholars and gathers inspiration; after the first subject he picks the next himself
  studyDaily();
  // granary (v3.6, granary.js): the court eats, the villages bring their dues twice a year, a word before the winter
  granDaily();
  // laws & townhalls calm the land; fairs add a bit of glory each season
  const calm = (hasTech('laws') ? 0.15 : 0) + (hasTech('townhalls') ? 0.15 : 0); if (calm) for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - calm);
  if (G.day % DAYS_SEASON === 0) { if (hasTech('fairs')) prestige(1); if (hasTech('informants')) { const L = [1, 2, 3, 4].filter(t => alive(t) && (C.net[t] || 0) < 3); if (L.length) { const t = R.pick(L); C.net[t] = (C.net[t] || 0) + 1; addReport('eye', 'Осведомители окрепли: сеть в державе ' + realmName(t) + ' теперь ' + C.net[t] + ' из 3.'); } } } }
