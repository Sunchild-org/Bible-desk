// Builds data/kjv.json (the whole King James Bible, about 4 MB) so Bible Desk can read KJV with no internet.
// Run once on a computer that is online:   node tools/build-kjv.mjs
// Needs Node 18 or newer. No packages to install.
// It downloads each chapter from bible-api.com (the same source the app already uses, so the text is identical),
// slowly, to respect their rate limit. It takes roughly 40 to 60 minutes. You can stop it and run it again:
// finished chapters are kept in tools/.kjv-progress.json and it carries on where it stopped.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS = [['Genesis',50],['Exodus',40],['Leviticus',27],['Numbers',36],['Deuteronomy',34],['Joshua',24],['Judges',21],['Ruth',4],['1 Samuel',31],['2 Samuel',24],['1 Kings',22],['2 Kings',25],['1 Chronicles',29],['2 Chronicles',36],['Ezra',10],['Nehemiah',13],['Esther',10],['Job',42],['Psalms',150],['Proverbs',31],['Ecclesiastes',12],['Song of Solomon',8],['Isaiah',66],['Jeremiah',52],['Lamentations',5],['Ezekiel',48],['Daniel',12],['Hosea',14],['Joel',3],['Amos',9],['Obadiah',1],['Jonah',4],['Micah',7],['Nahum',3],['Habakkuk',3],['Zephaniah',3],['Haggai',2],['Zechariah',14],['Malachi',4],['Matthew',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Romans',16],['1 Corinthians',16],['2 Corinthians',13],['Galatians',6],['Ephesians',6],['Philippians',4],['Colossians',4],['1 Thessalonians',5],['2 Thessalonians',3],['1 Timothy',6],['2 Timothy',4],['Titus',3],['Philemon',1],['Hebrews',13],['James',5],['1 Peter',5],['2 Peter',3],['1 John',5],['2 John',1],['3 John',1],['Jude',1],['Revelation',22]];
const prog = join(root, 'tools', '.kjv-progress.json');
const out = join(root, 'data', 'kjv.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let done = existsSync(prog) ? JSON.parse(readFileSync(prog, 'utf8')) : {};
const total = BOOKS.reduce((a, b) => a + b[1], 0);
let n = Object.keys(done).length;

async function chapter(b, c) {
  const url = 'https://bible-api.com/' + encodeURIComponent(BOOKS[b][0] + ' ' + c) + '?translation=kjv';
  for (let tries = 0; tries < 8; tries++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await sleep(15000 + tries * 10000); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j.verses || !j.verses.length) throw new Error('empty');
      const arr = [];
      for (const v of j.verses) arr[v.verse - 1] = String(v.text).replace(/\s+/g, ' ').trim();
      for (let i = 0; i < arr.length; i++) if (typeof arr[i] !== 'string' || !arr[i]) throw new Error('gap at verse ' + (i + 1));
      return arr;
    } catch (e) { if (tries === 7) throw e; await sleep(4000 * (tries + 1)); }
  }
}

for (let b = 0; b < BOOKS.length; b++) {
  for (let c = 1; c <= BOOKS[b][1]; c++) {
    const k = b + ':' + c;
    if (done[k]) continue;
    done[k] = await chapter(b, c);
    n++;
    writeFileSync(prog, JSON.stringify(done));
    process.stdout.write('\r' + n + ' / ' + total + '  ' + BOOKS[b][0] + ' ' + c + '          ');
    await sleep(2500);
  }
}
const all = BOOKS.map((bk, b) => Array.from({ length: bk[1] }, (_, i) => done[b + ':' + (i + 1)]));
let verses = 0; for (const bk of all) for (const ch of bk) verses += ch.length;
if (verses < 31000 || verses > 31200) throw new Error('Unexpected verse count: ' + verses + ' (expected about 31,100). Not saved.');
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(out, JSON.stringify(all));
console.log('\nSaved data/kjv.json: ' + all.length + ' books, ' + total + ' chapters, ' + verses + ' verses.');
