import { useEffect, useRef } from 'react'

const HOLD_MS = 600

export const holdKeys: Record<string, string> = {
  '1': 'holdAction1',
  '2': 'holdAction2',
  '3': 'holdAction3',
  '4': 'holdAction4',
  Enter: 'holdActionDial'
}

export function useHoldActions(
  bindings: Record<string, string>,
  run: (action: string) => void
) {
  const bindingsRef = useRef(bindings)
  const runRef = useRef(run)
  bindingsRef.current = bindings
  runRef.current = run

  useEffect(() => {
    let pressed: {
      key: string
      target: EventTarget | null
      held: boolean
      timer: number
    } | null = null
    let replaying = false

    const actionFor = (key: string) => {
      const setting = holdKeys[key]
      const action = setting ? bindingsRef.current[setting] : null
      return action && action !== 'none' ? action : null
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (replaying) return
      const action = actionFor(e.key)
      if (!action) return

      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.repeat || pressed) return

      const press = {
        key: e.key,
        target: e.target,
        held: false,
        timer: window.setTimeout(() => {
          press.held = true
          runRef.current(action)
        }, HOLD_MS)
      }
      pressed = press
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (replaying) return
      if (!pressed || e.key !== pressed.key) return
      const press = pressed
      pressed = null
      window.clearTimeout(press.timer)

      e.preventDefault()
      e.stopImmediatePropagation()
      if (press.held) return

      replaying = true
      const target = press.target ?? document
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: press.key,
          bubbles: true,
          cancelable: true
        })
      )
      target.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: press.key,
          bubbles: true,
          cancelable: true
        })
      )
      replaying = false
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      if (pressed) window.clearTimeout(pressed.timer)
    }
  }, [])
}
