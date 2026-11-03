import type { On, PromptChangeInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { startSession } from './clipboard-env'
import { fitBox, freshDrops, pairDrops, pickedOf, sameTags, surfaceOf, tagsOf, viewerLine, withoutTag } from '../hooks/paste'

const PNG_160x80 = 'iVBORw0KGgoAAAANSUhEUgAAAKAAAABQAQAAAAC2JkOZAAAAFklEQVR42mNgGAWjYBSMglEwCgYeAAAGkAAB8Q2GVgAAAABJRU5ErkJggg=='
const DROP = 'cmux-drop-69eb09c8-4964-4660-a0d2-6814cb5d1acf.png'
const DROP2 = 'cmux-drop-798ce38c-49b6-4ca3-8c34-71c3705c8b68.png'

type Raises = { prompt: { change: (e: PromptChangeInput) => Promise<unknown> } }

const change = ($: unknown, e: PromptChangeInput) => ($ as Raises).prompt.change(e)

const composer = (on: On, start: string) => {
  const box = { text: start }
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('prompt.change', (_, e) => ({ text: e.text }))
  on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
  on('prompt.fill', (_, e) => {
    box.text = e.text
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  return box
}

const band = { plugin: 'prismantis', component: 'AbovePrompt' as const, props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120, scroll: { offset: 0, bodyRows: 12 }, view: {} }, viewport: { columns: 120, rows: 40 }, surface: 'terminal' as const }

test('a dropped cmux image shows above the prompt before sending, and remove takes its tag out', async ($, on) => {
  const now = 1_000_000
  on('clock.now', () => ({ value: now }))
  on('fs.list', () => ({ value: [{ name: DROP, kind: 'file', size: 120, mtimeMs: now - 500, isLink: false }, { name: 'other.png', kind: 'file', size: 9, mtimeMs: now, isLink: false }] }))
  on('fs.read', (_, e) => (e.path === `/tmp/${DROP}` ? { value: { base64: PNG_160x80 } } : { deny: 'no such file' }))
  const box = composer(on, 'look [Image #1] here')
  await change($, { text: box.text, cursor: box.text.length, origin: { kind: 'engine' } })

  const ui = await $.ui.mount(band)
  const image = await ui.find({ type: 'Image' })
  expect(image?.props.source).toEqual({ png: PNG_160x80 })
  expect(image?.props.alt).toBe('[Image #1]')
  expect(await ui.find({ text: /^160×80$/ })).toBeTruthy()

  await ui.press({ key: 'remove-[Image #1]' })
  expect(box.text).toBe('look here')
  await change($, { text: box.text, cursor: box.text.length, origin: { kind: 'plugin', name: 'prismantis' } })
  expect(await ui.find({ type: 'Image' })).toBeFalsy()
  await ui.unmount()
})

test('a pasted tag with no fresh drop file draws nothing of its own', async ($, on) => {
  on('fs.list', () => ({ value: [] }))
  composer(on, '[Image #3]')
  await change($, { text: '[Image #3]', cursor: 10, origin: { kind: 'engine' } })
  const ui = await $.ui.mount(band)
  expect(await ui.find({ type: 'Image' })).toBeFalsy()
  expect(await ui.find({ text: /^engine$/ })).toBeTruthy()
  await ui.unmount()
})

const board = (on: On, picks: string[]) => {
  const calls: string[][] = []
  on('session.surfaces', () => ({ value: ['terminal'] as const }))
  on('fs.stat', (_, e) => (e.path === '/usr/bin/osascript' ? { value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } } : { deny: 'no such file' }))
  on('process.run', (_, e) => {
    calls.push([...e.argv])
    const counts = e.argv.at(-1) === 'counts'
    return { value: { exitCode: 0, stdout: counts ? '{"general":5,"drag":3,"source":"","png":""}' : (picks.shift() ?? '{"general":5,"drag":3,"source":"","png":""}'), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return calls
}

test('on a local Mac a clipboard image pasted into the prompt shows before sending', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('fs.list', () => ({ value: [] }))
  const calls = board(on, [`{"general":6,"drag":3,"source":"clipboard","png":"${PNG_160x80}"}`])
  const box = composer(on, '[Image #1] what is this')
  await startSession($, on)
  await change($, { text: box.text, cursor: 0, origin: { kind: 'engine' } })
  const ui = await $.ui.mount(band)
  const image = await ui.find({ type: 'Image' })
  expect(image?.props.source).toEqual({ png: PNG_160x80 })
  const picks = calls.filter(c => c[0] === '/usr/bin/osascript' && c.at(-1) !== 'counts')
  expect(picks).toHaveLength(1)
  expect(picks[0]!.slice(-3)).toEqual(['none', '3', 'pick'])
  await ui.unmount()
})

test('over ssh the Mac pasteboard is never read', async ($, on) => {
  mock.env(on, { HOME: '/Users/me', SSH_CONNECTION: '1.2.3.4 5 6.7.8.9 22' })
  on('fs.list', () => ({ value: [] }))
  const calls = board(on, [`{"general":6,"drag":3,"source":"clipboard","png":"${PNG_160x80}"}`])
  const box = composer(on, '[Image #1]')
  await startSession($, on)
  await change($, { text: box.text, cursor: 0, origin: { kind: 'engine' } })
  const ui = await $.ui.mount(band)
  expect(await ui.find({ type: 'Image' })).toBeFalsy()
  expect(calls.filter(c => c[0] === '/usr/bin/osascript')).toHaveLength(0)
  await ui.unmount()
})

test('paste helpers', () => {
  expect(tagsOf('a [Image #1] b [Image #12] [Image #1]')).toEqual(['[Image #1]', '[Image #12]'])
  expect(tagsOf('no images')).toEqual([])
  expect(sameTags(['a'], ['a'])).toBe(true)
  expect(withoutTag('look [Image #1] here', '[Image #1]')).toBe('look here')
  const entries = [
    { name: DROP2, kind: 'file', size: 1, mtimeMs: 99900 },
    { name: DROP, kind: 'file', size: 1, mtimeMs: 99800 },
    { name: 'cmux-drop-aaaa.png', kind: 'file', size: 1, mtimeMs: 1 },
    { name: 'shot.png', kind: 'file', size: 1, mtimeMs: 99950 },
  ]
  const fresh = freshDrops(entries, new Set([DROP2]), 100000)
  expect(fresh.map(f => f.name)).toEqual([DROP])
  expect(pairDrops(['[Image #1]', '[Image #2]'], freshDrops(entries, new Set(), 100000)).map(([t, d]) => [t, d.name])).toEqual([['[Image #1]', DROP], ['[Image #2]', DROP2]])
  expect(pairDrops(['[Image #1]', '[Image #2]'], fresh).map(([t]) => t)).toEqual(['[Image #2]'])
  expect(viewerLine('/p/bin/imgview.py', `/tmp/${DROP}`)).toBe(`clear; python3 -I '/p/bin/imgview.py' '/tmp/${DROP}'; exit`)
  expect(viewerLine('/p/bin/imgview.py', '/var/folders/T/prismantis-zoom.b64')).toBe("clear; python3 -I '/p/bin/imgview.py' '/var/folders/T/prismantis-zoom.b64'; exit")
  expect(viewerLine('/p/bin/imgview.py', '/tmp/x; rm -rf ~.png')).toBe(null)
  expect(viewerLine('/p/bin/imgview.py', "/tmp/a'b.png")).toBe(null)
  expect(viewerLine('/p/bin/imgview.py', '/tmp/../etc/x.png')).toBe(null)
  expect(pickedOf('{"general":2,"drag":1,"source":"clipboard","png":"x"}')).toEqual({ general: 2, drag: 1, source: 'clipboard', png: 'x' })
  expect(pickedOf('{"general":2,"drag":1,"source":"evil"}')).toEqual({ general: 2, drag: 1, source: '', png: '' })
  expect(pickedOf('garbage')).toBe(null)
  expect(viewerLine("/it's/imgview.py", `/tmp/${DROP}`)).toBe(null)
  expect(surfaceOf('{"surface_id":"74C3E740-4161-4043-A667-D7BA13AF725F"}')).toBe('74C3E740-4161-4043-A667-D7BA13AF725F')
  expect(surfaceOf('nope')).toBe(null)
  const box = fitBox({ width: 1431, height: 876 }, 20, 6)
  expect(box.columns <= 20 && box.rows <= 6).toBe(true)
  expect(fitBox({ width: 100, height: 100 }, 100, 10)).toEqual({ columns: 20, rows: 10 })
})
