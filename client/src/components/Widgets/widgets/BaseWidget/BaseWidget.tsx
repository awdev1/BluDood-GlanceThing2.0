import React from 'react'

import styles from './BaseWidget.module.css'

interface BaseWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const BaseWidget = React.forwardRef<HTMLDivElement, BaseWidgetProps>(
  ({ children, ...props }, ref) => {
    return (
      <div className={styles.widget}>
        <div id="widget" {...props} ref={ref} tabIndex={-1}>
          {children}
        </div>
      </div>
    )
  }
)

export default BaseWidget
