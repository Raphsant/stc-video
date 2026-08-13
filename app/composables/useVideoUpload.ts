import { VIDEO_EXT } from '~~/shared/utils/videoExt'

/**
 * Upload queue for the staff uploader.
 *
 * Files go browser -> S3 directly with presigned part URLs; the server only
 * brokers the multipart lifecycle (see server/api/admin/uploads/). Parts are
 * PUT with XMLHttpRequest rather than fetch because `xhr.upload.onprogress` is
 * the only way to get byte-level progress out of the browser.
 *
 * The queue lives at module scope, not in the component, so navigating away
 * from /upload doesn't kill a multi-GB transfer that's halfway through.
 */

const PART_CONCURRENCY = 4 // ~64 MiB in flight; parts already parallelize a file
const SIGN_BATCH = 50 // parts presigned per request (~800 MiB of headroom per batch)
const MAX_PART_ATTEMPTS = 3
const PROGRESS_SAMPLE_MS = 700

export type UploadStatus =
  | 'pending'
  | 'preparing'
  | 'uploading'
  | 'finishing'
  | 'done'
  | 'error'
  | 'canceled'

export interface UploadItem {
  id: string
  /** Name as it will land in S3 — may differ from file.name after de-duping. */
  fileName: string
  destPrefix: string
  totalBytes: number
  /** Final key, known once the upload is created (may carry a " (2)" suffix). */
  key: string | null
  uploadId: string | null
  partSize: number
  partCount: number
  status: UploadStatus
  uploadedBytes: number
  speedBps: number
  error: string | null
}

interface ItemRuntime {
  file: File
  etags: Map<number, string>
  loaded: Map<number, number>
  urls: Map<number, string>
  xhrs: Set<XMLHttpRequest>
  canceled: boolean
  sampleAt: number
  sampleBytes: number
}

class PartError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
  }
}

const items = ref<UploadItem[]>([])
const runtimes = new Map<string, ItemRuntime>()

let pumping = false
let unloadGuardInstalled = false
let notify: ReturnType<typeof useToast> | null = null

const hasActive = computed(() =>
  items.value.some(i => i.status === 'pending' || i.status === 'preparing'
    || i.status === 'uploading' || i.status === 'finishing'))

function errorMessage(err: any, fallback: string): string {
  return err?.data?.message ?? err?.message ?? fallback
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Byte length of a given 1-based part. */
function partBytes(item: UploadItem, partNumber: number): number {
  const start = (partNumber - 1) * item.partSize
  return Math.min(start + item.partSize, item.totalBytes) - start
}

function recomputeProgress(item: UploadItem, rt: ItemRuntime) {
  let total = 0
  for (const n of rt.loaded.values()) total += n
  item.uploadedBytes = Math.min(total, item.totalBytes)

  const now = Date.now()
  const elapsed = now - rt.sampleAt
  if (elapsed >= PROGRESS_SAMPLE_MS) {
    const instant = Math.max(0, (item.uploadedBytes - rt.sampleBytes) / (elapsed / 1000))
    // Smoothed: raw samples swing wildly as parts start and finish.
    item.speedBps = item.speedBps ? item.speedBps * 0.6 + instant * 0.4 : instant
    rt.sampleAt = now
    rt.sampleBytes = item.uploadedBytes
  }
}

async function signParts(item: UploadItem, rt: ItemRuntime, partNumbers: number[]) {
  const res = await $fetch('/api/admin/uploads/sign', {
    method: 'POST',
    body: { key: item.key, uploadId: item.uploadId, partNumbers },
  })
  for (const { partNumber, url } of res.urls) rt.urls.set(partNumber, url)
}

function putPart(item: UploadItem, rt: ItemRuntime, partNumber: number, url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const start = (partNumber - 1) * item.partSize
    const blob = rt.file.slice(start, start + partBytes(item, partNumber))
    const xhr = new XMLHttpRequest()
    rt.xhrs.add(xhr)

    const settle = () => rt.xhrs.delete(xhr)

    xhr.open('PUT', url, true)

    xhr.upload.onprogress = (e) => {
      rt.loaded.set(partNumber, e.loaded)
      recomputeProgress(item, rt)
    }

    xhr.onload = () => {
      settle()
      if (xhr.status < 200 || xhr.status >= 300) {
        // 403 is usually an expired signature, and every retry re-signs.
        reject(new PartError(`S3 respondió ${xhr.status}`, xhr.status >= 500 || xhr.status === 403))
        return
      }
      const etag = xhr.getResponseHeader('ETag')
      if (!etag) {
        reject(new PartError(
          'S3 no expuso el ETag de la parte. Revisa la regla CORS del bucket (ExposeHeaders: ETag).',
          false,
        ))
        return
      }
      resolve(etag)
    }

    xhr.onerror = () => {
      settle()
      reject(new PartError('Error de red al subir una parte', true))
    }
    xhr.ontimeout = () => {
      settle()
      reject(new PartError('Tiempo de espera agotado al subir una parte', true))
    }
    xhr.onabort = () => {
      settle()
      reject(new PartError('Subida cancelada', false))
    }

    xhr.send(blob)
  })
}

async function uploadPart(item: UploadItem, rt: ItemRuntime, partNumber: number) {
  for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
    if (rt.canceled) return
    try {
      // Always re-sign on a retry: expiry, clock skew and a transient 403 then
      // all recover through one path.
      if (attempt > 1 || !rt.urls.has(partNumber)) {
        await signParts(item, rt, [partNumber])
      }
      const etag = await putPart(item, rt, partNumber, rt.urls.get(partNumber)!)
      rt.etags.set(partNumber, etag)
      rt.loaded.set(partNumber, partBytes(item, partNumber))
      recomputeProgress(item, rt)
      return
    } catch (err: any) {
      if (rt.canceled) return
      rt.loaded.set(partNumber, 0) // a failed part contributes nothing
      recomputeProgress(item, rt)
      const retryable = err instanceof PartError ? err.retryable : true
      if (attempt === MAX_PART_ATTEMPTS || !retryable) throw err
      await sleep(2 ** (attempt - 1) * 1000 + Math.random() * 400)
    }
  }
}

async function runChunk(item: UploadItem, rt: ItemRuntime, chunk: number[]) {
  let cursor = 0
  let firstError: unknown = null

  const worker = async () => {
    while (!firstError && !rt.canceled) {
      const index = cursor++
      if (index >= chunk.length) return
      try {
        await uploadPart(item, rt, chunk[index]!)
      } catch (err) {
        firstError ??= err
        return
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, chunk.length) }, worker))
  if (firstError) throw firstError
}

async function uploadParts(item: UploadItem, rt: ItemRuntime) {
  const pending: number[] = []
  for (let n = 1; n <= item.partCount; n++) {
    if (!rt.etags.has(n)) pending.push(n)
  }

  // Sign a window, upload it, then move on. The brief lull between windows
  // costs far less than the bookkeeping a fully rolling signer would need,
  // and it keeps every URL fresh relative to when it's used.
  for (let i = 0; i < pending.length; i += SIGN_BATCH) {
    if (rt.canceled) return
    const chunk = pending.slice(i, i + SIGN_BATCH)
    await signParts(item, rt, chunk)
    await runChunk(item, rt, chunk)
  }
}

async function runItem(item: UploadItem) {
  const rt = runtimes.get(item.id)
  if (!rt) return

  try {
    if (!item.uploadId) {
      item.status = 'preparing'
      const res = await $fetch('/api/admin/uploads/create', {
        method: 'POST',
        body: { destPrefix: item.destPrefix, fileName: item.fileName, size: item.totalBytes },
      })
      if (rt.canceled) return
      item.key = res.key
      item.uploadId = res.uploadId
      item.partSize = res.partSize
      item.partCount = res.partCount
      // The server may have renamed around a collision already in the bucket.
      item.fileName = res.key.split('/').pop() ?? item.fileName
    }

    item.status = 'uploading'
    rt.sampleAt = Date.now()
    rt.sampleBytes = item.uploadedBytes
    await uploadParts(item, rt)
    if (rt.canceled) return

    item.status = 'finishing'
    item.speedBps = 0
    const parts = Array.from(rt.etags, ([partNumber, etag]) => ({ partNumber, etag }))
    const res = await $fetch('/api/admin/uploads/complete', {
      method: 'POST',
      body: { key: item.key, uploadId: item.uploadId, parts, size: item.totalBytes },
    })
    if (rt.canceled) return

    item.status = 'done'
    item.uploadedBytes = item.totalBytes
    notify?.add({
      title: 'Video subido',
      description: item.key ?? item.fileName,
      color: 'success',
      icon: 'i-lucide-check',
    })
    for (const w of res.warnings ?? []) {
      notify?.add({ title: 'Aviso', description: w, color: 'warning', icon: 'i-lucide-alert-triangle' })
    }
  } catch (err: any) {
    if (rt.canceled) return
    item.status = 'error'
    item.speedBps = 0
    item.error = errorMessage(err, 'No se pudo completar la subida')
    notify?.add({
      title: 'Falló la subida',
      description: `${item.fileName} — ${item.error}`,
      color: 'error',
      icon: 'i-lucide-alert-triangle',
    })
  }
}

async function pump() {
  if (pumping) return
  pumping = true
  try {
    for (;;) {
      const next = items.value.find(i => i.status === 'pending')
      if (!next) return
      await runItem(next)
    }
  } finally {
    pumping = false
  }
}

function installUnloadGuard() {
  if (unloadGuardInstalled || !import.meta.client) return
  unloadGuardInstalled = true
  window.addEventListener('beforeunload', (e) => {
    if (!hasActive.value) return
    e.preventDefault()
    e.returnValue = ''
  })
}

/** Mirror the server's " (2)" suffixing so two same-named files queued together
 *  don't race — an in-flight multipart upload is invisible to HeadObject. */
function dedupeName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name
  const dot = name.lastIndexOf('.')
  const stem = name.slice(0, dot)
  const ext = name.slice(dot)
  for (let n = 2; n < 100; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return name
}

export function useVideoUpload() {
  notify = useToast()
  installUnloadGuard()

  /** Queue files for a destination. Returns the names that weren't videos. */
  function addFiles(files: File[], destPrefix: string): string[] {
    const skipped: string[] = []
    const taken = new Set(
      items.value
        .filter(i => i.destPrefix === destPrefix && i.status !== 'canceled' && i.status !== 'error')
        .map(i => i.fileName.toLowerCase()),
    )

    for (const file of files) {
      if (!VIDEO_EXT.test(file.name) || file.size === 0) {
        skipped.push(file.name)
        continue
      }
      const fileName = dedupeName(file.name, taken)
      taken.add(fileName.toLowerCase())

      const id = crypto.randomUUID()
      runtimes.set(id, {
        file,
        etags: new Map(),
        loaded: new Map(),
        urls: new Map(),
        xhrs: new Set(),
        canceled: false,
        sampleAt: Date.now(),
        sampleBytes: 0,
      })
      items.value.push({
        id,
        fileName,
        destPrefix,
        totalBytes: file.size,
        key: null,
        uploadId: null,
        partSize: 0,
        partCount: 0,
        status: 'pending',
        uploadedBytes: 0,
        speedBps: 0,
        error: null,
      })
    }

    pump()
    return skipped
  }

  async function cancel(id: string) {
    const item = items.value.find(i => i.id === id)
    const rt = runtimes.get(id)
    if (!item || !rt) return

    rt.canceled = true
    for (const xhr of rt.xhrs) xhr.abort()
    rt.xhrs.clear()
    item.status = 'canceled'
    item.speedBps = 0

    if (item.key && item.uploadId) {
      await $fetch('/api/admin/uploads/abort', {
        method: 'POST',
        body: { key: item.key, uploadId: item.uploadId },
      }).catch(() => {})
    }
    pump()
  }

  function retry(id: string) {
    const item = items.value.find(i => i.id === id)
    const rt = runtimes.get(id)
    if (!item || !rt) return
    if (item.status !== 'error' && item.status !== 'canceled') return

    // A canceled upload was aborted server-side, so its uploadId is dead and it
    // starts over. A failed one keeps its parts and only re-sends what's missing.
    if (item.status === 'canceled') {
      item.key = null
      item.uploadId = null
      item.uploadedBytes = 0
      rt.etags.clear()
      rt.loaded.clear()
    }
    rt.urls.clear()
    rt.canceled = false
    item.error = null
    item.status = 'pending'
    pump()
  }

  function remove(id: string) {
    const item = items.value.find(i => i.id === id)
    if (!item) return
    if (item.status !== 'done' && item.status !== 'error' && item.status !== 'canceled') return
    items.value = items.value.filter(i => i.id !== id)
    runtimes.delete(id)
  }

  function clearFinished() {
    for (const i of items.value) {
      if (i.status === 'done' || i.status === 'canceled') runtimes.delete(i.id)
    }
    items.value = items.value.filter(i => i.status !== 'done' && i.status !== 'canceled')
  }

  return { items, hasActive, addFiles, cancel, retry, remove, clearFinished }
}
