/**
 * Minimal, dependency-free decoder for Garmin FIT activity files (the original file the Personal API lets you
 * download). Reads only what Athlytic shows: per-second `record` messages and `lap` messages.
 * Spec: https://developer.garmin.com/fit/protocol/
 */

export interface FitRecord {
  /** Unix epoch seconds. */
  time: number
  lat?: number
  lng?: number
  altitudeM?: number
  heartRate?: number
  /** Raw FIT cadence (one leg for running, rpm for cycling). */
  cadence?: number
  distanceM?: number
  speedMs?: number
}

export interface FitLap {
  startTime: number
  elapsedS?: number
}

export interface FitActivity {
  records: FitRecord[]
  laps: FitLap[]
}

const FIT_EPOCH_OFFSET = 631_065_600
const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31

const MSG_RECORD = 20
const MSG_LAP = 19

interface FieldDef {
  num: number
  size: number
  baseType: number
}
interface MessageDef {
  globalNum: number
  littleEndian: boolean
  fields: FieldDef[]
  devSize: number
}

/** Returns undefined for the FIT "invalid" sentinel of each base type. */
function readValue(view: DataView, offset: number, def: FieldDef, littleEndian: boolean): number | undefined {
  const type = def.baseType & 0x1f
  switch (type) {
    case 1: {
      const v = view.getInt8(offset)
      return v === 0x7f ? undefined : v
    }
    case 0:
    case 2:
    case 13: {
      const v = view.getUint8(offset)
      return v === 0xff ? undefined : v
    }
    case 10: {
      const v = view.getUint8(offset)
      return v === 0 ? undefined : v
    }
    case 3: {
      const v = view.getInt16(offset, littleEndian)
      return v === 0x7fff ? undefined : v
    }
    case 4: {
      const v = view.getUint16(offset, littleEndian)
      return v === 0xffff ? undefined : v
    }
    case 11: {
      const v = view.getUint16(offset, littleEndian)
      return v === 0 ? undefined : v
    }
    case 5: {
      const v = view.getInt32(offset, littleEndian)
      return v === 0x7fffffff ? undefined : v
    }
    case 6: {
      const v = view.getUint32(offset, littleEndian)
      return v === 0xffffffff ? undefined : v
    }
    case 12: {
      const v = view.getUint32(offset, littleEndian)
      return v === 0 ? undefined : v
    }
    case 8: {
      const v = view.getFloat32(offset, littleEndian)
      return Number.isFinite(v) ? v : undefined
    }
    case 9: {
      const v = view.getFloat64(offset, littleEndian)
      return Number.isFinite(v) ? v : undefined
    }
    default:
      return undefined
  }
}

function toRecord(f: Map<number, number>): FitRecord | null {
  const timestamp = f.get(253)
  if (timestamp == null) return null
  const rawLat = f.get(0)
  const rawLng = f.get(1)
  const altitude = f.get(78) ?? f.get(2)
  const speed = f.get(73) ?? f.get(6)
  const distance = f.get(5)
  return {
    time: timestamp + FIT_EPOCH_OFFSET,
    lat: rawLat != null ? rawLat * SEMICIRCLES_TO_DEGREES : undefined,
    lng: rawLng != null ? rawLng * SEMICIRCLES_TO_DEGREES : undefined,
    altitudeM: altitude != null ? altitude / 5 - 500 : undefined,
    heartRate: f.get(3),
    cadence: f.get(4),
    distanceM: distance != null ? distance / 100 : undefined,
    speedMs: speed != null ? speed / 1000 : undefined,
  }
}

export function isFit(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytes[8] === 0x2e && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54
}

/** Decodes the first FIT file in `bytes`. Throws on malformed input. */
export function decodeFit(bytes: Uint8Array): FitActivity {
  if (!isFit(bytes)) throw new Error('Not a FIT file')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerSize = bytes[0]!
  const end = Math.min(bytes.length, headerSize + view.getUint32(4, true))

  const defs: (MessageDef | undefined)[] = []
  const records: FitRecord[] = []
  const laps: FitLap[] = []
  let lastTimestamp = 0
  let pos = headerSize

  while (pos < end) {
    const header = bytes[pos++]!
    const compressed = (header & 0x80) !== 0
    const localType = compressed ? (header >> 5) & 0x03 : header & 0x0f

    if (!compressed && (header & 0x40) !== 0) {
      const littleEndian = bytes[pos + 1] === 0
      const globalNum = view.getUint16(pos + 2, littleEndian)
      const fieldCount = bytes[pos + 4]!
      pos += 5
      const fields: FieldDef[] = []
      for (let i = 0; i < fieldCount; i++) {
        fields.push({ num: bytes[pos]!, size: bytes[pos + 1]!, baseType: bytes[pos + 2]! })
        pos += 3
      }
      let devSize = 0
      if ((header & 0x20) !== 0) {
        const devCount = bytes[pos++]!
        for (let i = 0; i < devCount; i++) {
          devSize += bytes[pos + 1]!
          pos += 3
        }
      }
      defs[localType] = { globalNum, littleEndian, fields, devSize }
      continue
    }

    const def = defs[localType]
    if (!def) throw new Error('FIT data message without definition')

    const values = new Map<number, number>()
    for (const field of def.fields) {
      if (pos + field.size > end) throw new Error('Truncated FIT file')
      const value = readValue(view, pos, field, def.littleEndian)
      if (value != null) values.set(field.num, value)
      pos += field.size
    }
    pos += def.devSize

    if (compressed) {
      const offset = header & 0x1f
      const base = lastTimestamp & ~0x1f
      values.set(253, offset >= (lastTimestamp & 0x1f) ? base + offset : base + offset + 0x20)
    }
    const timestamp = values.get(253)
    if (timestamp != null) lastTimestamp = timestamp

    if (def.globalNum === MSG_RECORD) {
      const record = toRecord(values)
      if (record) records.push(record)
    } else if (def.globalNum === MSG_LAP) {
      const start = values.get(2) ?? values.get(253)
      if (start != null) {
        const elapsed = values.get(7)
        laps.push({ startTime: start + FIT_EPOCH_OFFSET, elapsedS: elapsed != null ? elapsed / 1000 : undefined })
      }
    }
  }
  return { records, laps }
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true)
const u32 = (v: DataView, o: number) => v.getUint32(o, true)

/** Returns the bytes of the first entry of a ZIP archive (Garmin wraps the FIT file in one). */
export async function unzipFirstEntry(bytes: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 0xffff; i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive')
  const central = u32(view, eocd + 16)
  if (u32(view, central) !== 0x02014b50) throw new Error('Corrupt ZIP archive')
  const method = u16(view, central + 10)
  const compressedSize = u32(view, central + 20)
  const localOffset = u32(view, central + 42)
  if (u32(view, localOffset) !== 0x04034b50) throw new Error('Corrupt ZIP archive')
  const dataStart = localOffset + 30 + u16(view, localOffset + 26) + u16(view, localOffset + 28)
  const data = bytes.subarray(dataStart, dataStart + compressedSize)
  if (method === 0) return data
  if (method !== 8) throw new Error(`Unsupported ZIP compression ${method}`)
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Decodes a downloaded activity file: either a raw FIT file or a ZIP containing one. */
export async function decodeActivityFile(bytes: Uint8Array): Promise<FitActivity> {
  return decodeFit(isFit(bytes) ? bytes : await unzipFirstEntry(bytes))
}
