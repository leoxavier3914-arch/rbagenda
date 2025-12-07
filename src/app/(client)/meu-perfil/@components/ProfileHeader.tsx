import { ClientPageHeader } from '@/components/client/ClientPageLayout'
import { REVEAL_STAGE } from '@/lib/useLavaRevealStage'

import styles from '../meu-perfil.module.css'

type ProfileHeaderProps = {
  revealStage: number
}

export function ProfileHeader({ revealStage }: ProfileHeaderProps) {
  return (
    <ClientPageHeader
      hideDiamond
      className={`${styles.revealSeq} ${styles.revealTitle}`}
      data-visible={revealStage >= REVEAL_STAGE.TITLE}
      title={
        <>
          Meu <span className="muted2">Perfil</span>
        </>
      }
    />
  )
}
