import React from 'react'

import styles from './LyricText.module.css'

const parenthesized = /\(([^)]*)\)/g

function split(words: string) {
  const background: string[] = []

  const main = words
    .replace(parenthesized, (_, inner: string) => {
      if (inner.trim()) background.push(inner.trim())
      return ''
    })
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')

  return { main, background: background.join(' ') }
}

const LyricText: React.FC<{ words: string }> = ({ words }) => {
  const { main, background } = split(words)

  return (
    <>
      {main}
      {background && (
        <span
          className={styles.background}
          data-alone={!main}
        >
          {background}
        </span>
      )}
    </>
  )
}

export default LyricText
