'use strict';
// ===== CASTLES (v3.3), part 2: the host and his household, talk, dinner at the high table, a night under his roof, gifts, diplomacy =====
const KV = { host: null, rl: 0, mus: '', greet: 0, chatT: 3, chk: 0, warn: 0 };   // per-visit runtime state (not saved)
const kV = () => (G && G.visit && G.visit.kind === 'castle' ? G.visit : null);
function kMem(sid) { G.kmem = G.kmem || {}; return G.kmem[sid] || (G.kmem[sid] = { v: 0, last: -1, nm: {}, opn: 0 }); }
const K_KNT = ['Сэр', 'Хёвдинг', 'Кондотьер', 'Паладин', 'Стратиг', 'Витязь'], K_GRD = ['Стражник', 'Хускарл', 'Наёмник', 'Храмовый страж', 'Легионер', 'Стражник'];
const K_STW = ['Сенешаль', 'Ключник', 'Казначей', 'Эконом', 'Логофет', 'Ключник'], K_CST = ['Кастелян', 'Управитель', 'Подеста', 'Наместник', 'Комит', 'Кастелян'];
const K_LADY = ['Леди', 'Хозяйка', 'Донна', 'Сестра', 'Патрикия', 'Пани'], K_QUEEN = ['Королева', 'Госпожа', 'Догаресса', '', 'Императрица', ''];
const K_DISH = { K: 'жаркое из оленины и пироги с дичью', C: 'копчёная сёмга, баранина и мёд', R: 'жареные перепела, сыры и южное вино', T: 'постная похлёбка, хлеб и ключевая вода', E: 'павлин в перьях, устрицы и пряное вино', F: 'кабанятина, пироги и пиво' };
const K_CHAT = { day: ['Ваше величество!', 'Сам король!', 'Государь…', 'Да хранит вас небо, ваше величество.'], dine: ['За здоровье короля!', 'Передайте соль…', 'Вина гостю!', 'Отменное жаркое!'], guard: ['Ваше величество!', 'Смирно!'], kid: ['Король! Настоящий!', 'А где корона?'] };
const kCap1 = s => s.charAt(0).toUpperCase() + s.slice(1), kTtl = (pre, nm) => (nm.includes(' ') ? kCap1(nm) : (pre ? pre + ' ' : '') + nm);
const kDish = () => K_DISH[KMAP && KMAP.key] || K_DISH.K, kPts = v => { const V = G.visit; V.pts = Math.min(10, (V.pts || 0) + v); };
const kHostNpc = () => COURT.npcs.find(n => n.kv && n.kv.job === 'host');
function kDinner() { if (!kV()) return false; const h = hourAbs(); return (h >= 12.5 && h < 14) || (h >= 18.5 && h < 21.5); }
function kDineLabel() { const h = hourAbs(); return kDinner() ? (h >= 18.5 ? 'Ужин: занять место гостя' : 'Обед: занять место гостя') : 'Высокий стол'; }
function kName(cul, fem, r, folk, taken) { let P = folk ? [] : (NAMES[cul] || NAMES.K).filter(n => isFemName(n) === (fem ? 1 : 0)); if (P.length < 3) P = (FOLK_NM[cul] || FOLK_NM.K)[fem ? 1 : 0];
  const used = new Set(taken || []); for (const c of G.chars) if (c.alive) used.add(String(c.name).split(' ')[0]); const fr = P.filter(n => !used.has(n.split(' ')[0])); return r.pick(fr.length ? fr : P); }
// ---------- who receives the king ----------
function kHostOf(sid) { const S = G.setts[sid], rl = S.ctrl, pr = G.player.realm, busy = c => !c || !c.alive || c.prison >= 0 || c.atCourt || c.away || G.armies.some(a => a.alive && a.gen === c.id);
  if (rl !== pr && rl < 5 && G.realms[rl].capital === sid && G.realms[rl].ruler >= 0) { const c = rulerOf(rl); if (!busy(c)) return { t: 'ruler', c, rl }; }
  const lord = S.lord >= 0 ? charOf(S.lord) : null;
  if (lord && lord.realm === rl && !busy(lord)) return rl === pr ? { t: 'vassal', c: lord, rl, H: kHouseOf(sid) } : { t: rl === 5 ? 'baron' : 'lord', c: lord, rl };
  const away = lord && lord.alive && lord.realm === rl ? lord : rl !== pr && rl < 5 && G.realms[rl].capital === sid ? rulerOf(rl) : null;
  return { t: 'castellan', c: null, rl, away, own: rl === pr && S.owner === pr, occ: rl === pr && S.owner !== pr }; }
const kForeign = h => !!h && h.rl < 5 && h.rl !== G.player.realm && G.realms[h.rl].ruler >= 0 && !!rulerOf(h.rl);
function kOpinion() { const h = KV.host; if (!h) return 0; if (kForeign(h)) return opinionOf(h.rl, G.player.realm);
  if (h.t === 'vassal') return h.H ? Math.round((h.H.loy - 50) * 2) : 20; if (h.rl === 5) return kMem(G.visit.sid).opn || 0; return 40; }
function kBonus(v, l) { const h = KV.host, pr = G.player.realm; if (!h) return; if (kForeign(h)) addOpn(h.rl, pr, h.t === 'ruler' ? v : Math.max(1, v >> 1));
  else if (h.t === 'vassal' && h.H) houseLoy(h.H, l); else if (h.rl === 5) { const m = kMem(G.visit.sid); m.opn = clamp((m.opn || 0) + v * 2, -50, 60); } }
// diplomacy at the high table: the king who came in person, and the hospitality he has shared, weigh in (see acceptance())
function visitBonus(t) { const V = kV(), h = KV.host; if (!V || !h || h.t !== 'ruler' || h.rl !== t) return null; return [['Король приехал сам', 12], ['Гостеприимство', Math.min(10, V.pts || 0)]]; }
// ---------- the household ----------
function kPeople(sid) { const M = KMAP, rl = M.rl, key = M.key === 'B' ? 'K' : M.key, mem = kMem(sid), r = vRng(sid, 33), P = [], h = KV.host;
  mem.nm = mem.nm || {}; const taken = new Set(Object.values(mem.nm).map(q => String(q.n).split(' ')[0]));
  const per = (slot, fem, age, folk) => { if (!mem.nm[slot]) { mem.nm[slot] = { n: kName(key, fem, r, folk, taken), f: fem ? 1 : 0, a: age, d: G.day }; taken.add(mem.nm[slot].n.split(' ')[0]); } return mem.nm[slot]; };
  const ageOf = q => q.a + Math.floor((G.day - q.d) / DAYS_YEAR), free = c => c && c.alive && !(c.prison >= 0) && !c.atCourt && !c.away;
  const add = (job, role, fem, age, title, sub, o) => { const p = Object.assign({ k: P.length, job, role, fem: fem ? 1 : 0, age, title, sub }, o || {}); P.push(p); return p; };
  const hc = h.c;
  if (hc) add('host', hc.role || 'lord', hc.fem, hc.age, null, h.t === 'ruler' ? 'Правитель: ' + realmName(rl) : h.t === 'vassal' ? 'Хозяин замка' + (h.H ? ' · дом ' + h.H.name : '') : h.t === 'baron' ? 'Вольный барон, хозяин замка' : 'Хозяин замка', { real: hc });
  else { const q = per('cast', 0, r.i(40, 62)); add('host', 'knight', 0, ageOf(q), kTtl(h.occ ? 'Комендант' : K_CST[rl] || 'Кастелян', q.n), h.own ? 'Королевский кастелян' : h.occ ? 'Комендант гарнизона' : 'Управляет замком' + (h.away ? ' за господина' : '')); }
  // the family: real people for a vassal of the crown, the court of a foreign ruler for the rest
  const sp = hc && hc.spouse >= 0 ? charOf(hc.spouse) : null, lq = per('lady', hc && hc.fem ? 0 : 1, r.i(-2, 9)), hq = per('heir', r.f() < 0.4, r.i(8, 22)), ok = hc && h.t !== 'vassal' && key !== 'T';
  if (free(sp)) add('lady', sp.role || 'consort', sp.fem, sp.age, null, sp.fem ? 'Хозяйка замка' : 'Супруг хозяйки', { real: sp });
  else if (ok && !(hc.spouse >= 0)) { const fem = hc.fem ? 0 : 1, pre = fem ? (h.t === 'ruler' ? K_QUEEN[rl] : K_LADY[rl]) || 'Леди' : 'Сэр';
    add('lady', 'consort', fem, clamp(hc.age - lq.a, 19, 70), kTtl(pre, lq.f === fem ? lq.n : kName(key, fem, r, 0, taken)), fem ? (h.t === 'ruler' ? 'Супруга правителя' : 'Хозяйка замка') : 'Супруг хозяйки'); }
  const kid = hc ? (hc.kids || []).map(charOf).find(c => free(c) && c.age < 30) : null;
  if (kid) add(kid.age < 14 ? 'child' : 'heir', kid.role || (kid.age < 14 ? 'child' : 'heir'), kid.fem, kid.age, null, kid.age < 14 ? 'Дитя хозяина' : kid.fem ? 'Дочь хозяина' : 'Сын хозяина', { real: kid });
  else if (ok && (sid * 7) % 10 < 8) { const a = ageOf(hq); if (a < 30) add(a < 14 ? 'child' : 'heir', a < 14 ? 'child' : 'heir', hq.f, a, hq.n, a < 14 ? 'Дитя хозяина' : hq.f ? 'Наследница' : 'Наследник'); }
  // the people of the castle
  const st = per('stew', 0, r.i(38, 64)); add('steward', 'steward', 0, ageOf(st), kTtl(K_STW[rl], st.n), M.cap ? 'Ведает казной двора' : 'Ведает хозяйством замка');
  for (let j = 0; j < 2; j++) { const q = per('kn' + j, 0, r.i(24, 46)); add('knight', 'knight', 0, ageOf(q), kTtl(K_KNT[rl], q.n), j ? 'Рыцарь замка' : 'Начальник стражи', { j, sk: 6 + ((sid * 7 + j * 5) % 9) }); }
  for (let j = 0; j < 4; j++) add('guard', 'guard', 0, 20 + ((sid + j * 7) % 22), K_GRD[rl], 'Стража замка', { j, post: ['k_gate0', 'k_gate1', 'k_hg0', 'k_hg1'][j] });
  const ck = per('cook', r.f() < 0.5, r.i(30, 58), 1); add('cook', 'cook', ck.f, ageOf(ck), (ck.f ? 'Кухарка ' : 'Повар ') + ck.n, 'Кухня замка');
  for (let j = 0; j < 2; j++) { const q = per('srv' + j, j ? r.f() < 0.5 : 1, r.i(15, 40), 1); add('servant', 'servant', q.f, ageOf(q), (q.f ? 'Служанка ' : 'Слуга ') + q.n, 'Прислуживает в зале', { j }); }
  const gr = per('groom', 0, r.i(14, 50), 1); add('groom', 'peasant', 0, ageOf(gr), 'Конюх ' + gr.n, 'Конюшня');
  const sm = per('smith', 0, r.i(28, 55), 1); add('smith', 'smith', 0, ageOf(sm), 'Кузнец ' + sm.n, 'Кузня');
  const mq = per('min', r.f() < 0.25, r.i(19, 45), 1); if (M.cap || sid % 10 < 7) add('minstrel', 'minstrel', mq.f, ageOf(mq), 'Менестрель ' + mq.n, 'Поёт в зале');
  const pq = per('prst', 0, r.i(35, 70)); if (M.ne === 'chapel') add('priest', 'priest', 0, ageOf(pq), kTtl(key === 'T' ? 'Брат' : 'Отец', pq.n), 'Капеллан замка');
  return P; }
const kHome = p => ({ host: 'k_priv', lady: 'k_priv', heir: 'k_priv', child: 'k_priv', steward: 'k_priv', minstrel: 'k_priv', knight: p.j ? 'k_barr1' : 'k_barr0', groom: 'k_barr1', smith: 'k_barr1', priest: KMAP.ne === 'chapel' ? 'k_chapd' : 'k_priv' })[p.job] || 'k_kitchen';
function kSched(p) { const t = x => x + (p.k % 4) * 0.1, M = KMAP, gar = M.ne === 'garden' ? 'k_gb' + (p.k % 4) : 'k_bench' + (p.k % 2), yard = 'wander:19,17,30,24@k_yard';
  switch (p.job) {
    case 'host': return [[5, 'k_priv'], [t(7.5), 'k_recv'], [10, 'k_plaza_n'], [11, 'k_recv'], [12.5, 'k_host'], [14, 'k_recv'], [16, gar], [17.3, 'k_recv'], [18.5, 'k_host'], [21.5, 'k_fire0'], [23, 'k_priv']];
    case 'lady': return [[5, 'k_priv'], [8, 'k_win'], [10, gar], [12.5, 'k_lady'], [14, 'k_win'], [16, 'k_herbs'], [17.5, 'k_hearth'], [18.5, 'k_lady'], [21.5, 'k_hearth'], [22.5, 'k_priv']];
    case 'heir': return [[5, 'k_priv'], [8, 'k_train41'], [10.5, 'k_plaza_e'], [12.5, 'k_heir'], [14, 'k_train43'], [17, 'k_well0'], [18.5, 'k_heir'], [21, 'k_priv']];
    case 'child': return [[5, 'k_priv'], [8.5, yard], [12.5, 'k_heir'], [14, yard], [17, 'k_win'], [18.5, 'k_heir'], [20.5, 'k_priv']];
    case 'steward': return [[5, 'k_priv'], [7, 'k_stew'], [10, 'k_granf'], [11, 'k_stew'], [12.5, 'k_stewt'], [14, 'k_stew'], [16.5, 'k_cauldron'], [17.5, 'k_stew'], [18.5, 'k_stewt'], [21.5, 'k_priv']];
    case 'knight': return p.j ? [[5, 'k_barr1'], [7, 'k_archer'], [11, 'k_kn1'], [12.5, 'k_s17_0n'], [14, 'k_train39'], [17, 'k_lane_e'], [18.5, 'k_s17_0n'], [22, 'k_barr1']]
      : [[5, 'k_barr0'], [7, 'k_train39'], [11, 'k_plaza_w'], [12.5, 'k_s3_4n'], [14, 'k_master'], [17, 'k_kn0'], [18.5, 'k_s3_4n'], [22, 'k_barr0']];
    case 'cook': return [[5, 'k_kitchen'], [6, 'k_cauldron'], [8, 'k_well1'], [9, 'k_cauldron'], [11.5, 'k_kitchen'], [13.5, 'k_cauldron'], [16.5, 'k_kitchen']];
    case 'servant': return [[5, 'k_kitchen'], [t(6.5), p.j ? 'k_well1' : 'k_srv2'], [8, 'k_srv' + p.j], [10, p.j ? 'k_granf' : 'k_hearth'], [12, 'k_srv' + p.j], [14, 'k_kitchen'], [15.5, p.j ? 'k_lane_w' : 'k_srv2'], [18, 'k_srv' + p.j], [22, 'k_kitchen']];
    case 'groom': return [[5, 'k_barr1'], [6, 'k_stable'], [8, 'wander:2,22,9,25@k_yard'], [11, 'k_stable'], [13, 'wander:2,22,9,25@k_yard'], [17, 'k_stable'], [20, 'k_barr1']];
    case 'smith': return [[5, 'k_barr1'], [7, 'k_smith'], [12, 'k_well1'], [13, 'k_smith'], [19, 'k_barr1']];
    case 'minstrel': return [[5, 'k_priv'], [10, 'k_plaza_e'], [12.5, 'k_min'], [14, 'k_bench1'], [17.5, 'k_min'], [22.5, 'k_priv']];
    case 'priest': return [[5, 'k_chapd'], [12.5, 'k_s3_2n'], [14, 'k_chapd'], [17, 'k_garden'], [18.5, 'k_s3_2n'], [21, 'k_chapd']];
  }
  return [[5, 'k_kitchen']]; }
function kPopulate(sid) { const M = KMAP, S = G.setts[sid]; KV.host = kHostOf(sid); KV.rl = S.ctrl; const P = kPeople(sid);
  for (const p of P) { let c = p.real; if (!c) { c = pseudoChar(20000 + (sid % 200) * 24 + p.k, p.role, p.fem, p.age, p.title); c.cul = M.key === 'B' ? 'K' : M.key; c.realm = M.rl; }
    const o = { talk: kTalk, sub: p.sub, spd: p.age < 14 ? 50 : p.age > 62 ? 36 : 44, home: kHome(p) }; if (p.post) o.post = p.post; else o.sched = kSched(p);
    if (['host', 'lady', 'heir', 'child', 'steward'].includes(p.job)) o.talkR = 56; const n = mkNpc('kv' + p.k, c, o); n.kv = p; }
  for (let k = 0; k < 2; k++) { const c = pseudoChar(40 + k, 'guard', 0, 24 + k * 5, 'Королевский стражник'); const n = mkNpc('kret' + k, c, { post: 'k_ret' + k, sub: 'Ваша стража', talk: folkRetinue }); n.ret = 1; }
  const A = (kind, loc, rc, col, n) => { for (let k = 0; k < (n || 1); k++) COURT.ani.push({ kind, loc, r: rc, x: (rc[0] + R.f() * (rc[2] - rc[0] + 1)) * CT, y: (rc[1] + R.f() * (rc[3] - rc[1] + 1)) * CT, tx: 0, ty: 0, t: R.f() * 3, flip: R.f() < 0.5, col, f: 0 }); };
  A('horse', 'k_yard', M.paddock, 'brown'); A('horse', 'k_yard', M.paddock, 'dwood'); A('horse', 'k_yard', M.horses, 'white'); A('horse', 'k_yard', M.horses, 'brown');
  A('hen', 'k_yard', [8, 34, 18, 35], null, 4); A('pigeon', 'k_yard', [19, 17, 30, 24], null, 4); A('dog', 'k_yard', [20, 12, 30, 30], null); A('cat', 'k_hall', [2, 7, 27, 16], null);
  if (M.nw === 'herbs') A('pigeon', 'k_yard', [8, 8, 12, 12], null, 2); if (M.kennel) A('hound', 'k_yard', M.kennel, null, 3);
  KV.mus = ''; KV.greet = 0; KV.chatT = 3; KV.chk = 0; KV.warn = 0; FOLK.notes = []; }
// ---------- arriving, leaving, life goes on ----------
function kEnter(sid) { const V = G.visit, mem = kMem(sid), s = WD.setts[sid], pa = playerArmy(), h = KV.host, hh = hourAbs(), night = hh >= 22 || hh < 6;
  if (pa) { pa.path = null; pa.onArrive = null; } G.player.follow = -1; const first = mem.v === 0, longAgo = mem.last < 0 || G.day - mem.last > 30; mem.v++; mem.last = G.day; V.pts = V.pts || 0;
  if (longAgo && h.t === 'vassal' && h.H) { houseLoy(h.H, 2); log('Король гостит в замке ' + s.name + ' у лорда ' + h.c.name + '. Дом ' + h.H.name + ' польщён.', 'good'); }
  else if (longAgo && h.t === 'ruler') { prestige(1); log('Король прибыл с визитом ко двору: ' + charName(h.c) + ', ' + realmName(h.rl) + '.', 'info'); }
  UI.toast(night ? 'Ночь. Стража узнала королевский стяг — ворота открываются.' : h.t === 'ruler' ? 'Трубят трубы: двор встречает короля!' : 'Ворота открываются: замок встречает короля.');
  const host = kHostNpc(); if (host) { host.override = { spot: 'k_plaza_n', until: hh + 1.2, day: G.day }; host.curT = null; KV.greet = 1; }
  if (typeof Snd !== 'undefined') Snd.sfx(h.t === 'ruler' ? 'fanfare' : 'horn'); if (first && typeof TUT !== 'undefined' && TUT.ev) TUT.ev('castle'); }
function kLeave() { KV.mus = ''; FOLK.notes = []; }
function kTitle(sid) { const s = WD.setts[sid], h = KV.host; return (s.type === 'capital' ? 'Столица ' : 'Замок ') + s.name + (h && h.t === 'ruler' ? ' · при дворе' : ' · в гостях'); }
function kUpdate(dt) { const V = G.visit, M = KMAP; if (!M || !COURT.p) return; const P = COURT.p, h = hourAbs(), host = kHostNpc();
  if (host && KV.greet && host.loc === COURT.loc && !host.path && Math.hypot(host.x - P.x, host.y - P.y) < 80 && !DLG.open()) { KV.greet = 0; say(host, kGreetShort(), 4.5); }
  // a war, a siege, the castle changing hands: the guest must go
  KV.chk -= dt; if (KV.chk <= 0) { KV.chk = 1; const S = G.setts[V.sid];
    if (!KV.warn && !DLG.open() && !UI.modalOpen() && (S.ctrl !== KV.rl || hostile(G.player.realm, S.ctrl) || S.siege)) { KV.warn = 1; if (G.speed > 0) UI.lastSpeed = G.speed; G.speed = 0; if (typeof Snd !== 'undefined') Snd.sfx('horn');
      DLG.say(null, S.ctrl !== KV.rl ? 'Замок перешёл в другие руки! Оставаться здесь опасно.' : S.siege ? 'Замок в осаде! Пока кольцо не сомкнулось, нужно уходить.' : 'Гонец: «Война, государь!» Хозяин бледнеет. Гостю здесь больше не место — пока его не взяли под стражу.', { name: 'Тревога!', choices: [{ t: 'Немедленно уехать', fx: () => visitLeave() }], esc: 0, onEnd: () => { if (kV()) visitLeave(); } }); } }
  // the morning after a night under the host's roof
  if (V.sleepFrom !== undefined && !COURT.sleepT && G.day > V.sleepFrom && h >= 6) { delete V.sleepFrom; kNightDone(); }
  // chatter near the king
  KV.chatT -= dt; if (KV.chatT <= 0) { KV.chatT = 3 + R.f() * 4; const din = kDinner();
    const near = h >= 22 || h < 6 ? [] : COURT.npcs.filter(n => n.kv && n.loc === COURT.loc && !n.away && !n.bub && !n.lie && n.kv.job !== 'host' && Math.hypot(n.x - P.x, n.y - P.y) < 100);
    if (near.length) { const n = R.pick(near); say(n, R.pick(din && n.sit ? K_CHAT.dine : n.kv.job === 'guard' ? K_CHAT.guard : n.c.age < 14 ? K_CHAT.kid : K_CHAT.day), 3); } }
  // the minstrel plays in the hall at meals and in the evening; notes float over him
  const ms = COURT.npcs.find(n => n.kv && n.kv.job === 'minstrel' && !n.away && !n.path && n.loc === 'k_hall' && n.curT === 'k_min'), play = !!ms && (kDinner() || (h >= 17.5 && h < 22.5));
  const want = COURT.loc === 'k_hall' && (play || kDinner()) ? 'feast' : 'auto'; if (want !== KV.mus) { KV.mus = want; if (typeof Snd !== 'undefined') Snd.music(want); }
  const NT = FOLK.notes || (FOLK.notes = []); if (play && ms.loc === COURT.loc && NT.length < 10 && R.chance(dt * 2.4)) NT.push({ loc: ms.loc, x: ms.x + R.range(-5, 6), y: ms.y - 24, t: 0, c: R.pick(['#f7d35c', '#f8f0d8', '#e88a6a']) });
  for (let i = NT.length - 1; i >= 0; i--) { NT[i].t += dt; if (NT[i].t > 1.6 || NT[i].loc !== COURT.loc) NT.splice(i, 1); } }
function kNightDone() { const V = G.visit; V.nights = (V.nights || 0) + 1; if (V.nights <= 3) { kBonus(1, 1); kPts(1); } UI.toast(R.pick(['Слуги принесли тёплой воды и свежего хлеба.', 'Хозяин рад, что вы остались под его кровом.'])); }
