import React from 'react'
import styles from './Loader.module.css'

interface LoaderProps {
  className?: string
}

const Loader: React.FC<LoaderProps> = ({ className }) => {
  return <div className={`${styles.loader} ${className || ''}`} aria-label="Loading" role="img" />
}

export default Loader