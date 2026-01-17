import type { ReactNode } from 'react'

import { REVEAL_STAGE } from '@/lib/useLavaRevealStage'

import styles from '../meu-perfil.module.css'

type ProfileHeaderProps = {
  revealStage: number
  resolvedName: string
  avatarSlot: ReactNode
  children?: ReactNode
}

export function ProfileHeader({
  revealStage,
  resolvedName,
  avatarSlot,
  children,
}: ProfileHeaderProps) {
  return (
    <header
      className={`${styles.profileHeader} ${styles.revealSeq} ${styles.revealTitle}`}
      data-visible={revealStage >= REVEAL_STAGE.TITLE}
    >
      <div className={styles.profileHeaderBand}>
        <div className={styles.profileHeaderInner}>
          <div className={styles.profileHeaderAvatar}>{avatarSlot}</div>
          <div className={styles.profileHeaderText}>
            <span className={styles.profileHeaderKicker}>Meu perfil</span>
            <h1 className={styles.profileHeaderName}>
              {resolvedName || 'Sua conta'}
            </h1>
          </div>
        </div>
      </div>
      <div className={styles.profileHeaderLower}>{children}</div>
    </header>
  )
}
