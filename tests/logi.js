// logistics stand: march an army N days in chosen conditions and record supplies & losses
window.LOGI = function (o) { o = Object.assign({ days: 30, season: 1, weather: 'clear', grass: true, units: null, food: null, fodder: null, wagons: null, move: false, seed: 1 }, o);
  const save = JSON.stringify({ G_day: G.day, wk: G.weather.k });
  // find a dry tile far from water and towns
  let t = -1; for (let i = 0; i < MW * MH && t < 0; i += 7) { const ter = WD.ter[i]; if (TINFO[ter].water) continue; const gr = [TR.GRASS, TR.STEPPE, TR.FARM].includes(ter); if (gr !== o.grass) continue; if (nearWater(i)) continue; const x = i % MW, y = (i / MW) | 0; if (settNear(x + 0.5, y + 0.5, 4) >= 0) continue; t = i; }
  if (t < 0) return 'no tile';
  const a = mkArmy(0, 'lord', -1, (t % MW) + 0.5, ((t / MW) | 0) + 0.5, o.units || { levy: 100, spear: 120, sword: 40, archer: 80, xbow: 30, horse: 30, knight: 10 }); Object.assign(a, { food: 1900, fodder: 200, arrows: 1500, weap: 40, horses: 4, wagons: 4 }); a.x = (t % MW) + 0.5; a.y = ((t / MW) | 0) + 0.5; a.sick = 0; a.wounded = 0; a.hunger = 0; a.thirst = 0; a.fat = 0; a.morale = 70; a.kind = 'player';
  if (o.food !== null) a.food = o.food; if (o.fodder !== null) a.fodder = o.fodder; if (o.wagons !== null) a.wagons = o.wagons; a.water = waterCap(a); a.mode = 'march';
  if (!G.armies.includes(a)) G.armies.push(a); const rows = []; const men0 = armyMen(a); G.day = o.season * DAYS_SEASON + 2; const logs = []; const oldLog = window.log; window.__logs = logs;
  for (let d = 0; d < o.days; d++) { G.weather.k = typeof o.weather === 'function' ? o.weather(d) : o.weather; a.moved = o.move ? 1 : 0; a.x = (t % MW) + 0.5; a.y = ((t / MW) | 0) + 0.5;
    try { dailyArmy(a); } catch (e) { rows.push('ERR ' + e); break; } G.day++;
    if (!a.alive) { rows.push('d' + d + ' army gone'); break; }
    if (d % (o.step || 3) === 0 || d === o.days - 1) rows.push('d' + (d + 1) + ' men ' + armyMen(a) + ' food ' + Math.round(a.food) + ' fod ' + Math.round(a.fodder) + ' wat ' + a.water.toFixed(1) + ' th ' + a.thirst + ' hu ' + a.hunger + ' mor ' + Math.round(a.morale) + ' sick ' + Math.round(a.sick) + ' cav ' + [a.u.horse, a.u.harch, a.u.knight].join('/') + ' wag ' + a.wagons); }
  G.armies = G.armies.filter(x => x !== a); const s = JSON.parse(save); G.day = s.G_day; G.weather.k = s.wk;
  return 'men0 ' + men0 + ' tile ' + t + ' ter ' + WD.ter[t] + '\n' + rows.join('\n'); };
'logi ok';
