import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const ffmpeg = new FFmpeg();
let loaded = false;
let selectedFile = null;

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const crf = document.getElementById('crf');
const crfValue = document.getElementById('crfValue');
const preset = document.getElementById('preset');
const audioBitrate = document.getElementById('audioBitrate');
const extraArgs = document.getElementById('extraArgs');
const compressBtn = document.getElementById('compressBtn');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const result = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');
const status = document.getElementById('status');

crf.addEventListener('input', () => {
  crfValue.textContent = crf.value;
});

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  selectedFile = f;
  fileName.textContent = f.name;
  fileSize.textContent = (f.size / 1024 / 1024).toFixed(1) + ' MB';
  compressBtn.disabled = !(loaded && selectedFile);
});

compressBtn.addEventListener('click', compress);

init();

async function init() {
  status.textContent = 'loading ffmpeg...';
  try {
    const coreBase = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: `${coreBase}/ffmpeg-core.js`,
      wasmURL: `${coreBase}/ffmpeg-core.wasm`,
      classWorkerURL: new URL('./lib/worker.js', location.href).toString(),
    });
    loaded = true;
    status.textContent = '';
    if (selectedFile) compressBtn.disabled = false;
  } catch (err) {
    status.textContent = 'failed to load ffmpeg: ' + err.message;
  }
}

ffmpeg.on('progress', ({ progress }) => {
  const pct = Math.round(progress * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = pct + '%';
});

ffmpeg.on('log', ({ message }) => {
  console.log(message);
});

async function compress() {
  if (!selectedFile || !loaded) return;

  compressBtn.disabled = true;
  compressBtn.textContent = 'compressing...';
  progressWrap.classList.remove('hidden');
  result.classList.add('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  status.textContent = '';

  const ext = selectedFile.name.match(/\.[^.]+$/)?.[0] || '.mp4';
  const base = selectedFile.name.replace(/\.[^.]+$/, '');
  const outName = base + '_compressed' + ext;
  const inName = 'input' + ext;

  try {
    await ffmpeg.writeFile(inName, await fetchFile(selectedFile));
  } catch (err) {
    status.textContent = 'write error: ' + String(err);
    return;
  }

  const args = [
    '-i', inName,
    '-c:v', 'libx264',
    '-preset', preset.value,
    '-crf', crf.value,
    '-c:a', 'aac',
    '-b:a', audioBitrate.value + 'k',
  ];

  const extra = extraArgs.value.trim();
  if (extra) {
    const parsed = parseExtraArgs(extra);
    args.push(...parsed);
  }

  args.push('-y', outName);

  try {
    await ffmpeg.exec(args);
  } catch (err) {
    console.warn('exec threw (may be normal exit):', err);
  }

  try {
    const data = await ffmpeg.readFile(outName);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = outName;
    result.classList.remove('hidden');
  } catch (err) {
    status.textContent = 'error: ' + String(err);
  }

  compressBtn.disabled = false;
  compressBtn.textContent = 'compress';
  progressWrap.classList.add('hidden');
}

function parseExtraArgs(str) {
  const result = [];
  const re = /"[^"]*"|'[^']*'|\S+/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    let token = m[0];
    if ((token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))) {
      token = token.slice(1, -1);
    }
    result.push(token);
  }
  return result;
}
