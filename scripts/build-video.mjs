import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const W = join(__dirname, '../walkthrough');
const OUT = join(__dirname, '../walkthrough/autopulse-demo.mp4');

// Scenes: [file, title, subtitle, duration_seconds]
const SCENES = [
  ['01-landing.png',    'AutoPulse',            'Workshop Management System',  4.5],
  ['02-login.png',      'Secure Access',         'Multi-tenant authentication', 3.5],
  ['04-dashboard.png',  'Dashboard',             'Real-time workshop overview',  4.5],
  ['06-jobs-kanban.png','Job Board',             'Kanban workflow management',   4.5],
  ['07-job-card-open.png','Job Details',         'Parts, labor & AI diagnostics',4.5],
  ['08-customers.png',  'Customers',             'Client & vehicle records',     4.0],
  ['09-inventory.png',  'Inventory',             'Parts stock & pricing',        4.0],
  ['10-invoices.png',   'Invoicing',             'Auto-generated on completion', 4.0],
  ['12-settings.png',   'Settings',              'Per-tenant configuration',     4.0],
];

const XFADE_DUR = 0.6;
const W_PX = 2560;
const H_PX = 1600;
// Cinematic 2.39:1 letterbox
const CROP_H = Math.round(W_PX / 2.39);          // 1071
const BAR_H  = Math.floor((H_PX - CROP_H) / 2);  // 264
const CROP_Y = BAR_H;                             // crop from this Y

// Font paths — use a bold system font
const TITLE_FONT  = '/System/Library/Fonts/Supplemental/Impact.ttf';
const BODY_FONT   = '/System/Library/Fonts/Helvetica.ttc';

// Build inputs: one per scene (looped still image)
const inputs = SCENES.map(([file]) =>
  `-loop 1 -t ${SCENES[SCENES.indexOf(SCENES.find(s => s[0] === file))][3] + XFADE_DUR} -i "${join(W, file)}"`
).join(' ');

// Build filtergraph
let fg = [];
let lastLabel = null;

SCENES.forEach(([file, title, subtitle, dur], i) => {
  const srcLabel = `[${i}:v]`;
  const scaledLabel = `sc${i}`;
  const cropLabel   = `cr${i}`;
  const gradeLabel  = `gr${i}`;
  const textLabel   = `tx${i}`;

  // 1. Scale to exact W×H (already 2560×1600, but normalise)
  fg.push(`${srcLabel}scale=${W_PX}:${H_PX}:force_original_aspect_ratio=decrease,pad=${W_PX}:${H_PX}:(ow-iw)/2:(oh-ih)/2[${scaledLabel}]`);

  // 2. Letterbox crop
  fg.push(`[${scaledLabel}]crop=${W_PX}:${CROP_H}:0:${CROP_Y}[${cropLabel}]`);

  // 3. Color grade: cinematic — slight warmth kill, contrast boost, vignette
  fg.push(
    `[${cropLabel}]`+
    `eq=contrast=1.12:brightness=-0.03:saturation=1.15,`+
    `colorchannelmixer=rr=0.95:gg=1.0:bb=1.08`+   // cool / desaturate red slightly → cinematic teal
    `[${gradeLabel}]`
  );

  // 4. Text overlays
  // Top letterbox bar — section label (small caps feel)
  const safeTitle    = title.replace(/'/g, "\\'");
  const safeSubtitle = subtitle.replace(/'/g, "\\'");

  // Title fades in at 0.4s, stays, fades out at dur-0.5
  const fadeIn  = 0.4;
  const fadeOut = dur - 0.5;
  const titleAlpha  = `if(lt(t,${fadeIn}),0,if(lt(t,${fadeIn+0.4}),(t-${fadeIn})/0.4,if(lt(t,${fadeOut}),1,if(lt(t,${fadeOut+0.4}),1-(t-${fadeOut})/0.4,0))))`;
  const subtitleAlpha = `if(lt(t,${fadeIn+0.2}),0,if(lt(t,${fadeIn+0.6}),(t-${fadeIn+0.2})/0.4,if(lt(t,${fadeOut}),1,if(lt(t,${fadeOut+0.4}),1-(t-${fadeOut})/0.4,0))))`;

  // Position title in lower third (relative to CROP_H)
  const titleY    = Math.round(CROP_H * 0.78);
  const subtitleY = titleY + 72;

  fg.push(
    `[${gradeLabel}]`+
    // cyan accent bar
    `drawbox=x=80:y=${titleY - 12}:w=6:h=56:color=0x06b6d4@1.0:t=fill:enable='between(t,${fadeIn},${dur})',`+
    // main title
    `drawtext=fontfile='${TITLE_FONT}':text='${safeTitle}':fontcolor=white@1.0:fontsize=64:x=100:y=${titleY}:alpha='${titleAlpha}',`+
    // subtitle
    `drawtext=fontfile='${BODY_FONT}':text='${safeSubtitle}':fontcolor=0xc0c0c0@0.9:fontsize=30:x=100:y=${subtitleY}:alpha='${subtitleAlpha}'`+
    `[${textLabel}]`
  );

  // 5. Pad back to 16:9 (add black bars) — output 2560×1600 with black top/bottom
  const paddedLabel = `pd${i}`;
  fg.push(`[${textLabel}]pad=${W_PX}:${H_PX}:0:${BAR_H}:black[${paddedLabel}]`);

  // 6. Chain xfade
  if (i === 0) {
    lastLabel = `pd${i}`;
  } else {
    const xLabel = `xf${i}`;
    // offset = sum of previous durations minus overlaps so far
    const offset = SCENES.slice(0, i).reduce((acc, s) => acc + s[3], 0) - (i) * XFADE_DUR;
    fg.push(`[${lastLabel}][pd${i}]xfade=transition=fade:duration=${XFADE_DUR}:offset=${offset.toFixed(3)}[${xLabel}]`);
    lastLabel = xLabel;
  }
});

const filterStr = fg.join(';');

const cmd = [
  'ffmpeg -y',
  inputs,
  `-filter_complex "${filterStr}"`,
  `-map "[${lastLabel}]"`,
  `-c:v libx264 -preset slow -crf 16`,
  `-pix_fmt yuv420p`,
  `-movflags +faststart`,
  `"${OUT}"`,
].join(' ');

console.log('Building cinematic video...');
execSync(cmd, { stdio: 'inherit' });
console.log('\nDone:', OUT);
