import { log, LogLevel } from './utils.js'
import { getStorageValue, setStorageValue } from './storage.js'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private expirationTime: number
  private storageKey: string
  private cacheName: string

  constructor(
    expirationTime: number,
    storageKey: string,
    cacheName: string
  ) {
    this.expirationTime = expirationTime
    this.storageKey = storageKey
    this.cacheName = cacheName
  }

  clean(): void {
    const now = Date.now()
    let expiredCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.expirationTime) {
        this.cache.delete(key)
        expiredCount++
      }
    }

    if (expiredCount > 0) {
      log(
        `Cleaned ${this.cacheName} cache. Removed ${expiredCount} expired entries. Current size: ${this.cache.size} entries`,
        'Spotify',
        LogLevel.DEBUG
      )
    }
  }

  save(): void {
    try {
      const cacheEntries = Array.from(this.cache.entries())
      setStorageValue(this.storageKey, cacheEntries)
      log(
        `Saved ${this.cacheName} cache with ${cacheEntries.length} entries`,
        'Spotify',
        LogLevel.DEBUG
      )
    } catch (error) {
      log(
        `Error saving ${this.cacheName} cache: ${error}`,
        'Spotify',
        LogLevel.ERROR
      )
    }
  }

  load(): void {
    try {
      const cachedData = getStorageValue(this.storageKey)
      if (cachedData && Array.isArray(cachedData)) {
        this.cache = new Map(cachedData)
        log(
          `Loaded ${this.cacheName} cache with ${this.cache.size} entries`,
          'Spotify',
          LogLevel.DEBUG
        )
        this.clean()
      } else {
        log(
          `No ${this.cacheName} cache found or invalid format`,
          'Spotify',
          LogLevel.DEBUG
        )
      }
    } catch (error) {
      log(
        `Error loading ${this.cacheName} cache: ${error}`,
        'Spotify',
        LogLevel.ERROR
      )
      this.cache = new Map()
    }
  }

  get(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key)
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  entries(): IterableIterator<[string, CacheEntry<T>]> {
    return this.cache.entries()
  }

  values(): IterableIterator<CacheEntry<T>> {
    return this.cache.values()
  }

  expirationAt(): number {
    return this.expirationTime
  }
}
