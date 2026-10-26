/** Pool-owned download cache. Workers still decode and retain their own grids. */
export class PopulationTileCache {
  private readonly controller = new AbortController()
  private readonly inflight = new Map<string, Promise<ArrayBuffer>>()
  private readonly loaded = new Map<string, ArrayBuffer>()
  private bytes = 0

  constructor(private readonly budget = 32 * 1024 * 1024) {}

  async get(url: string): Promise<ArrayBuffer> {
    this.controller.signal.throwIfAborted()
    const have = this.loaded.get(url)
    if (have) {
      this.loaded.delete(url)
      this.loaded.set(url, have)
      return have
    }
    const pending = this.inflight.get(url)
    if (pending) return pending
    const task = (async () => {
      const response = await fetch(url, { signal: this.controller.signal })
      if (!response.ok) throw new Error(`population tile ${response.status}`)
      const data = await response.arrayBuffer()
      this.controller.signal.throwIfAborted()
      if (data.byteLength <= this.budget) {
        while (this.bytes + data.byteLength > this.budget) {
          const oldest = this.loaded.keys().next().value!
          this.bytes -= this.loaded.get(oldest)!.byteLength
          this.loaded.delete(oldest)
        }
        this.loaded.set(url, data)
        this.bytes += data.byteLength
      }
      return data
    })()
    this.inflight.set(url, task)
    try {
      return await task
    } finally {
      this.inflight.delete(url)
    }
  }

  destroy(): void {
    this.controller.abort()
    this.loaded.clear()
    this.inflight.clear()
    this.bytes = 0
  }
}
