import { forwardRef, type KeyboardEvent } from 'react'
import { ClientGlassPanel } from '@/components/client/ClientPageLayout'

import styles from '../agendamentos.module.css'
import type {
  AppointmentStatus,
  NormalizedAppointment,
  SelectedStatusCategory,
  StatusCategory,
} from '../types'

type CompletionSummary = {
  canceledCount: number
  completedCount: number
  totalCompletedValue: number
}

type AppointmentsListProps = {
  selectedCategory: SelectedStatusCategory
  loading: boolean
  error: string | null
  hasAppointments: boolean
  filteredAppointments: NormalizedAppointment[]
  statusEmptyMessages: Record<StatusCategory, string>
  completionSummary: CompletionSummary
  toCurrency: (value: number) => string
  paginatedAppointments: NormalizedAppointment[]
  statusLabels: Record<AppointmentStatus, string>
  formatDate: (iso: string) => string
  formatTime: (iso: string) => string
  depositStatusLabel: (depositValue: number, paidValue: number) => string
  canShowPay: (appointment: NormalizedAppointment) => boolean
  canShowCancel: (status: AppointmentStatus) => boolean
  canShowEdit: (appointment: NormalizedAppointment) => boolean
  payError: string | null
  lastPayAttemptId: string | null
  payingApptId: string | null
  onStartDepositPayment: (appointmentId: string) => void
  onEdit: (appointment: NormalizedAppointment) => void
  onCancel: (appointment: NormalizedAppointment) => void
  cancelingId: string | null
  totalPages: number
  currentPage: number
  onChangePage: (page: number) => void
  selectedAppointmentId: string | null
  onSelect: (appointmentId: string) => void
}

export const AppointmentsList = forwardRef<HTMLDivElement, AppointmentsListProps>(
  (
    {
      selectedCategory,
      loading,
      error,
      hasAppointments,
      filteredAppointments,
      statusEmptyMessages,
      completionSummary,
      toCurrency,
      paginatedAppointments,
      statusLabels,
      formatDate,
      formatTime,
      depositStatusLabel,
      canShowPay,
      canShowCancel,
      canShowEdit,
      payError,
      lastPayAttemptId,
      payingApptId,
      onStartDepositPayment,
      onEdit,
      onCancel,
      cancelingId,
      totalPages,
      currentPage,
      onChangePage,
      selectedAppointmentId,
      onSelect,
    },
    ref,
  ) => (
    <ClientGlassPanel ref={ref} className={styles.resultsCard}>
      {loading ? (
        <div className={`${styles.stateCard} ${styles.stateNeutral}`}>Carregando…</div>
      ) : error ? (
        <div className={`${styles.stateCard} ${styles.stateError}`}>{error}</div>
      ) : !hasAppointments ? (
        <div className={`${styles.stateCard} ${styles.stateEmpty}`}>
          <p>Você ainda não tem agendamentos cadastrados.</p>
          <span className={styles.stateHint}>Agende um horário para vê-lo aqui.</span>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className={`${styles.stateCard} ${styles.stateEmpty}`}>
          <p>{statusEmptyMessages[selectedCategory as StatusCategory]}</p>
          <span className={styles.stateHint}>Altere o filtro para ver outros status.</span>
        </div>
      ) : (
        <>
          {selectedCategory === 'concluidos' && filteredAppointments.length > 0 ? (
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Cancelados</div>
                <div className={styles.summaryValue}>{completionSummary.canceledCount}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Finalizados</div>
                <div className={styles.summaryValue}>{completionSummary.completedCount}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Valor total finalizado</div>
                <div className={styles.summaryValue}>{toCurrency(completionSummary.totalCompletedValue)}</div>
              </div>
            </div>
          ) : null}

          <div className={styles.cards}>
            {paginatedAppointments.map((appointment) => {
              const statusLabel = statusLabels[appointment.status] ?? appointment.status
              const statusClass =
                styles[`status${appointment.status.charAt(0).toUpperCase()}${appointment.status.slice(1)}`] ||
                styles.statusDefault
              const depositLabel = depositStatusLabel(appointment.depositValue, appointment.paidValue)
              const showPay = canShowPay(appointment)
              const showCancel = canShowCancel(appointment.status)
              const showEdit = canShowEdit(appointment)
              const actions = [showPay, showEdit, showCancel].filter(Boolean)
              const shouldShowPayError = payError && lastPayAttemptId === appointment.id
              const isSelected = selectedAppointmentId === appointment.id
              const hasDeposit = appointment.depositValue > 0
              const depositValue = hasDeposit ? toCurrency(appointment.depositValue) : 'Sem sinal'
              const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(appointment.id)
                }
              }
              const shouldShowActions = isSelected && actions.length > 0

              return (
                <article
                  key={appointment.id}
                  className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                  onClick={() => onSelect(appointment.id)}
                  onKeyDown={handleCardKeyDown}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  data-selected={isSelected}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardAvatar} aria-hidden="true">
                      🛠️
                    </div>
                    <div className={styles.cardInfo}>
                      <div className={styles.serviceType}>{appointment.serviceType}</div>
                      {appointment.serviceTechnique ? (
                        <div className={styles.serviceTechnique}>{appointment.serviceTechnique}</div>
                      ) : null}
                    </div>
                    <span className={`${styles.status} ${statusClass}`}>{statusLabel}</span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon} aria-hidden="true">
                        📅
                      </span>
                      <div className={styles.detailText}>
                        <div className={styles.detailLabel}>Data</div>
                        <div className={styles.detailValue}>{formatDate(appointment.startsAt)}</div>
                      </div>
                    </div>

                    <div className={styles.detailRow}>
                      <span className={styles.detailIcon} aria-hidden="true">
                        ⏰
                      </span>
                      <div className={styles.detailText}>
                        <div className={styles.detailLabel}>Horário</div>
                        <div className={styles.detailValue}>{formatTime(appointment.startsAt)}</div>
                      </div>
                    </div>

                    <div className={`${styles.detailRow} ${styles.detailRowValue}`}>
                      <span className={styles.detailIcon} aria-hidden="true">
                        💰
                      </span>
                      <div className={styles.detailText}>
                        <div className={styles.detailLabel}>Valor</div>
                        <div className={styles.detailValue}>
                          {toCurrency(appointment.totalValue)}{' '}
                          <span className={styles.depositInline}>
                            (
                            {hasDeposit
                              ? `Sinal: ${depositValue}${depositLabel ? ` · ${depositLabel}` : ''}`
                              : 'Sem sinal'}
                            )
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {shouldShowActions && (
                    <div className={styles.cardFooter}>
                      {showPay && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPay}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onStartDepositPayment(appointment.id)
                          }}
                          disabled={payingApptId === appointment.id}
                        >
                          {payingApptId === appointment.id ? 'Abrindo…' : '💳 Pagar'}
                        </button>
                      )}
                      {showEdit && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnEdit}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onEdit(appointment)
                          }}
                        >
                          ✎ Alterar
                        </button>
                      )}
                      {showCancel && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnCancel}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onCancel(appointment)
                          }}
                          disabled={cancelingId === appointment.id}
                        >
                          {cancelingId === appointment.id ? 'Cancelando…' : '✖ Cancelar'}
                        </button>
                      )}
                    </div>
                  )}

                  {shouldShowPayError ? <div className={styles.inlineError}>{payError}</div> : null}
                </article>
              )
            })}
          </div>

          {totalPages > 1 ? (
            <div className={styles.pagination} role="navigation" aria-label="Paginação de agendamentos">
              <div className={styles.paginationRow}>
                <button
                  type="button"
                  className={styles.paginationButton}
                  onClick={() => onChangePage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  ← Página anterior
                </button>
                <button
                  type="button"
                  className={styles.paginationButton}
                  onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima página →
                </button>
              </div>
              <span className={styles.paginationInfo}>
                {currentPage} de {totalPages}
              </span>
            </div>
          ) : null}
        </>
      )}
    </ClientGlassPanel>
  ),
)

AppointmentsList.displayName = 'AppointmentsList'
