import type { ReactNode } from 'react'
import styles from '@/styles/Home.module.css'

type Tone = 'success' | 'warn' | 'info' | 'purple' | 'danger' | 'neutral'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`card ${styles.section}${className ? ` ${className}` : ''}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className={styles.sectionTitle}>{children}</div>
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>
        {value}
        {sub != null && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className={styles.rows}>{children}</div>
}

export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{label}</div>
      <div className={styles.rowValue}>{children}</div>
    </div>
  )
}

export function CheckItem({ state, children }: { state: 'pass' | 'fail' | 'unknown'; children: ReactNode }) {
  const iconClass = state === 'pass' ? 'checkPass' : state === 'fail' ? 'checkFail' : 'checkUnknown'
  const symbol = state === 'pass' ? '✓' : state === 'fail' ? '✕' : '?'
  return (
    <div className={styles.checkItem}>
      <span className={`${styles.checkIcon} ${styles[iconClass]}`}>{symbol}</span>
      <span>{children}</span>
    </div>
  )
}

/** Truncated, monospace transaction-hash link. */
export function HashLink({ hash, href, truncate = false }: { hash: string; href: string; truncate?: boolean }) {
  const display = truncate && hash.length > 28
    ? `${hash.substring(0, 16)}…${hash.substring(hash.length - 8)}`
    : hash
  return (
    <a className={styles.hashLink} href={href} target="_blank" rel="noreferrer">
      {display}
    </a>
  )
}
