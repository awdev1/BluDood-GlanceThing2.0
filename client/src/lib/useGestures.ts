import { useDrag } from '@use-gesture/react'
import { useRef, useCallback } from 'react'

interface SwipeCallbacks {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

interface SwipeOptions {
  threshold?: number
  velocity?: number
  enabled?: boolean
}

export function useSwipeGesture(
  callbacks: SwipeCallbacks,
  options: SwipeOptions = {}
) {
  const {
    threshold = 50,
    velocity = 0.3,
    enabled = true
  } = options

  const bind = useDrag(
    ({ movement: [mx, my], velocity: [vx, vy], last, direction: [dx, dy] }) => {
      if (!enabled || !last) return

      const absX = Math.abs(mx)
      const absY = Math.abs(my)

      if (absX > absY) {
        if (absX > threshold || Math.abs(vx) > velocity) {
          if (dx > 0 && callbacks.onSwipeRight) {
            callbacks.onSwipeRight()
          } else if (dx < 0 && callbacks.onSwipeLeft) {
            callbacks.onSwipeLeft()
          }
        }
      } else {
        if (absY > threshold || Math.abs(vy) > velocity) {
          if (dy > 0 && callbacks.onSwipeDown) {
            callbacks.onSwipeDown()
          } else if (dy < 0 && callbacks.onSwipeUp) {
            callbacks.onSwipeUp()
          }
        }
      }
    },
    {
      filterTaps: true,
      pointer: { touch: true },
      eventOptions: { passive: false }
    }
  )

  return bind
}

interface PinchCallbacks {
  onPinch?: (scale: number) => void
  onPinchEnd?: (scale: number) => void
}

export function usePinchGesture(
  callbacks: PinchCallbacks,
  enabled: boolean = true
) {
  const lastScale = useRef(1)

  const bind = useDrag(
    ({ pinching, offset: [, scale], first, last }) => {
      if (!enabled || !pinching) return

      if (first) {
        lastScale.current = 1
      }

      if (callbacks.onPinch) {
        callbacks.onPinch(scale)
      }

      if (last && callbacks.onPinchEnd) {
        callbacks.onPinchEnd(scale)
        lastScale.current = 1
      }
    },
    {
      pointer: { touch: true }
    }
  )

  return bind
}

interface TapCallbacks {
  onTap?: () => void
  onDoubleTap?: () => void
  onLongPress?: () => void
}

interface TapOptions {
  enabled?: boolean
  doubleTapDelay?: number
  longPressDelay?: number
}

export function useTapGesture(
  callbacks: TapCallbacks,
  options: TapOptions = {}
) {
  const {
    enabled = true,
    doubleTapDelay = 300,
    longPressDelay = 500
  } = options

  const tapCount = useRef(0)
  const tapTimer = useRef<NodeJS.Timeout | null>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)

  const clearTimers = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current)
      tapTimer.current = null
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const bind = useDrag(
    ({ tap, first, last }) => {
      if (!enabled) return

      if (first) {
        isLongPress.current = false
        longPressTimer.current = setTimeout(() => {
          isLongPress.current = true
          if (callbacks.onLongPress) {
            callbacks.onLongPress()
          }
        }, longPressDelay)
      }

      if (last) {
        clearTimeout(longPressTimer.current!)
        longPressTimer.current = null

        if (isLongPress.current) {
          tapCount.current = 0
          return
        }
      }

      if (tap && !isLongPress.current) {
        tapCount.current++

        if (tapCount.current === 1) {
          tapTimer.current = setTimeout(() => {
            if (tapCount.current === 1 && callbacks.onTap) {
              callbacks.onTap()
            }
            tapCount.current = 0
          }, doubleTapDelay)
        } else if (tapCount.current === 2) {
          clearTimers()
          tapCount.current = 0
          if (callbacks.onDoubleTap) {
            callbacks.onDoubleTap()
          }
        }
      }
    },
    {
      filterTaps: false,
      pointer: { touch: true }
    }
  )

  return bind
}
