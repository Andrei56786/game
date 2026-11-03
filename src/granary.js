'use strict';
// ===== GRANARY (v3.6): the crown's barns =====
// Crown villages bring their dues in kind twice a year: the reaping at the end of summer and the threshing in autumn (vassal lands give
// half — their lords keep a share; a defiant house sends nothing; land ravaged by war gives less). In winter and spring nothing grows:
// the court lives on what was stored. The untouchable reserve is never taken for a campaign or sold — it is for a siege of the capital,
// a hungry year and the long road to the next harvest. The villages also owe carts for the king's train (cartage duty).
// About one year in nine the harvest fails: bread gets dear on the markets and the elders come to court to ask for grain.
const GRAN_RES = [0, 1000, 2000, 4000], GRAN_CAP = 10000, GRAN_CARTS = 10, GRAN_START = 6000;
const GRAN_REAP = DAYS_SEASON + 16, GRAN_THRESH = DAYS_SEASON * 2 + 4, GRAN_WARN = DAYS_SEASON * 3 - 4, GRAN_POOR = 0.78;
function granS() { const C = G && G.court; if (!C) return { res: 0, carts: 0, q: 1, qy: -1 };
  if (!C.gran) { C.gran = { res: 2000, carts: 8, q: 1, qy: -1, seen: 0, famY: -9, relY: -9, buyD: -9, sieD: -9, reap: 0, thr: 0 }; C.grain = Math.max(C.grain || 0, GRAN_START); } // older saves: the barns of 3.6 are fuller
  return C.gran; }
function granCap() { return Math.round(GRAN_CAP * (projDone('granary') ? 1.5 : 1)); }
function granRes() { return G.court ? granS().res : 0; }
function granFree() { return G.court ? Math.max(0, Math.floor((G.court.grain || 0) - granRes())) : 0; }
function eatK() { return seasonOf(G.day) === 3 ? 1.2 : 1; }                       // winter: the frost eats too — a fifth more bread for every man in the field
function granEat(s) { s = s === undefined ? seasonOf(G.day) : s; return Math.round(24 * (s === 3 ? 1.3 : 1) * (hasTech('mills') ? 0.85 : 1)); } // the household, the guard, the stables' boys
// the year's harvest: ≈1 on average, «скудный» about one year in nine (deterministic per world and year)
function granQ(y) { const t = (hf(7001, y) + hf(7002, y)) / 2; return Math.round((0.6 + 0.75 * t) * 100) / 100; }
const granWord = q => q < GRAN_POOR ? 'скудный' : q < 0.92 ? 'небогатый' : q < 1.12 ? 'добрый' : 'обильный';
const podv = n => n + ' ' + plural(n, 'подвода', 'подводы', 'подвод'), mer = n => (n = Math.round(n)) + ' ' + plural(n, 'мера', 'меры', 'мер'), merA = n => (n = Math.round(n)) + ' ' + plural(n, 'меру', 'меры', 'мер');
function granVillages() { const L = [];
  for (const S of G.setts) { const ws = WD.setts[S.id]; if (ws.type !== 'village' || S.owner !== 0 || S.ctrl !== 0 || S.siege) continue;
    const seat = G.setts[WD.provs[ws.prov].seat], H0 = seat && seat.house >= 0 && G.houses ? G.houses[seat.house] : null; if (H0 && H0.defiant > G.day) continue;
    L.push({ S, k: H0 ? 0.5 : 1 }); }
  return L; }
function granDues(part, q) { let h = 0; for (const v of granVillages()) { const P = G.provs[WD.setts[v.S.id].prov]; h += 75 * v.k * (v.S.prosp / 60) * (1 - (P.dev || 0)); }
  return Math.round(h * part * (q === undefined ? granS().q : q) * (hasTech('rotation') ? 1.25 : 1) * (hasTech('mills') ? 1.1 : 1) * (projDone('granary') ? 1.1 : 1)); }
function granProvs() { return G.provs.filter(P => { const S = G.setts[WD.provs[P.id].seat]; return S && S.owner === 0 && S.ctrl === 0; }); }
function granFamine() { const o = granS(), y = yearOf(G.day), d = dayOfYear(G.day); return (o.famY === y && d >= DAYS_SEASON * 3) || (o.famY === y - 1 && d < GRAN_REAP); }
function granSay(t, tone) { if (seatChar('seneschal')) addReport('seneschal', t); else log(t, tone || 'info'); }
// ---------- the day ----------
function granDaily() { const C = G.court; if (!C) return; const o = granS(), d = dayOfYear(G.day), y = yearOf(G.day);
  if (o.qy !== y) { o.qy = y; o.q = granQ(y); o.seen = 0; o.reap = o.thr = 0; }
  const e = granEat(); if ((C.grain || 0) >= e) C.grain -= e; else { const n = e - (C.grain || 0); C.grain = 0; granBuyBread(n); }
  if (d % DAYS_SEASON === 1 && seasonOf(G.day) !== 3) o.carts = Math.min(GRAN_CARTS, (o.carts || 0) + 3); // new carts from the villages in spring, summer and autumn
  if (d === GRAN_REAP) granBring(0.4, 'reap');
  if (d === GRAN_THRESH) granBring(0.6, 'thr');
  if (d === GRAN_WARN) granWinterWord();
  if (granFamine() && o.relY !== o.famY) for (const P of granProvs()) P.unrest = Math.min(100, P.unrest + 0.12); }
// the barns are empty: the household buys its bread on the capital's market
function granBuyBread(n) { const S = G.setts[G.realms[0].capital], r = G.realms[0], o = granS(), c = n * priceOf(S, 'food');
  if (r.gold >= c + 5 && (S.mk.food || 0) >= n) { r.gold -= c; mkTake(S, 'food', n); } else prestige(-0.05);
  if (G.day - o.buyD >= 7) { o.buyD = G.day; log('Королевские амбары пусты: двор живёт на покупном хлебе (≈' + Math.max(1, Math.round(c)) + ' зол. в день).', 'bad'); } }
function granBring(part, k) { const C = G.court, o = granS(), n = granDues(part), cap = granCap(); C.grain = (C.grain || 0) + n; o[k] = n; o.seen = 1; let over = 0, got = 0;
  if (C.grain > cap) { over = Math.round(C.grain - cap); C.grain = cap; const S = G.setts[G.realms[0].capital]; got = Math.round(over * priceOf(S, 'food') * 0.5); G.realms[0].gold += got; S.mk.food = (S.mk.food || 0) + over; }
  let t = k === 'reap' ? 'Жатва: урожай нынче ' + granWord(o.q) + '. Первые возы с рожью — ' + mer(n) + '.' : 'Обмолот окончен, деревни свезли оброк — ' + mer(n) + '. В амбарах ' + Math.round(C.grain) + ' из ' + cap + '.';
  if (over) t += ' Амбары полны: излишек (' + mer(over) + ') сенешаль продал купцам за ' + got + ' зол.';
  const poor = k === 'thr' && o.q < GRAN_POOR;
  if (poor) { o.famY = yearOf(G.day); for (const S of G.setts) if (S.ctrl === 0 && WD.setts[S.id].type !== 'village') S.mk.food = (S.mk.food || 0) * 0.6; t += ' Год голодный: хлеб на рынках подорожает, а зимой старосты придут просить зерна.'; }
  granSay(t, poor ? 'bad' : 'good'); }
function granWinterWord() { const C = G.court, need = granNeed(), res = granRes(), g = Math.round(C.grain || 0);
  granSay('Зима близко. В амбарах ' + mer(g) + '; до новой жатвы двору нужно ≈' + merA(need) + ', неприкосновенный запас — ' + res + '. ' +
    (g < need ? 'Хлеба до лета не хватит — велите закупить зерно.' : 'В поход можно взять ' + merA(Math.max(0, g - Math.max(res, need))) + ', не трогая хлеба двора.'), g < need ? 'bad' : 'info'); }
// what the court will eat until the next reaping
function granNeed() { const d = dayOfYear(G.day); let n = 0; for (let i = 0, dd = d; i < DAYS_YEAR && dd !== GRAN_REAP; i++, dd = (dd + 1) % DAYS_YEAR) n += granEat(Math.floor(dd / DAYS_SEASON)); return n; }
function granNext() { const o = granS(), d = dayOfYear(G.day);
  return d < GRAN_REAP ? 'жатва в конце лета' : d < GRAN_THRESH ? 'обмолот осенью (≈' + fmt(granDues(0.6)) + ')' : 'только в конце лета — зимой и весной ничего не растёт'; }
// a siege of the capital: the garrison eats from the crown's barns while there is grain
function granSiegeFeed(S) { const C = G.court; if (!C || !G.realms[0] || S.id !== G.realms[0].capital || S.ctrl !== 0) return false;
  const n = Math.ceil(menOf(S.gar) * eatK()); if (!n || (C.grain || 0) < n) return false; C.grain -= n; const o = granS();
  if (G.day - o.sieD > 10) { o.sieD = G.day; log('Столица в осаде: гарнизон ест из королевских амбаров — ' + mer(n) + ' в день, зерна хватит на ' + dn(Math.floor(C.grain / n)) + '.', 'info'); }
  return true; }
// ---------- words ----------
function granTip() { const C = G.court, o = granS(), g = Math.round(C.grain || 0), s = seasonOf(G.day);
  return ['Королевские амбары: ' + g + ' из ' + granCap() + ' мер зерна' + (seatChar('seneschal') ? ' (со слов сенешаля)' : ''),
    'Неприкосновенный запас — ' + granRes() + ': на осаду, голодный год и дорогу до новой жатвы. В поход его не берут.',
    'Двор ест ' + merA(granEat()) + ' в день' + (s === 3 ? ' — зима' : ', зимой ' + granEat(3)) + '. Подвоз: ' + granNext() + '.',
    'Обозный двор: ' + podv(o.carts || 0) + ' от деревень.' + (o.seen ? ' Урожай нынче ' + granWord(o.q) + '.' : ''),
    granFamine() ? { t: 'Голодный год: деревни ждут хлеба.', c: UIC.warn } : null, { t: 'Щелчок — снабжение и запас (O)', c: UIC.dim }].filter(Boolean); }
function granTalk() { const C = G.court, o = granS(); if (!(C.seats.seneschal >= 0)) return 'Амбар пахнет пылью и хлебом. Сенешаля нет — никто толком не знает, сколько здесь зерна.';
  const c = seatChar('seneschal'), g = c ? noisy(C.grain || 0, c, 'stew') : Math.round(C.grain || 0);
  return ['Амбар пахнет пылью и хлебом. Сенешаль ведёт счёт мерам: в закромах около ' + g + ' мер из ' + granCap() + ', неприкосновенный запас — ' + granRes() + '.',
    'Деревни везут оброк дважды в год: в конце лета, после жатвы, и осенью, после обмолота. Зимой и весной ничего не растёт — двор живёт тем, что засыпали. ' + (granFamine() ? 'Нынче год голодный: старосты ждут хлеба.' : 'Следующий подвоз — ' + granNext() + '.'),
    'На обозном дворе ' + podv(o.carts || 0) + ' — деревни дают их для королевского обоза. Снабженец берёт их первыми.']; }
// ---------- a hungry year: the elders at court ----------
function granRelief(n, p) { const C = G.court, o = granS(); C.grain = Math.max(0, (C.grain || 0) - n); o.relY = o.famY; for (const P of granProvs()) P.unrest = Math.max(0, P.unrest - 12); }
PETS.push({ k: 'famine', get w() { return G && G.court && granFamine() && granS().relY !== granS().famY ? 8 : 0; }, role: 'peasant',
  mk: () => { if (!granFamine() || granS().relY === granS().famY) return null; const S = rndOwn('village'); return S && { s: S.id, text: 'Государь, я староста деревни ' + WD.setts[S.id].name + '. Урожай нынче скудный, а до новой жатвы далеко: в сусеках пусто, люди мешают муку с лебедой. И у соседей так же. Откройте королевские амбары — не дайте вашим деревням пропасть!' }; },
  ch: p => [{ t: 'Открыть амбары: раздать деревням 1 500 мер', good: 3, ok: () => (G.court.grain || 0) >= 1500, why: 'в амбарах нет столько зерна', fx: () => { granRelief(1500, p); prestige(4); log('Король открыл амбары: деревни получили хлеб до новой жатвы.', 'good'); } },
    { t: 'Продать хлеб по-божески: 1 000 мер за 25 зол.', good: 2, ok: () => (G.court.grain || 0) >= 1000, why: 'в амбарах нет столько зерна', fx: () => { granRelief(1000, p); G.realms[0].gold += 25; for (const P of granProvs()) P.unrest = Math.min(100, P.unrest + 4); prestige(1); } },
    { t: 'Отказать: запас — на войну и осаду', good: 0, fx: () => { const o = granS(); o.relY = o.famY; for (const P of granProvs()) P.unrest = Math.min(100, P.unrest + 8); prestige(-3); } }] });
REFS.push({ s: 'Снабжение', t: 'Амбары, зима и неприкосновенный запас', b: () => 'Королевские амбары стоят во дворе замка и вмещают ' + granCap() + ' мер зерна (Большой амбар — в полтора раза больше). Мера — дневной хлеб одного человека. Сколько зерна сейчас — на верхней панели рядом с войском.\n' +
  '• Подвоз. Коронные деревни везут оброк зерном дважды в год: в конце лета, после жатвы (около 40%), и осенью, после обмолота (около 60%). Вассальные земли дают половину — остальное берёт их лорд, непокорный дом не даёт ничего. Богатые деревни дают больше, разорённые войной — меньше; севооборот и мельницы прибавляют. Лишнее сверх вместимости сенешаль продаёт купцам за полцены.\n' +
  '• Зима. Зимой и весной ничего не растёт: двор — стража, слуги, конюшни — ест ' + merA(granEat(0)) + ' в день, а зимой ' + granEat(3) + ', и живёт тем, что засыпали осенью. Войско в поле зимой ест на пятую часть больше, а кони не пасутся. Перед зимой сенешаль докладывает, хватит ли хлеба до лета.\n' +
  '• Неприкосновенный запас. В окне снабжения (O) выберите, сколько зерна не трогать: 0, 1 000, 2 000 или 4 000 мер. Снабженец не берёт его в поход, казначей не продаёт. Запас кормит двор до новой жатвы, гарнизон столицы в осаде (пока есть зерно, он ест из амбаров) и деревни в голодный год.\n' +
  '• Голодный год. Примерно раз в девять лет урожай скудный: хлеб на рынках дорожает, смута в коронных землях растёт, и до новой жатвы старосты приходят просить зерна. Открыть амбары — дорого, но смута стихнет и слава вырастет; отказ — ропот.\n' +
  '• Подводы. Деревни дают королю подводы для обоза: на обозном дворе до ' + GRAN_CARTS + ', по три новых весной, летом и осенью. Снабженец берёт их первыми и бесплатно, недостающие покупает на рынке.\n' +
  '• Как пополнить. Сенешаль — «Пополнять амбары», казначей — «Закупить зерно»; охота приносит мясо. Казначей может и продать излишки — треть того, что сверх запаса.' });
