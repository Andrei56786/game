'use strict';
// ===== FOLK ACTS (v3.3): the tavern and its people, the bard, the trader, guards and guests; things to use in a village; the way in from the settlement window =====
// ---------- the tavern ----------
function folkPatrons() { return COURT.npcs.filter(m => m.folk && m.loc === 'v_tav' && !m.away && !['keeper', 'maid'].includes(m.folk.job)); }
function folkRoomOk() { const m = G.visit && folkMem(G.visit.sid); return !!m && (m.room === G.day || (m.room === G.day - 1 && hourAbs() < 11)); }
function folkTalkKeeper(n) { const sid = G.visit.sid, mem = folkMem(sid), incog = folkIncog(), town = VMAP.town, np = folkPatrons().length, treat = 2 + np, h = hourAbs();
  const hi = incog ? R.pick(['Чего изволите, добрый человек? Эль свежий, похлёбка горячая.', 'Заходи, путник, грейся! Что нальём?']) : 'Кланяется, вытирая руки о передник: «Ваше величество! Лучшее место у огня — для вас! Эль — за счёт заведения!»';
  const ch = [{ t: 'Кружку эля' + (incog ? ' (1 зол.)' : ''), ...payOk(incog ? 1 : 0), fx: () => { if (incog && !spend(1)) return; mem.ale = (mem.ale || 0) + 1; Snd.sfx('coin'); folkSayRumor(n, 'tav', R.pick(['Эль густой, с горчинкой. ', 'Пена шапкой. Хорош! ', 'Тёмный, ячменный — тут такой варят. ']) + 'Корчмарь облокачивается на стойку: «'); } },
    { t: 'Угостить всех (−' + treat + ' зол.)', tip: 'Народ поднимет кружки — и запомнит щедрость.', ...payOk(treat), fx: () => folkTreat(n, treat) },
    { t: folkRoomOk() ? 'Комната ваша — наверху' : 'Снять комнату на ночь (−3 зол.)', tip: 'Переночевать: по лестнице наверх — и в постель.', ok: () => folkRoomOk() || gold0() >= 3, why: 'Не хватает золота.', fx: () => { if (!folkRoomOk()) { if (!spend(3)) return; mem.room = h < 6 ? G.day - 1 : G.day; Snd.sfx('coin'); } DLG.say(n, 'Комната наверху, по лестнице направо. Постель чистая, клопов нет — побожусь!'); } },
    { t: 'Сыграть в кости', fx: () => folkDice(n) }, { t: 'Прощай', fx: () => { } }];
  DLG.say(n, hi, { choices: ch, esc: ch.length - 1 }); }
function folkTreat(n, g) { const sid = G.visit.sid, mem = folkMem(sid), incog = folkIncog(); if (!spend(g)) return; Snd.sfx('coin'); const first = mem.treat !== G.day; mem.treat = G.day;
  if (first) { mem.mood = clamp((mem.mood || 0) + 2, -50, 50); if (!incog) prestige(1); }
  for (const m of folkPatrons()) say(m, incog ? R.pick(['За щедрого путника!', 'Здоровья тебе, добрый человек!', 'Вот это я понимаю!']) : R.pick(['За короля!', 'Слава королю!', 'Многая лета!']), 3.5);
  DLG.say(n, incog ? 'Корчмарь гремит кружками: «Всем — за счёт вон того господина!» По корчме прокатывается радостный гул. Языки развязываются…' : 'Корчмарь гремит кружками: «Король угощает!» Стены дрожат от здравиц.', { onEnd: () => { if (incog) { const pt = folkPatrons().filter(m => m.folk.job !== 'bard'); const m = pt.length ? R.pick(pt) : n; folkSayRumor(m, 'tav', 'Подсаживается захмелевший сосед: «'); } } }); }
function folkDice(n) { const V = G.visit; V.dice = V.dice || { w: 0, d: G.day }; if (V.dice.d !== G.day) V.dice = { w: 0, d: G.day };
  if (V.dice.w >= 3) { DLG.say(n, 'Игроки отодвигаются: «Хватит! Обчистил ты нас, ' + folkSir() + '. Ищи других дураков».'); return; }
  const bet = g => ({ t: 'Поставить ' + g + ' зол.', ...payOk(g), fx: () => { const r2 = () => R.i(1, 6) + R.i(1, 6); let a = r2(), b = r2(); while (a === b) { a = r2(); b = r2(); } Snd.sfx('click');
    if (a > b) { G.realms[0].gold += g; V.dice.w++; Snd.sfx('coin'); DLG.say(null, 'Кости стучат по столу… У вас ' + a + ', у соперника ' + b + '. Выигрыш — ' + g + ' зол.!' + (V.dice.w >= 3 ? ' Соперник мрачнеет.' : ''), { name: 'Кости', choices: [{ t: 'Ещё кон', fx: () => folkDice(n) }, { t: 'Хватит', fx: () => { } }], esc: 1 }); }
    else { G.realms[0].gold -= g; DLG.say(null, 'Кости стучат по столу… У вас ' + a + ', у соперника ' + b + '. Проигрыш — ' + g + ' зол.', { name: 'Кости', choices: [{ t: 'Отыграться', fx: () => folkDice(n) }, { t: 'Хватит', fx: () => { } }], esc: 1 }); } } });
  DLG.say(null, 'За столом у стены играют в кости. «Садись, ' + folkSir() + '! Кто больше выбросит — тот и забирает».', { name: 'Кости', choices: [bet(5), bet(20), { t: 'Не играть', fx: () => { } }], esc: 2 }); }
function folkTalkMaid(n) { const incog = folkIncog(); DLG.say(n, incog ? R.pick(['Ой, а вы нездешний! Издалека? Ещё эля?', 'Руки при себе, путник! …Шучу. Чего принести?']) : R.pick(['Ой! Ваше величество… *роняет кружку* Простите!', 'Ваше величество! Я… я сейчас, мигом!']), { choices: [
  { t: 'Что тут говорят?', fx: () => folkSayRumor(n, 'tav', 'Шепчет, оглядываясь: «') }, { t: 'Ступай', fx: () => { } }], esc: 1 }); }
// ---------- the priest, the herbwife, the bard ----------
function folkTalkPriest(n) { const sid = G.visit.sid, mem = folkMem(sid), incog = folkIncog();
  const ch = [{ t: 'Пожертвовать на храм (−10 зол.)', ...payOk(10), fx: () => { if (!spend(10)) return; Snd.sfx('bell'); const first = mem.alms !== seasonOf(G.day) + 4 * Math.floor(G.day / DAYS_YEAR); mem.alms = seasonOf(G.day) + 4 * Math.floor(G.day / DAYS_YEAR); if (first) { mem.mood = clamp((mem.mood || 0) + 2, -50, 50); provUnrest(sid, -1); if (!incog) prestige(1); } DLG.say(n, 'Благословляет вас: «Да воздастся тебе, сын мой. На эти деньги починим крышу и накормим сирот».'); } },
    { t: 'Как паства?', fx: () => DLG.say(n, incog ? 'Пьют много, молятся мало. А про короля… ' + folkWhy(sid)[0] : folkOpinion(sid) >= 0 ? 'Паства молится за ваше здравие, государь. Сердца людей спокойны.' : 'Скажу по совести, государь: люди ропщут. ' + folkWhy(sid)[0]) },
    { t: 'Прощай, отче', fx: () => { } }];
  DLG.say(n, incog ? 'Мир тебе, странник. Ищешь утешения или ночлега?' : 'Ваше величество! Благословен день, когда король посещает наш скромный храм.', { choices: ch, esc: 2 }); }
function folkTalkHerb(n) { const k = kingC(), wounded = k.wound > G.day, incog = folkIncog();
  const ch = []; if (wounded) ch.push({ t: 'Залечить рану (−5 зол.)', tip: 'Травница знает своё дело: рана затянется.', ...payOk(5), fx: () => { if (!spend(5)) return; k.wound = G.day; Snd.sfx('chime'); log('Знахарка из ' + folkW().name + ' залечила рану короля.', 'good'); DLG.say(n, 'Прикладывает жгучую мазь, шепчет что-то над повязкой. «Всё. К утру забудешь, где болело». Боль и правда уходит.'); } });
  ch.push({ t: 'Погадать (−2 зол.)', ...payOk(2), fx: () => { if (!spend(2)) return; DLG.say(n, folkFortune()); } }); ch.push({ t: 'Прощай', fx: () => { } });
  DLG.say(n, (wounded ? 'Окидывает вас взглядом: «Хромаешь, ' + (incog ? 'соколик' : 'государь') + '. Рана-то гноится. Дай-ка гляну».' : 'Щурится: «Здоров ты, ' + (incog ? 'соколик' : 'государь') + ', как бык. Зачем пришёл к старой травнице?»'), { choices: ch, esc: ch.length - 1 }); }
function folkFortune() { const k = kingC(), h = heirOf(), wars = warsOf(G.player.realm).filter(r => r < 5), o = [];
  if (wars.length) o.push('Вижу огонь и железо… ' + REALM_DEF[wars[0]].name + ' — не последний твой враг. Но и не самый страшный.');
  if (!h) o.push('Вижу пустую колыбель… Наследник нужен тебе, ох как нужен.'); else o.push('Вижу корону на юной голове. ' + h.name + ' — береги это дитя.');
  if ((G.court && G.court.secrets || []).some(s => !s.known && s.k === 'plot')) o.push('Вижу змею у трона. Улыбается тебе — а за пазухой нож.');
  if (k.age > 55) o.push('Вижу долгую зиму… Не спеши, король. Всему своё время.');
  o.push('Вижу дорогу и чужой замок. Хлеб там сладкий, да вино с горчинкой.', 'Вижу золото, что течёт сквозь пальцы. Считай монеты, король, — их считают и другие.');
  return 'Сыплет травы в огонь, глядит в дым… «' + R.pick(o) + '»'; }
const FOLK_SONGS = { hero: 'Поёт балладу о короле, что разбил врагов у брода и вернулся с победой. Корчма подпевает припев: «Слава, слава королю!»', mock: 'Поёт весёлую песенку о короле, что «пиры пирует, казну ворует». Корчма хохочет. Вы смеётесь вместе со всеми — иначе нельзя.', plain: ['Поёт о прекрасной мельничихе и неудачливом рыцаре. Корчма утирает слёзы от смеха.', 'Поёт старинную балладу о драконе с северных гор. В корчме становится тихо.', 'Играет плясовую — и половина корчмы пускается в пляс.'] };
function folkTalkBard(n) { const incog = folkIncog(), pr = (G.court && G.court.prestige) || 0, mem = folkMem(G.visit.sid);
  DLG.say(n, incog ? 'Подкручивает колки лютни: «Песню, путник? За медяк спою, за серебряный — сочиню!»' : 'Вскакивает и отвешивает поклон до пола: «Ваше величество! Позвольте спеть в вашу честь!»', { choices: [
    { t: 'Спой о короле (−2 зол.)', ...payOk(2), fx: () => { if (!spend(2)) return; Snd.sfx('coin'); const t = !incog || pr >= 25 ? FOLK_SONGS.hero : pr <= -15 ? FOLK_SONGS.mock : R.pick(FOLK_SONGS.plain); if (mem.song !== G.day) { mem.song = G.day; mem.mood = clamp((mem.mood || 0) + 1, -50, 50); } DLG.say(n, t + (incog && pr <= -15 ? ' Вот что поют о вас в народе.' : '')); } },
    { t: 'Спой что-нибудь весёлое (−1 зол.)', ...payOk(1), fx: () => { if (!spend(1)) return; DLG.say(n, R.pick(FOLK_SONGS.plain)); } },
    { t: 'Откуда ты?', fx: () => folkSayRumor(n, 'tav', 'Я хожу по всем землям, ' + folkSir() + '. Вот что слышал по дороге: ') }, { t: 'Прощай', fx: () => { } }], esc: 3 }); }
// ---------- traders, guards, guests, children, the old ----------
function folkTalkTrader(n) { const sid = G.visit.sid, S = folkS(), incog = folkIncog(), k = R.pick(['food', 'weap', 'horses', 'arrows']), rel = pxRel(S, k);
  DLG.say(n, (incog ? 'Подходи, не стесняйся! ' : 'Ваше величество! Для вас — лучший товар! ') + ({ food: 'Хлеб', weap: 'Оружие', horses: 'Кони', arrows: 'Стрелы' }[k]) + ' нынче ' + (rel > 1.25 ? 'дорогие — не подступишься.' : rel < 0.8 ? 'дешёвые, бери, пока есть!' : 'по обычной цене.'), { choices: [
    { t: 'Посмотреть товары (рынок)', fx: () => { UI.open({ k: 'sett', id: sid }); UI.tab = 0; } }, { t: 'Какие новости?', fx: () => folkSayRumor(n, 'out') }, { t: 'Прощай', fx: () => { } }], esc: 2 }); }
function folkTalkGuard(n) { const incog = folkIncog(); DLG.say(n, incog ? R.pick(['Проходи, путник, не задерживайся.', 'Кто таков? Откуда? …Ладно, иди.', 'Оружие в городе не обнажать — понял?']) : 'Вытягивается в струнку: «Ваше величество! В городе порядок!»', { choices: [{ t: 'Что слышно на дорогах?', fx: () => folkSayRumor(n, 'out') }, { t: 'Ступай', fx: () => { } }], esc: 1 }); }
function folkTalkGuest(n) { const incog = folkIncog(), r = [];
  for (let a = 0; a < 5; a++) { if (a === G.player.realm) continue; const ru = G.realms[a] && charOf(G.realms[a].ruler); if (ru && ru.alive) r.push('В землях ' + REALM_DEF[a].name + ' правит ' + ru.name + ' — ' + ((ru.traits || []).map(t => TRAITS[t] && TRAITS[t].n.toLowerCase()).filter(Boolean).slice(0, 2).join(' и ') || 'человек скрытный') + ', говорят.'); }
  DLG.say(n, incog ? 'Отодвигает миску: «Я в пути третью неделю. Садись, расскажу, что видел».' : 'Встаёт и кланяется: «Ваше величество! Я лишь путник, но если хотите знать, что творится в мире…»', { choices: [
    { t: 'Что видел в чужих землях?', fx: () => DLG.say(n, r.length ? R.pick(r) : 'Везде одно и то же: подати, войны да дожди.') }, { t: 'Что слышно на дорогах?', fx: () => folkSayRumor(n, 'out') }, { t: 'Доброго пути', fx: () => { } }], esc: 2 }); }
function folkTalkKid(n) { const incog = folkIncog(), mem = folkMem(G.visit.sid);
  DLG.say(n, incog ? R.pick(['Дяденька, а вы рыцарь? А меч у вас есть?', 'А мамка говорит, с чужими нельзя!', 'А я знаю, где у мельника гнездо аиста!']) : R.pick(['А вы правда король? А где корона?', 'Дяденька король, а покатайте на коне!', 'Мне мама говорит, вы самый главный!']), { choices: [
    { t: 'Дать медовый пряник', fx: () => { if (mem.kid !== G.day) { mem.kid = G.day; mem.mood = clamp((mem.mood || 0) + 1, -50, 50); } say(n, 'Ура-а!', 3); DLG.say(n, 'Хватает пряник и убегает, сияя: «Мамка! Мне король пряник дал!»'); } }, { t: 'Беги играть', fx: () => { } }], esc: 1 }); }
function folkTalkElder(n) { const k = kingC(), dad = (k.parents || []).map(charOf).find(c => c && !c.fem) || null;
  const old = [dad ? 'Помню вашего батюшку, ' + dad.name + '. Строгий был государь, да справедливый.' : 'Видал я на веку трёх королей. Все они начинали хорошо.', 'В голодный год, помню, кору ели. Не дай бог такого опять.', 'Раньше тут лес стоял до самой реки. А теперь — поля да дороги.'];
  DLG.say(n, folkIncog() ? 'Щурится подслеповато: «Садись, сынок. Стар я — люблю поговорить».' : 'Пытается подняться: «Ваше величество… Простите старика, ноги не держат».', { choices: [
    { t: 'Расскажи о старых временах', fx: () => DLG.say(n, R.pick(old)) },
    { t: 'Что люди думают о короле? Скажи честно', tip: 'Старикам бояться нечего — скажут как есть.', fx: () => DLG.say(n, (folkIncog() ? '' : 'Я старый, государь, мне бояться нечего. Скажу как есть: ') + folkOpinionLine(n)) }, { t: 'Береги себя, отец', fx: () => { } }], esc: 2 }); }
function folkRetinue(n) { DLG.say(n, 'Кони осёдланы, государь. Ждём приказа.', { choices: [{ t: 'Едем к войску', fx: () => visitLeave() }, { t: 'Ждите', fx: () => { } }], esc: 1 }); }
// ---------- places to use ----------
ACTS_EXT.v_exit = () => DLG.say(null, (VMAP && VMAP.town ? 'За воротами' : 'За околицей') + ' ждут кони и стража. Вернуться к войску?', { choices: [{ t: 'Уехать', fx: () => visitLeave() }, { t: 'Остаться', fx: () => { } }], esc: 1 });
ACTS_EXT.v_well = () => { const W0 = COURT.npcs.filter(m => m.folk && m.c.fem && !m.away && m.loc === 'v_out' && Math.hypot(m.x - COURT.p.x, m.y - COURT.p.y) < 60);
  if (W0.length && folkIncog()) folkSayRumor(W0[0], 'out', 'Бабы у колодца судачат: «'); else DLG.say(null, R.pick(['Ведро скрипит на вороте. Вода студёная, аж зубы ломит.', 'Колодезный сруб потемнел от времени. Вода вкусная, сладкая.'])); };
ACTS_EXT.v_fount = () => DLG.say(null, 'На дне фонтана блестят монеты: горожане бросают их на счастье.', { choices: [{ t: 'Бросить монету (1 зол.)', ...payOk(1), fx: () => { if (!spend(1)) return; Snd.sfx('coin'); UI.toast(R.pick(['Монета булькнула. Говорят, к удаче.', 'Мальчишки уже примеряются, как бы её достать.'])); } }, { t: 'Уйти', fx: () => { } }], esc: 1 });
ACTS_EXT.v_board = () => { const sid = G.visit.sid, nd = folkNeed(sid), mem = folkMem(sid), t = ['«Продаётся корова, смирная. Спросить у ' + R.pick(COURT.npcs.filter(m => m.folk && m.c.age > 20)).c.name + '».', '«Пропала коза, белая с чёрным ухом. Нашедшему — пирог».'];
  if (nd) t.unshift('«Сход решил: ' + nd.n.toLowerCase() + '. Нужны деньги — ' + nd.g + ' зол. Кто может, помогите».'); if (folkFestOn() || mem.fest === G.day) t.unshift('«Сегодня вечером — праздник на лугу! Музыка, пляски!»');
  DLG.say(null, ['На доске у колодца прибиты записки:', t.join(' ')], { name: 'Доска у колодца' }); };
for (let i = 0; i < 10; i++) ACTS_EXT['v_stall' + i] = () => { const n = COURT.npcs.find(m => m.folk && m.folk.st === i && !m.away && !m.path && m.loc === 'v_out'); if (n) folkTalkTrader(n); else DLG.say(null, 'Лоток пуст: торговец ушёл.'); };
ACTS_EXT.v_dice = () => folkDice(null);
ACTS_EXT.v_bed = () => { const h = hourAbs(), sp = LOCS.v_room && LOCS.v_room.spots.vr_bed; if (!sp) return;
  const ch = []; if (h >= 18.5 || h < 6) ch.push({ t: 'Лечь спать до утра', fx: () => sleepUntil(6.5 + 24 * (h >= 6 ? 1 : 0), sp) }); ch.push({ t: 'Отдохнуть пару часов', fx: () => sleepUntil(h + 2, sp) }); ch.push({ t: 'Не сейчас', fx: () => { } });
  DLG.say(null, 'Узкая постель с соломенным тюфяком. Снизу доносится гул голосов.', { choices: ch, esc: ch.length - 1 }); };
ACTS_EXT.v_books = () => DLG.say(null, ['Писари ведут городские книги: подати, пошлины, цены.', folkReport(G.visit.sid)], { name: 'Городские книги' });
DOOR_EXT.push(d => { if (d.to !== 'v_room' || !folkV() || folkRoomOk()) return false; const P = COURT.p; P.y = (d.y1 + 1) * CT + 10; P.dir = 'down'; COURT.path = null;
  const k = COURT.npcs.find(m => m.folk && m.folk.job === 'keeper'); if (k && !k.away && k.loc === COURT.loc) say(k, 'Комнаты — для постояльцев! Снимите сперва.', 3.5); else UI.toast('Наверху комнаты для постояльцев. Сначала договоритесь с хозяином.'); return true; });
// ---------- the way in: buttons in the settlement window ----------
function settEnterBtn(sid, X, Y, WW, near, host) { const s = WD.setts[sid], S = G.setts[sid], pa = playerArmy(); if (pa && (s.type === 'castle' || s.type === 'capital') && typeof kEnterBtn === 'function') { kEnterBtn(sid, X, Y, WW, near, host); return; } if (!pa || (s.type !== 'village' && s.type !== 'town')) return;
  const why = !near ? 'Войско далеко — подойдите ближе.' : S.siege ? 'Идёт осада.' : G.court && !G.atCourt && pa.siegeOf >= 0 ? 'Войско ведёт осаду.' : '', kind = s.type, nm = kind === 'village' ? 'деревню' : 'город';
  const bw = 120, x2 = X + WW - 20 - bw, x1 = x2 - 4 - bw;
  if (!host) sbtn('s_visit', x1, Y + 8, bw, 'Въехать в ' + nm, () => { UI.shut(); visitEnter(kind, sid, 'royal'); }, { style: 'parch', disabled: !!why, tip: why || ['Король со свитой въезжает в ' + nm + '.', 'Народ сбежится поглядеть; староста покажет хозяйство. Время идёт, войско ждёт рядом.'] });
  sbtn('s_incog', x2, Y + 8, bw, 'Пройтись неузнанным', () => { UI.shut(); visitEnter(kind, sid, 'incog'); }, { style: 'parch', disabled: !!why, tip: why || ['В простом плаще, без свиты.', 'Люди скажут правду о короле и поделятся слухами. Могут и узнать…'] }); }
// ---------- register ----------
SITE_KIND.village = SITE_KIND.town = { build: vBuild, arrive: () => 'v_arrive', populate: folkPopulate, update: folkUpdate, enter: folkEnter, leave: folkLeave, title: folkTitle };
