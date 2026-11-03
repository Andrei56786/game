'use strict';
// ===== ADVICE (v3.6): the first time the king walks into a room or a building, rides into the forest, starts a hunt, rides out of the
// gate or bends over the map table, the advisor whose business it is says in a few lines what can be done there: a parchment panel at
// the bottom of the screen with the advisor's round portrait, «Без советов» (no more advice; the menu turns it back on) and «Понятно».
// A tip that stayed on the screen for 4 s or more counts as read; one passed by in a hurry comes back next time. One tip per entry.
// G.adv = { on, seen: { key: day } } (old saves: created on first use, advice on) =====
const ADV_READ = 4, ADV_MAX = 40;
// key → { who: seat key | 'srv:<servant>' | 'mentor', t: text, ok?: condition, also?: keys read together }
const ADVD = {
  'keep:Тронный зал': { who: 'chancellor', t: 'Тронный зал, государь. С 9 до 12 у трона ждут просители: сядьте на трон (E) — и начнётся приём. Приглядывайтесь: под видом просителя может прийти и чужой лазутчик. Лестница в глубине — наверх, к покоям придворных.' },
  'keep:Зал совета': { who: 'chancellor', t: 'Зал совета. Малый совет собирается по четвергам в 9:30; сядьте во главе стола (E), чтобы раздать дела или созвать совет срочно (окно совета — K). На столе — карта королевства (Tab): вся держава, приказы войскам и поездки.' },
  'keep:Библиотека': { who: 'magister', t: 'Библиотека. «Книги и исследования» (J) — знания королевства: дайте магистру тему или позвольте выбирать самому. «Почитать книгу» — один вечер в день; шесть вечеров — навык короля +1.' },
  'keep:Королевские покои': { who: 'seneschal', t: 'Королевские покои. Лягте спать (E) — ночь пролетит до утра; если случится важное, вас разбудят. Когда в семье младенец — загляните к колыбели. Семья и наследники — окно F.' },
  'keep:Казна': { who: 'treasurer', t: 'Казна. Казначей ведёт книги — и только он знает, сколько в них правды. Осмотрите казну (E) и пересчитайте монеты сами (≈3 часа): недостача выдаст вора.' },
  'keep:Кабинет Ока': { who: 'eye', t: 'Кабинет Ока. На доске (E) — донесения, досье и тайны двора. Пташки Ока сами следят за советниками и кандидатами: чем выше Тень у Ока, тем быстрее и вернее вести.' },
  'upper': { who: 'seneschal', t: 'Верхний этаж: покои королевы, галерея предков, детская, комнаты советников и слуг. Днём советники на службе, ночью спят у себя.' },
  'upper:Галерея предков': { who: 'chancellor', t: 'Галерея предков. Подойдите к раме — узнаете, кем был предок и чем памятен. Место посередине ждёт парадный портрет государя: его заказывают у стола зодчего (P).', also: ['upper'] },
  'upper:Детская': { who: 'magister', t: 'Детская. Здесь растут наследники; учит их магистр — выбирайте его с умом. Нрав складывается с детства.', also: ['upper'] },
  'upper:Покои королевы': { who: 'seneschal', ok: () => { const k = kingC(), q = k && k.spouse >= 0 ? charOf(k.spouse) : null; return !k.fem && q && q.alive; }, t: 'Покои королевы. Утро и вечер королева проводит здесь. Поговорите с ней — её расположение значит мир в семье; шёлковый платок с лотка во дворе её порадует.', also: ['upper'] },
  'upper:Звездочётная': { who: 'magister', ok: () => projDone('observatory'), t: 'Звездочётная. Ночью посмотрите в медную трубу — по звёздам и облакам видно погоду на дни вперёд. Днём в трубу видны только крыши.', also: ['upper'] },
  'dungeon': { who: 'srv:jailer', t: 'Темница, государь. Пленники ждут вашего слова: допросить (откроют тайну двора или вести о чужой державе), помиловать, отпустить за выкуп, взять на службу или казнить. Кто где сидит — знаю я, спросите.' },
  'hall': { who: 'seneschal', t: 'Пиршественный зал. Пиры устраивает сенешаль — поручение «Устроить пир» (можно велеть и у высокого стола). В день пира с 17:00 съезжается знать: займите место во главе стола. Охотничьи трофеи вешают на стены.' },
  'chapel': { who: 'srv:chaplain', t: () => 'Часовня, государь. Раз в день помолитесь у алтаря — о здравии, о победе или мире, о мудрости, о наследнике. По воскресеньям в ' + MASS_H0 + ':00 — обедня: сядьте на королевскую скамью, знать это ценит.' },
  'yard:Двор замка': { who: 'seneschal', t: 'Двор замка. Ворота на юге — в королевство. Конюшни и голубятня (письма) — на западе, амбар, кухня и лоток торговца — в хозяйственном дворе, кузня и казармы — на юго-востоке. Проход у казарм ведёт на восточный двор: часовня, пиры, турниры, псарня.' },
  'yard:Ворота замка': { who: 'marshal', t: 'Ворота замка. Выехать можно со свитой — налегке — или во главе войска у столицы. Пока король в пути, двор живёт без него: приёмы и советы пройдут без государя.' },
  'yard:Конюшни': { who: 'srv:stable', t: 'Конюшня, государь. Скажите — подам осёдланного гнедого: это тоже выезд из замка. Письма державам и вассалам пишут в голубятне, в углу двора (L).' },
  'yard:Хозяйственный двор': { who: 'seneschal', t: 'Хозяйственный двор. В амбаре — хлеб королевства: оброк зерном везут в жатву и после обмолота, зимой двор живёт запасом; неприкосновенный запас в поход не берут. Тут же кухня и лоток торговца.' },
  'yard:Кузня и казармы': { who: 'marshal', t: 'Кузня и казармы. Здесь гарнизон столицы и королевская стража; набор рекрутов ведёт маршал. Чучело для упражнений — на ристалище, к северу отсюда.' },
  'yard:Ристалище': { who: 'srv:master', t: 'Ристалище, государь. Раз в день поупражняйтесь с мечом у чучела (E): шесть дней — и Меч короля +1. Раненому королю лекарь не позволит.' },
  'yard:Сад': { who: 'eye', t: 'Сад. Ночью здесь шепчутся придворные. Зажмите Shift — король пойдёт крадучись, — держитесь тени и слушайте: так узнают тайны.' },
  'yard:Турнирное поле': { who: 'seneschal', t: 'Турнирное поле. Турниры устраивает сенешаль — поручение «Турнир». С трибунами (стол зодчего, P) восемь рыцарей бьются здесь на копьях, и король может выехать сам.' },
  'yard:Псарня': { who: 'srv:hunter', t: () => 'Псарня, государь! Отсюда — на охоту: гон оленя, кабан' + (projDone('falconry') ? ' или сокол' : '; с соколом — когда построят соколятню (P)') + '. Спутника можно взять из придворных. В лесу бывает и медведь.' },
  'hunt': { who: 'srv:hunter', also: ['forest'], t: 'Добрая охота, государь! Зажмите левую кнопку мыши — лук натянется; наведите и отпустите. Дольше натяг — дальше и сильнее, но рука устаёт. Бейте под лопатку — вдвое сильнее: кабану нужно 3–4 стрелы, медведю 6–7. Q — оружие, G — разделиться: я с гончими найду зверя и протрублю в рог.' },
  'hunt_falcon': { who: 'srv:hunter', also: ['forest'], t: 'Соколиная охота, государь. Наведите на дичь — фазана, утку, зайца — и нажмите E (или щёлкните): сокол сорвётся с перчатки. Лук тоже при вас: зажмите левую кнопку, наведите и отпустите.' },
  'forest': { who: 'srv:hunter', t: 'Королевский лес: двенадцать полян, на юго-востоке — глухая чаща. Охоту начинают на псарне, у ловчего: без гончих зверь близко не подпустит.' },
  'forest:Чаща': { who: 'srv:hunter', also: ['forest'], t: 'Чаща. Ветки ловят стрелы — ищите чистый прострел. Секач и медведь бросаются, если подойти близко: рогатина (Q) наготове, и не стойте на пути.' },
  'map': { who: 'marshal', t: 'Король в седле! ЛКМ по карте — идти (путь и дни покажутся), по поселению — туда, по врагу — в погоню; ПКМ — стоять. Пробел — пауза, 1–3 — скорость, H — справка. Ко двору — к столице: «Въехать в замок».' },
  'maptable': { who: 'chancellor', t: 'Стол карт: вся держава как на ладони. Войскам короны приказы везут гонцы — чем дальше войско, тем дольше. Выберите город — и можно поехать туда самому. «Ко двору» (Tab) — обратно в зал.' },
  'v_out:v': { who: 'mentor', t: 'Деревня. Староста расскажет о нуждах — помощь золотом народ запомнит. Доска у колодца — просьбы и объявления, в корчме — слухи и кости. Неузнанному королю люди скажут правду. Tab — обратно к войску.' },
  'v_out:t': { who: 'mentor', t: 'Город. Бургомистр в ратуше — о нуждах горожан, в городских книгах — подати, пошлины и цены. На площади — рынок, в корчме — слухи и бард. Неузнанному королю горожане скажут правду. Tab — обратно к войску.' },
  'v_tav': { who: 'mentor', t: 'Корчма. Здесь болтают обо всём — слушайте. Кости — за столом; комната наверху — ночлег.' },
  'k_yard:own': { who: 'mentor', t: 'Замок короны. Кастелян доложит о гарнизоне и припасах; гарнизон можно наградить. Tab или ворота — обратно к войску.' },
  'k_yard:vas': { who: 'mentor', t: 'Замок вассала. Хозяин расскажет о своих землях и о настроениях знатных домов; милость его дому укрепит верность. Tab или ворота — обратно к войску.' },
  'k_yard:foe': { who: 'mentor', t: 'Чужой двор. Хозяин примет вас в зале: дар, вести, беседы с домочадцами; ключник за кошель расскажет о гарнизоне. Ужин за высоким столом и ночь под кровом хозяина улучшат его мнение о вас — а с ним и дела державы.' },
};
const ADV = { cur: null, vis: 0, ctx: '', done: '', snd: '', pk: '', pc: null };
function advS() { if (!G) return null; if (!G.adv) G.adv = { on: /^#court/.test(location.hash) && !/adv/.test(location.hash) ? 0 : 1, seen: {} }; return G.adv; }
function advOn() { const A = advS(); return !!(A && A.on); }
// where the king is now: the context and the tips that fit it, most particular first
function advCtx() {
  if (SCREEN === 'map') return G.atCourt ? (G.court && G.court.view ? ['maptable', ['maptable']] : null) : ['map', ['map']];
  if (SCREEN !== 'court' || !COURT.p) return null; const L = COURT.loc, rn = COURT.room, HU = COURT.hunt;
  if (!rn) return null; const ks = [];
  if (L === 'forest' && HU && !HU.ended) ks.push(HU.kind === 'falcon' ? 'hunt_falcon' : 'hunt');
  if (L === 'v_out') ks.push('v_out:' + (VMAP && VMAP.town ? 't' : 'v'));
  else if (L === 'k_yard') ks.push('k_yard:' + (KMAP && KMAP.rl === G.player.realm ? (KMAP.H ? 'vas' : 'own') : 'foe'));
  else { ks.push(L + ':' + rn); ks.push(L); }
  return [L + ':' + rn, ks]; }
function advPick() { const A = advS(); if (!A || !A.on) return null; const c = advCtx(); if (!c) { ADV.done = ''; return null; } const [cx, ks] = c;
  if (cx !== ADV.ctx) { ADV.ctx = cx; ADV.done = ''; } if (ADV.done === cx) return null;
  for (const k of ks) { const d = ADVD[k]; if (d && !A.seen[k] && (!d.ok || d.ok())) return k; } return null; }
function advSeen(k) { const A = advS(), d = ADVD[k]; if (!A || !k) return; A.seen[k] = G.day + 1; if (d && d.also) for (const a of d.also) A.seen[a] = A.seen[a] || G.day + 1; }
function advWho(w) {
  if (w && w.startsWith('srv:')) { const k = w.slice(4), i = SERVANTS.findIndex(s => s[0] === k); if (i >= 0) { const s = SERVANTS[i], n = npcByKey('srv_' + k); return { c: (n && n.c) || pseudoChar(i, s[1], s[2], s[3], s[4]), n: s[4] }; } }
  if (w && seatDef(w)) { const c = seatChar(w); if (c) return { c, n: seatName(w) + ' · ' + charName(c) }; }
  return { c: MENTOR, n: MENTOR.name }; }
// the advisor's portrait cut into a circle (hard pixel edge), cached for the current advisor
function advDisc(c) { const key = c.id + ':' + (c.age | 0) + ':' + (c.alive ? 1 : 0); if (ADV.pk === key && ADV.pc) return ADV.pc; const p = portrait(c); if (!p) return null;
  const cv = document.createElement('canvas'); cv.width = cv.height = 48; const g = cv.getContext('2d'); g.drawImage(p, 0, 0); g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#000'; g.beginPath(); // one path: each separate fill would wipe the rest
  for (let y = 0; y < 48; y++) { const dy = y + 0.5 - 24, hw = Math.sqrt(Math.max(0, 23.4 * 23.4 - dy * dy)), a = Math.round(24 - hw), b = Math.round(24 + hw); if (b > a) g.rect(a, y, b - a, 1); }
  g.fill();
  ADV.pk = key; ADV.pc = cv; return cv; }
function advRound(cx, cy, r, col) { const n = Math.ceil(r); for (let y = -n; y < n; y++) { const dy = y + 0.5, hw = Math.sqrt(Math.max(0, r * r - dy * dy)), a = Math.round(cx - hw), b = Math.round(cx + hw); if (b > a) rect(a, cy + y, b - a, 1, col); } }
function advBlocked() { if (UI.modalOpen() || UI.win || DLG.open() || (G.over && !G.over.ack)) return true;
  if (SCREEN === 'court') return courtBlocked() || !!COURT.sleepT || (typeof HEAL !== 'undefined' && HEAL.on) || (typeof TRN !== 'undefined' && !!TRN.kj); return false; }
function advClose(off) { const k = ADV.cur; advSeen(k); ADV.done = ADV.ctx; ADV.cur = null; ADV.vis = 0;
  if (off) { advS().on = 0; UI.toast('Советы выключены. Включить снова — в меню (Esc).'); } }
function advFrame() { if (!G || (SCREEN !== 'court' && SCREEN !== 'map')) return;
  const k = advPick(); if (k !== ADV.cur) { if (ADV.cur && ADV.vis >= ADV_READ) advSeen(ADV.cur); ADV.cur = k; ADV.vis = 0; }
  if (!ADV.cur || advBlocked()) return; const d = ADVD[ADV.cur]; if (!d) { ADV.cur = null; return; }
  if (ADV.vis === 0 && ADV.snd !== ADV.cur) { ADV.snd = ADV.cur; if (typeof Snd !== 'undefined') Snd.sfx('paper'); }
  ADV.vis += Math.min(DT, 0.1); if (ADV.vis > ADV_MAX) { advClose(false); return; } advDraw(d); }
function advDraw(d) { const who = advWho(d.who), t = typeof d.t === 'function' ? d.t() : d.t, PW = 368, TX = 66, lines = wrap(t, PW - TX - 10, {});
  const h = Math.max(66, 22 + lines.length * 10 + 27), x = (W - PW) >> 1, y = SCREEN === 'map' ? 62 : H - 38 - h, a = clamp(ADV.vis * 5, 0, 1); ctx.globalAlpha = a;
  hit(x, y, PW, h, { id: 'adv_bg' }); panelParch(x, y, PW, h);
  const pcx = x + 32, pcy = y + (h >> 1) - 2; advRound(pcx, pcy, 28, '#24160c'); advRound(pcx, pcy, 27, '#c89a48'); advRound(pcx, pcy, 25.6, '#f0d488'); advRound(pcx, pcy, 25, '#8a6428'); advRound(pcx, pcy, 24, '#2a1a10');
  const pd = advDisc(who.c); if (pd) ctx.drawImage(pd, pcx - 24, pcy - 24);
  txt(who.n, x + TX, y + 7, '#7a3a10', { f: 's' }); hline(x + TX, y + 16, PW - TX - 10, 'rgba(122,74,30,0.35)');
  lines.forEach((l, i) => txt(l, x + TX, y + 21 + i * 10, INK));
  // «Понятно» — a dark red button, «Без советов» — a quiet link beside it (as in the sketch the player sent)
  const bw = 82, bh = 17, bx = x + PW - bw - 9, by = y + h - bh - 7, hv = hov('adv_ok');
  rect(bx, by, bw, bh, '#2a0e0a'); rect(bx + 1, by + 1, bw - 2, bh - 2, hv ? '#7a2a1e' : '#5c1c16'); hline(bx + 1, by + 1, bw - 2, hv ? '#9a4232' : '#7a3024'); hline(bx + 1, by + bh - 2, bw - 2, '#3a120c');
  txt('Понятно', bx + bw / 2, by + 5, '#f6e6c6', { al: 'c' }); hit(bx, by, bw, bh, { id: 'adv_ok', cursor: true, onClick: () => advClose(false) });
  const ot = 'Без советов', ow = tw(ot, { f: 's' }), ox = bx - ow - 14, oy = by + 6, ho = hov('adv_off');
  txt(ot, ox, oy, ho ? '#2a1a10' : '#6a5038', { f: 's' }); if (ho) hline(ox, oy + 8, ow, '#2a1a10');
  hit(ox - 4, by, ow + 8, bh, { id: 'adv_off', cursor: true, tip: ['Без советов', 'Советники больше не будут подсказывать при входе. Включить снова — в меню (Esc) → «Советы».'], onClick: () => advClose(true) });
  ctx.globalAlpha = 1; }
{ const dp0 = TUT.drawPanel; TUT.drawPanel = function () { dp0.call(this); try { advFrame(); } catch (e) { onErr(e); } }; }
