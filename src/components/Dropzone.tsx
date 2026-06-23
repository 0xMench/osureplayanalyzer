import { useRef, useState } from 'react'

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function pick(files: FileList | null) {
    const f = files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={'dropzone' + (drag ? ' drag' : '')}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        pick(e.dataTransfer.files)
      }}
    >
      <div className="big">Drop an osu! replay here</div>
      <div className="sub">
        or click to choose a <code>.osr</code> file — it never leaves your browser
      </div>
      <input
        ref={input}
        type="file"
        accept=".osr"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  )
}
