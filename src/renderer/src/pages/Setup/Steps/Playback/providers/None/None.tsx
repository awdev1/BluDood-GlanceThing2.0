import React, { useEffect } from 'react'
import styles from './None.module.css'

interface NoneProps {
  onStepComplete: () => void
}

const None: React.FC<NoneProps> = ({ onStepComplete }) => {
  useEffect(() => {
    onStepComplete()
  }, [])

  return (
    <div className={styles.none}>
      <p>This will simply disable media feedback on GlanceThing.</p>
    </div>
  )
}

export default None
