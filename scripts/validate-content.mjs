#!/usr/bin/env node
/* WORD UP! 教材データ検証。実行: node scripts/validate-content.mjs（Node.js 18 以上、追加パッケージ不要） */
/* ---- 共通部分（各 repo の validate-content.mjs に同じものを埋め込んでいる） ---- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const errors = [];
function err(file, id, msg){ errors.push({ file, id, msg }); }

const utf8 = new TextDecoder('utf-8', { fatal: true });
function readJson(file){
  const full = path.join(DATA, file);
  if(!fs.existsSync(full)){ err(file, '', 'ファイルがありません'); return null; }
  let text;
  try{ text = utf8.decode(fs.readFileSync(full)); }
  catch(e){ err(file, '', 'UTF-8 として読めません: ' + e.message); return null; }
  if(text.charCodeAt(0) === 0xFEFF){ err(file, '', '先頭に BOM があります（BOM なしの UTF-8 にしてください）'); text = text.slice(1); }
  try{ return JSON.parse(text); }
  catch(e){ err(file, '', 'JSON として parse できません: ' + e.message); return null; }
}

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;   // 改行(\n)とCR以外の制御文字
const CR = /\r/;
function checkStr(file, id, key, v, opt = {}){
  if(typeof v !== 'string'){ err(file, id, `${key} は文字列である必要があります（今は ${typeof v}）`); return false; }
  if(!opt.allowEmpty && v.trim() === ''){ err(file, id, `${key} が空です`); return false; }
  if(CTRL.test(v)) err(file, id, `${key} に制御文字が含まれています`);
  if(CR.test(v)) err(file, id, `${key} に CR (\\r) が含まれています`);
  if(v !== v.trim()) err(file, id, `${key} の前後に空白があります`);
  return true;
}
function checkStrArray(file, id, key, v, opt = {}){
  if(!Array.isArray(v)){ err(file, id, `${key} は配列である必要があります`); return false; }
  if(opt.len != null && v.length !== opt.len) err(file, id, `${key} は ${opt.len} 件である必要があります（今は ${v.length}）`);
  if(opt.min != null && v.length < opt.min) err(file, id, `${key} は ${opt.min} 件以上必要です（今は ${v.length}）`);
  v.forEach((x, i) => checkStr(file, id, `${key}[${i}]`, x));
  if(!opt.allowDup && new Set(v).size !== v.length) err(file, id, `${key} に同じ値が重複しています`);
  return true;
}
function checkKeys(file, id, obj, required, optional){
  for(const k of required) if(!(k in obj)) err(file, id, `必須 property "${k}" がありません`);
  const allowed = new Set([...required, ...optional]);
  for(const k of Object.keys(obj)) if(!allowed.has(k)) err(file, id, `未知の property "${k}" があります（許可: ${[...allowed].join(', ')}）`);
}
function checkEnum(file, id, key, v, allowed){
  if(!allowed.includes(v)) err(file, id, `${key} "${v}" は許可されていません（許可: ${allowed.join(', ')}）`);
}
function checkInt(file, id, key, v, min, max){
  if(!Number.isInteger(v)){ err(file, id, `${key} は整数である必要があります（今は ${JSON.stringify(v)}）`); return false; }
  if(v < min || v > max){ err(file, id, `${key} = ${v} は範囲外です（${min}〜${max}）`); return false; }
  return true;
}
function checkIdFormat(file, id, key = 'id'){
  if(typeof id !== 'string' || id === ''){ err(file, String(id), `${key} が空です`); return false; }
  if(!/^[A-Za-z0-9_-]+$/.test(id)){ err(file, id, `${key} に使える文字は英数字・_・- だけです`); return false; }
  return true;
}
/** 4択問題（id, f, lv, q, ch[4], a, ex）の共通チェック */
function checkQuizItem(file, it, i, opt){
  const id = typeof it.id === 'string' ? it.id : `(items[${i}])`;
  if(!it || typeof it !== 'object' || Array.isArray(it)){ err(file, id, 'item はオブジェクトである必要があります'); return; }
  checkKeys(file, id, it, ['id', 'f', 'lv', 'q', 'ch', 'a', 'ex'], []);
  checkIdFormat(file, it.id);
  checkEnum(file, id, 'f', it.f, opt.fields);
  if(opt.expectField && it.f !== opt.expectField) err(file, id, `f "${it.f}" がこのファイルの分野 "${opt.expectField}" と一致しません`);
  if(opt.prefix && typeof it.id === 'string' && opt.prefix[it.f] && !it.id.startsWith(opt.prefix[it.f] + '_'))
    err(file, id, `id は分野 "${it.f}" の接頭辞 "${opt.prefix[it.f]}_" で始める決まりです`);
  checkEnum(file, id, 'lv', it.lv, opt.levels);
  checkStr(file, id, 'q', it.q);
  checkStrArray(file, id, 'ch', it.ch, { len: 4 });
  if(checkInt(file, id, 'a', it.a, 0, 3) && Array.isArray(it.ch) && it.a >= it.ch.length) err(file, id, `a = ${it.a} が選択肢の数を超えています`);
  checkStr(file, id, 'ex', it.ex);
}
function checkDupIds(file, ids, seen, label = 'id'){
  for(const id of ids){
    if(seen.has(id)) err(file, id, `${label} "${id}" が重複しています（先に ${seen.get(id)} にあります）`);
    else seen.set(id, file);
  }
}
/** manifest から参照されていない data/*.json、参照先の欠けを確認 */
function checkDataDir(referenced){
  const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json'));
  for(const f of files) if(!referenced.has(f)) err(f, '', 'data/index.json から参照されていない JSON です（不要なら削除、必要なら manifest に登録）');
  for(const f of referenced) if(!files.includes(f)) err(f, '', 'manifest が参照していますが data/ に存在しません');
  for(const f of fs.readdirSync(DATA)) if(f === '.DS_Store' || f.startsWith('._')) err(f, '', '不要なファイルです（削除してください）');
}
function finish(summary){
  for(const s of summary) console.log('  ' + s);
  if(errors.length){
    console.error(`\n✗ ${errors.length} 件の問題があります:`);
    for(const e of errors) console.error(`  [${e.file}]${e.id ? ' ' + e.id : ''}: ${e.msg}`);
    process.exit(1);
  }
  console.log('\n✓ OK: 問題はありません');
}

/* ---- WORD UP! 固有 ---- */
const TALK_LEVELS = ['e1', 'e2', 'e3'];
const TALK_MODES = ['pick', 'fill', 'build'];
// 質問の型。新しい型を作るときはここに足す（アプリ側は型を表示に使っていないので、足しても動作は変わらない）
const TALK_TYPES = ['do', 'be', 'can', 'what', 'where', 'when', 'who', 'which', 'how', 'howoften', 'howmany', 'howold',
  'why', 'whattime', 'past', 'prog', 'future', 'howlong', 'wouldlike', 'shall', 'must', 'perfect', 'passive', 'opinion',
  'whose', 'compare', 'relative'];
const RESERVED_GROUP = /^my/;   // my1, my2 …はアプリ内のマイ単語帳が使う

const idx = readJson('index.json');
if(!idx){ finish([]); }
checkKeys('index.json', '', idx, ['version', 'contentVersion', 'levels', 'total'], []);
checkStr('index.json', '', 'contentVersion', idx.contentVersion);   // 教材版 ID（batch 取込で batch_id に更新。空にしない）
if(idx.version !== 3) err('index.json', '', `version は 3 である必要があります（今は ${idx.version}）`);
if(!Array.isArray(idx.levels)) { err('index.json', '', 'levels は配列である必要があります'); finish([]); }

const referenced = new Set(['index.json', 'talk.json']);
const seenLevel = new Map(), seenGroup = new Map(), seenWordId = new Map();
let wordSum = 0;
const summary = [];
for(const lv of idx.levels){
  const lid = lv && lv.id;
  checkKeys('index.json', lid, lv, ['id', 'name', 'file', 'count', 'groups'], []);
  checkIdFormat('index.json', lv.id);
  if(lv.id === 'all' || lv.id === 'my') err('index.json', lid, `level id "${lv.id}" はアプリが予約しています`);
  checkStr('index.json', lid, 'name', lv.name);
  if(seenLevel.has(lv.id)) err('index.json', lid, 'levels の id が重複しています'); seenLevel.set(lv.id, true);
  if(typeof lv.file !== 'string' || !/^[a-z0-9_-]+\.json$/.test(lv.file)){ err('index.json', lid, 'file 名が不正です'); continue; }
  referenced.add(lv.file);
  const doc = readJson(lv.file);
  if(!doc) continue;
  checkKeys(lv.file, '', doc, ['id', 'name', 'groups'], []);
  if(doc.id !== lv.id) err(lv.file, '', `ファイル内の id "${doc.id}" が manifest の id "${lv.id}" と一致しません`);
  if(doc.name !== lv.name) err(lv.file, '', `ファイル内の name "${doc.name}" が manifest の name "${lv.name}" と一致しません`);
  if(!Array.isArray(doc.groups)){ err(lv.file, '', 'groups は配列である必要があります'); continue; }
  let n = 0;
  doc.groups.forEach((g, gi) => {
    const gid = typeof g.id === 'string' ? g.id : `(groups[${gi}])`;
    checkKeys(lv.file, gid, g, ['id', 'name', 'w'], []);
    if(checkIdFormat(lv.file, g.id) && RESERVED_GROUP.test(g.id)) err(lv.file, gid, 'group id を "my" で始めることはできません（マイ単語帳と衝突します）');
    checkStr(lv.file, gid, 'name', g.name);
    if(seenGroup.has(g.id)) err(lv.file, gid, `group id "${g.id}" が ${seenGroup.get(g.id)} と重複しています（全レベルで一意にしてください）`); else seenGroup.set(g.id, lv.file);
    if(!Array.isArray(g.w)){ err(lv.file, gid, 'w（単語の配列）がありません'); return; }
    if(!g.w.length) err(lv.file, gid, 'w が空です');
    g.w.forEach((p, i) => {
      if(!Array.isArray(p) || p.length !== 2){ err(lv.file, gid, `w[${i}] は [英語, 日本語] の2要素配列である必要があります`); return; }
      checkStr(lv.file, gid, `w[${i}] 英語`, p[0]);
      checkStr(lv.file, gid, `w[${i}] 日本語`, p[1]);
      if(typeof p[0] !== 'string') return;
      const wid = g.id + '|' + p[0].toLowerCase();   // アプリが学習記録のキーにしている word ID
      if(seenWordId.has(wid)) err(lv.file, gid, `単語 "${p[0]}" が同じグループ内で重複しています（word ID "${wid}" が衝突）`); else seenWordId.set(wid, true);
    });
    n += g.w.length;
  });
  if(lv.count !== n) err('index.json', lid, `count = ${lv.count} が実際の単語数 ${n} と一致しません`);
  if(lv.groups !== doc.groups.length) err('index.json', lid, `groups = ${lv.groups} が実際のグループ数 ${doc.groups.length} と一致しません`);
  wordSum += n;
  summary.push(`${lv.file}: ${n} 語 / ${doc.groups.length} グループ`);
}
if(idx.total !== wordSum) err('index.json', '', `total = ${idx.total} が合計 ${wordSum} と一致しません`);
summary.push(`単語 合計 ${wordSum} 語（total = ${idx.total}）`);

/* 質問に答える（talk.json） */
const talk = readJson('talk.json');
if(talk){
  checkKeys('talk.json', '', talk, ['id', 'name', 'items'], []);
  if(talk.id !== 'talk') err('talk.json', '', 'id は "talk" です');
  checkStr('talk.json', '', 'name', talk.name);
  if(!Array.isArray(talk.items)) err('talk.json', '', 'items は配列である必要があります');
  else{
    const seen = new Map();
    const byMode = {};
    talk.items.forEach((it, i) => {
      const id = typeof it.id === 'string' ? it.id : `(items[${i}])`;
      const common = ['id', 'lv', 't', 'mode', 'q', 'ex'];
      checkEnum('talk.json', id, 'mode', it.mode, TALK_MODES);
      if(it.mode === 'pick') checkKeys('talk.json', id, it, [...common, 'ch', 'a'], []);
      else if(it.mode === 'fill') checkKeys('talk.json', id, it, [...common, 's', 'ans'], []);
      else if(it.mode === 'build') checkKeys('talk.json', id, it, [...common, 'bank', 'ans'], []);
      checkIdFormat('talk.json', it.id);
      if(typeof it.id === 'string'){
        const okId = it.mode === 'pick' ? /^p\d+$/ : it.mode === 'build' ? /^b\d+$/ : /^(f\d+|b\d+f\d*)$/;
        if(!okId.test(it.id)) err('talk.json', id, `id の形が mode "${it.mode}" の決まりに合いません（pick: p01 / fill: f01, b11f, b11f2 / build: b01）`);
      }
      checkEnum('talk.json', id, 'lv', it.lv, TALK_LEVELS);
      checkEnum('talk.json', id, 't', it.t, TALK_TYPES);
      checkStr('talk.json', id, 'q', it.q);
      checkStr('talk.json', id, 'ex', it.ex);
      if(it.mode === 'pick'){
        checkStrArray('talk.json', id, 'ch', it.ch, { len: 4 });
        checkInt('talk.json', id, 'a', it.a, 0, 3);
      }else if(it.mode === 'fill'){
        if(checkStr('talk.json', id, 's', it.s)){
          const blanks = (it.s.match(/___/g) || []).length;
          if(blanks !== 1) err('talk.json', id, `s には空欄 "___" をちょうど1つ入れてください（今は ${blanks}）`);
        }
        checkStrArray('talk.json', id, 'ans', it.ans, { min: 1 });
      }else if(it.mode === 'build'){
        checkStrArray('talk.json', id, 'bank', it.bank, { min: 2, allowDup: true });   // 同じ語を2回使う文があるので重複は許可
        if(!Array.isArray(it.ans) || !it.ans.length) err('talk.json', id, 'ans は正解の語順（配列）を1つ以上入れた配列です');
        else it.ans.forEach((seq, k) => {
          if(!Array.isArray(seq) || !seq.length){ err('talk.json', id, `ans[${k}] は語の配列である必要があります`); return; }
          seq.forEach((w, j) => checkStr('talk.json', id, `ans[${k}][${j}]`, w));
          if(Array.isArray(it.bank)){
            const pool = it.bank.slice();
            for(const w of seq){ const p = pool.indexOf(w); if(p < 0){ err('talk.json', id, `ans[${k}] の語 "${w}" が bank にありません（または回数が足りません）`); break; } pool.splice(p, 1); }
          }
        });
      }
      if(seen.has(it.id)) err('talk.json', id, `id "${it.id}" が重複しています`); else seen.set(it.id, true);
      byMode[it.mode] = (byMode[it.mode] || 0) + 1;
    });
    summary.push(`talk.json: ${talk.items.length} 問 (${TALK_MODES.map(m => `${m} ${byMode[m] || 0}`).join(' / ')})`);
  }
}
checkDataDir(referenced);
finish(summary);
