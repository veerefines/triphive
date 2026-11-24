// Builds the 60s voiceover track from per-scene clips, then sidechain-ducks the music under it.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const [voDir, comp] = process.argv.slice(2)
const lines = readFileSync(`${voDir}/lines.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t'))
const inputs = lines.flatMap(([id]) => ['-i', `${voDir}/vo${id}.wav`])
const delays = lines.map(([, st], i) => { const ms = Math.round(Number(st) * 1000); return `[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]` }).join(';')
const labels = lines.map((_, i) => `[a${i}]`).join('')
const graph = `${delays};${labels}amix=inputs=${lines.length}:normalize=0,apad=whole_dur=60,atrim=0:60,loudnorm=I=-16:TP=-1.5:LRA=11,aformat=channel_layouts=stereo[v]`
const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
run([...inputs, '-filter_complex', graph, '-map', '[v]', '-ar', '48000', `${comp}/assets/voiceover.wav`])
run(['-i', `${comp}/assets/music/music.mp3`, '-i', `${comp}/assets/voiceover.wav`, '-filter_complex',
  '[0:a]aresample=48000[m];[m][1:a]sidechaincompress=threshold=0.02:ratio=8:attack=60:release=450[d]',
  '-map', '[d]', '-b:a', '256k', `${comp}/assets/music/music-ducked.mp3`])
