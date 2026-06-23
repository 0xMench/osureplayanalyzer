// Little-endian binary reader for the osu! .osr format.
//
// osu! "strings" are encoded as a single prefix byte:
//   0x00            -> empty / null string
//   0x0b            -> followed by a ULEB128 length, then that many UTF-8 bytes
export class BinaryReader {
  private view: DataView
  readonly bytes: Uint8Array
  offset = 0

  constructor(buf: ArrayBuffer) {
    this.view = new DataView(buf)
    this.bytes = new Uint8Array(buf)
  }

  get remaining(): number {
    return this.bytes.length - this.offset
  }

  private ensure(n: number) {
    if (this.offset + n > this.bytes.length) {
      throw new Error(
        `Unexpected end of file (need ${n} byte(s) at offset ${this.offset}, ` +
          `only ${this.remaining} left). The replay may be corrupt or truncated.`,
      )
    }
  }

  readByte(): number {
    this.ensure(1)
    const v = this.view.getUint8(this.offset)
    this.offset += 1
    return v
  }

  readUInt16(): number {
    this.ensure(2)
    const v = this.view.getUint16(this.offset, true)
    this.offset += 2
    return v
  }

  readInt32(): number {
    this.ensure(4)
    const v = this.view.getInt32(this.offset, true)
    this.offset += 4
    return v
  }

  readUInt32(): number {
    this.ensure(4)
    const v = this.view.getUint32(this.offset, true)
    this.offset += 4
    return v
  }

  readInt64(): bigint {
    this.ensure(8)
    const v = this.view.getBigInt64(this.offset, true)
    this.offset += 8
    return v
  }

  // ULEB128: 7 bits per byte, little-endian, high bit = "more bytes follow".
  // Uses multiplication (not <<) so lengths above 2^31 stay correct.
  readULEB128(): number {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = this.readByte()
      result += (b & 0x7f) * Math.pow(2, shift)
      shift += 7
    } while (b & 0x80)
    return result
  }

  readBytes(n: number): Uint8Array {
    this.ensure(n)
    const slice = this.bytes.subarray(this.offset, this.offset + n)
    this.offset += n
    return slice
  }

  readString(): string {
    const kind = this.readByte()
    if (kind === 0x00) return ''
    if (kind !== 0x0b) {
      throw new Error(
        `Invalid string prefix 0x${kind.toString(16)} at offset ${this.offset - 1}.`,
      )
    }
    const len = this.readULEB128()
    const slice = this.readBytes(len)
    return new TextDecoder('utf-8').decode(slice)
  }
}
