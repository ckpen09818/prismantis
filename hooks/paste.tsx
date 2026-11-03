import type { ElementTable, ImageProps, RenderElement } from 'claude-code'

import type { Style } from './theme'

export const IMAGE_TAG = /\[Image #\d+\]/g

export const DROP_DIR = '/tmp'

export const DROP_WINDOW_MS = 60000

export const MAX_USED_DROPS = 200

const DROP_NAME = /^cmux-drop-[0-9a-f-]+\.png$/i

const VIEWABLE = /^\/[A-Za-z0-9._\/-]+\.(png|b64)$/

export type DropEntry = { name: string; kind: string; size: number; mtimeMs: number }

export type Pasted = { tag: string; path?: string; png?: string; width: number; height: number }

export type Picked = { general: number; drag: number; source: '' | 'drag' | 'clipboard'; png: string }

export type PasteActions = { zoom: (item: Pasted) => void; remove: (item: Pasted) => void }

type ImageElement = (props: ImageProps) => RenderElement

export const tagsOf = (text: string): string[] => (text.includes('[Image #') ? [...new Set(Array.from(text.matchAll(IMAGE_TAG), m => m[0]))] : [])

export const sameTags = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((t, i) => t === b[i])

export const freshDrops = (entries: readonly DropEntry[], used: ReadonlySet<string>, now: number): DropEntry[] =>
  entries.filter(f => f.kind === 'file' && DROP_NAME.test(f.name) && !used.has(f.name) && now - f.mtimeMs <= DROP_WINDOW_MS).sort((a, b) => a.mtimeMs - b.mtimeMs)

export const pairDrops = (tags: readonly string[], drops: readonly DropEntry[]): [string, DropEntry][] => {
  const n = Math.min(tags.length, drops.length)
  return Array.from({ length: n }, (_, i) => [tags[tags.length - n + i]!, drops[drops.length - n + i]!])
}

export const withoutTag = (text: string, tag: string): string => text.split(tag).join('').replace(/[ \t]{2,}/g, ' ')

export const fitBox = (size: { width: number; height: number }, columns: number, rows: number): { columns: number; rows: number } => {
  const aspect = size.width / size.height / 0.5
  const wide = Math.max(1, Math.min(255, columns))
  const tall = Math.max(1, Math.min(255, rows, Math.round(wide / aspect)))
  return { columns: Math.max(1, Math.min(wide, Math.round(tall * aspect))), rows: tall }
}

const quoted = (s: string): string | null => (s.includes("'") ? null : `'${s}'`)

export const viewerLine = (script: string, path: string): string | null => {
  const s = quoted(script)
  return s && VIEWABLE.test(path) && !path.includes('..') ? `clear; python3 -I ${s} '${path}'; exit` : null
}

export const pickedOf = (stdout: string | undefined): Picked | null => {
  try {
    const p = JSON.parse(stdout ?? '') as Partial<Picked>
    const source = p.source === 'drag' || p.source === 'clipboard' ? p.source : ''
    return typeof p.general === 'number' && typeof p.drag === 'number' ? { general: p.general, drag: p.drag, source, png: typeof p.png === 'string' ? p.png : '' } : null
  } catch {
    return null
  }
}

export const PICK_SCRIPT = `function run(argv) {
  ObjC.import('AppKit')
  const general = $.NSPasteboard.generalPasteboard
  const drag = $.NSPasteboard.pasteboardWithName($.NSPasteboardNameDrag)
  const out = { general: Number(general.changeCount), drag: Number(drag.changeCount), source: '', png: '' }
  if (argv[2] === 'counts') return JSON.stringify(out)
  let data = null
  if (out.drag !== Number(argv[1])) {
    const urls = drag.readObjectsForClassesOptions($.NSArray.arrayWithObject($.NSURL), $())
    if (!urls.isNil() && urls.count > 0) {
      const url = urls.objectAtIndex(0)
      const ext = ObjC.unwrap(url.pathExtension).toLowerCase()
      if (url.isFileURL && /^(png|jpe?g|gif|webp|heic|tiff?|bmp)$/.test(ext)) {
        data = $.NSData.dataWithContentsOfURL(url)
        out.source = 'drag'
      }
    }
  }
  if (!data && out.general !== Number(argv[0])) {
    const png = general.dataForType($.NSPasteboardTypePNG)
    const any = png.isNil() ? general.dataForType($.NSPasteboardTypeTIFF) : png
    if (!any.isNil()) {
      data = any
      out.source = 'clipboard'
    }
  }
  if (!data || data.isNil()) return JSON.stringify(out)
  let rep = $.NSBitmapImageRep.imageRepWithData(data)
  if (rep.isNil()) {
    const img = $.NSImage.alloc.initWithData(data)
    if (img.isNil()) return JSON.stringify(out)
    rep = $.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation)
  }
  const scaled = (side) => {
    const w = Number(rep.pixelsWide)
    const h = Number(rep.pixelsHigh)
    const k = Math.min(1, side / Math.max(w, h))
    if (k >= 1) return rep
    const nw = Math.max(1, Math.round(w * k))
    const nh = Math.max(1, Math.round(h * k))
    const dst = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, nw, nh, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0)
    $.NSGraphicsContext.saveGraphicsState
    $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(dst))
    rep.drawInRect($.NSMakeRect(0, 0, nw, nh))
    $.NSGraphicsContext.restoreGraphicsState
    return dst
  }
  for (const side of [1600, 1200, 900, 640]) {
    const encoded = scaled(side).representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $())
    if (Number(encoded.length) <= 2000000) {
      out.png = ObjC.unwrap(encoded.base64EncodedStringWithOptions(0))
      break
    }
  }
  return JSON.stringify(out)
}
`

export const surfaceOf = (stdout: string | undefined): string | null => {
  try {
    const id = (JSON.parse(stdout ?? '') as { surface_id?: unknown }).surface_id
    return typeof id === 'string' && /^[0-9A-F-]{36}$/i.test(id) ? id : null
  } catch {
    return null
  }
}

export const renderPasteBand = ({ Box, Text, Button }: ElementTable, Image: ImageElement, style: Style, items: readonly Pasted[], actions: PasteActions): RenderElement => {
  const dim = style.theme.rule
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      {items.map(item => {
        const fit = item.png ? fitBox(item, 20, 6) : null
        return (
          <Box key={item.tag} flexDirection="row" columnGap={1}>
            {item.png && fit ? <Image key={`paste-${item.tag}`} source={{ png: item.png }} columns={fit.columns} rows={fit.rows} alt={item.tag} /> : null}
            <Box flexDirection="column">
              <Text color={dim}>{item.tag}</Text>
              <Text color={dim}>{item.png ? `${item.width}×${item.height}` : '太大，無法預覽'}</Text>
              {item.png ? <Button key={`zoom-${item.tag}`} label="⤢ 放大" onPress={() => actions.zoom(item)} /> : null}
              <Button key={`remove-${item.tag}`} label="✕ 移除" onPress={() => actions.remove(item)} />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

export const renderZoom = ({ Box, Text }: ElementTable, Image: ImageElement, item: Pasted | undefined, columns: number, rows: number): RenderElement => {
  if (!item?.png) return <Text dimColor>這張圖已經移除了</Text>
  const fit = fitBox(item, Math.max(10, columns), Math.max(4, rows))
  return (
    <Box flexDirection="column" alignItems="center">
      <Image key="zoom" source={{ png: item.png }} columns={fit.columns} rows={fit.rows} alt={item.tag} />
    </Box>
  )
}
