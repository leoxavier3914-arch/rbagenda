'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/db'

import styles from '../adminPanel.module.css'

type LoadingState = 'idle' | 'loading' | 'ready'

const appointmentStatuses = ['pending', 'reserved', 'confirmed', 'canceled', 'completed'] as const

type AppointmentStatus = (typeof appointmentStatuses)[number]

type ActionFeedback = {
  type: 'success' | 'error'
  text: string
}

type BranchWithOwner = {
  id: string
  name: string
  timezone: string
  owner_id: string | null
  owner: { id?: string | null; full_name: string | null; email: string | null } | null
  created_at: string
}

type BranchAdminProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: ProfileRole
}

type BranchAdminAssignment = {
  id: string
  branch_id: string
  user_id: string
  profile: BranchAdminProfile | null
}

type ProfileRole = 'client' | 'admin' | 'adminsuper' | 'adminmaster'

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  whatsapp: string | null
  role: ProfileRole
  created_at: string | null
}

type MasterAppointment = {
  id: string
  branch_id: string | null
  branch_name: string | null
  status: AppointmentStatus
  starts_at: string
  created_at: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
}

type Announcement = {
  id: string
  title: string
  message: string
  audience: string
  status: string
  publish_at: string | null
  created_at: string
  creator_name: string | null
  creator_email: string | null
}

type BookingRules = {
  maxDailyBookings: number
  cancellationWindowHours: number
  requireDeposit: boolean
  autoReminderHours: number
}

type IntegrationPolicy = {
  stripe: { enabled: boolean; mode: 'sandbox' | 'production' }
  email: { provider: string; status: 'connected' | 'pending' }
  whatsapp: { provider: string; status: 'connected' | 'pending' }
  analytics: { provider: string; propertyId: string }
}

type PolicyState<T> = {
  id: string | null
  value: T
}

type MasterSection =
  | 'overview'
  | 'branches'
  | 'users'
  | 'announcements'
  | 'policies'
  | 'integrations'
  | 'audit'

const normalizeAppointmentStatus = (status: string | null): AppointmentStatus => {
  if (!status) {
    return 'pending'
  }

  return appointmentStatuses.includes(status as AppointmentStatus)
    ? (status as AppointmentStatus)
    : 'pending'
}

const timezoneOptions = [
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Recife',
  'America/Manaus',
  'America/Fortaleza',
]

const defaultBookingRules: BookingRules = {
  maxDailyBookings: 32,
  cancellationWindowHours: 12,
  requireDeposit: true,
  autoReminderHours: 24,
}

const defaultIntegrationPolicy: IntegrationPolicy = {
  stripe: { enabled: false, mode: 'sandbox' },
  email: { provider: 'resend', status: 'pending' },
  whatsapp: { provider: 'meta', status: 'pending' },
  analytics: { provider: 'metrica-propria', propertyId: '' },
}

const sections: { key: MasterSection; label: string; description: string }[] = [
  { key: 'overview', label: 'Visão geral', description: 'Saúde do SaaS e indicadores macro' },
  { key: 'branches', label: 'Filiais', description: 'Controle das unidades e franquias' },
  { key: 'users', label: 'Usuários', description: 'Permissões, cargos e equipes' },
  { key: 'announcements', label: 'Avisos', description: 'Comunicados e mensagens globais' },
  { key: 'policies', label: 'Regras', description: 'Políticas operacionais do ecossistema' },
  { key: 'integrations', label: 'Integrações', description: 'Conectores globais do produto' },
  { key: 'audit', label: 'Auditoria', description: 'Eventos recentes e rastreabilidade' },
]

const sectionIcons: Record<MasterSection, string> = {
  overview: '🛰️',
  branches: '🏢',
  users: '🧑‍💼',
  announcements: '📣',
  policies: '📝',
  integrations: '🔌',
  audit: '🔍',
}

const headerDescription =
  'Coordene todas as unidades, usuários e políticas da plataforma em um único painel. Defina regras, acompanhe indicadores e tome decisões estratégicas em segundos.'

const roleLabels: Record<ProfileRole, string> = {
  client: 'Cliente',
  admin: 'Admin',
  adminsuper: 'Admin super',
  adminmaster: 'Admin master',
}

type AdminPanelVariant = 'adminsuper' | 'adminmaster'

const resolveUnauthorizedRedirect = (variant: AdminPanelVariant, role: ProfileRole | null) => {
  if (role === 'admin') return '/admin'
  if (role === 'adminsuper') {
    return variant === 'adminmaster' ? '/admin/adminsuper' : '/admin/adminsuper'
  }
  if (role === 'adminmaster') return '/admin/adminmaster'
  return '/login'
}

export function AdminPlatformPage({ variant }: { variant: AdminPanelVariant }): ReactElement {
  const router = useRouter()

  const [status, setStatus] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<ActionFeedback | null>(null)
  const [activeSection, setActiveSection] = useState<MasterSection>('overview')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const [branches, setBranches] = useState<BranchWithOwner[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [appointments, setAppointments] = useState<MasterAppointment[]>([])

  const [newBranch, setNewBranch] = useState({ name: '', timezone: timezoneOptions[0], owner_id: '' })
  const [branchAssignments, setBranchAssignments] = useState<Record<string, string>>({})
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', audience: 'all' })
  const [bookingPolicy, setBookingPolicy] = useState<PolicyState<BookingRules>>({ id: null, value: defaultBookingRules })
  const [integrationPolicy, setIntegrationPolicy] = useState<PolicyState<IntegrationPolicy>>({
    id: null,
    value: defaultIntegrationPolicy,
  })
  const [userRoleEdits, setUserRoleEdits] = useState<Record<string, Profile['role']>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<ProfileRole | null>(null)
  const [branchAdmins, setBranchAdmins] = useState<Record<string, BranchAdminAssignment[]>>({})
  const [branchAdminSelection, setBranchAdminSelection] = useState<Record<string, string>>({})
  const panelTitle = variant === 'adminmaster' ? 'Admin master' : 'Admin super'

  const fetchMasterData = useCallback(async () => {
    try {
      setStatus('loading')
      setError(null)

      const { data: sess, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error('Não foi possível validar sua sessão. Faça login novamente.')
      }

      const session = sess.session

      if (!session?.user?.id) {
        setStatus('idle')
        router.replace('/login')
        return
      }

      setCurrentUserId(session.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error('Não foi possível verificar suas permissões. Tente novamente.')
      }

      const userRole = profile?.role ?? null
      setCurrentUserRole(userRole)

      const isAllowedRole = variant === 'adminmaster' ? userRole === 'adminmaster' : userRole === 'adminsuper'

      if (!isAllowedRole) {
        setStatus('idle')
        router.replace(resolveUnauthorizedRedirect(variant, userRole))
        return
      }

      const [
        branchesResponse,
        profilesResponse,
        announcementsResponse,
        appointmentsResponse,
        policiesResponse,
        branchAdminsResponse,
      ] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name, timezone, owner_id, created_at, owner:profiles!branches_owner_id_fkey(id, full_name, email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp, role, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('system_announcements')
          .select(
            'id, title, message, audience, status, publish_at, created_at, creator:profiles!system_announcements_created_by_fkey(full_name, email)'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select(
            'id, branch_id, status, starts_at, created_at, customer_id, branches(name), profiles:profiles!appointments_customer_id_fkey(id, full_name, email)'
          )
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('platform_policies')
          .select('id, name, value')
          .in('name', ['booking_rules', 'integrations']),
        supabase
          .from('branch_admins')
          .select('id, branch_id, user_id, profiles:profiles!branch_admins_user_id_fkey(id, full_name, email, role)')
          .order('created_at', { ascending: false }),
      ])

      if (branchesResponse.error) {
        throw new Error('Não foi possível carregar as filiais. Tente novamente.')
      }

      if (profilesResponse.error) {
        throw new Error('Não foi possível carregar os usuários. Tente novamente.')
      }

      if (announcementsResponse.error) {
        throw new Error('Não foi possível carregar os comunicados. Tente novamente.')
      }

      if (appointmentsResponse.error) {
        throw new Error('Não foi possível carregar os agendamentos.')
      }

      if (policiesResponse.error) {
        throw new Error('Não foi possível carregar as políticas globais.')
      }

      const normalizedBranches = (branchesResponse.data ?? []).map((branch) => {
        const owner = Array.isArray(branch.owner) ? branch.owner[0] ?? null : branch.owner ?? null

        return {
          id: branch.id,
          name: branch.name,
          timezone: branch.timezone,
          owner_id: branch.owner_id ?? null,
          owner,
          created_at: branch.created_at,
        }
      }) satisfies BranchWithOwner[]

      const normalizedProfiles = (profilesResponse.data ?? []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        whatsapp: profile.whatsapp,
        role: (profile.role ?? 'client') as ProfileRole,
        created_at: profile.created_at,
      })) satisfies Profile[]

      const normalizedAnnouncements = (announcementsResponse.data ?? []).map((announcement) => {
        const creator = Array.isArray(announcement.creator)
          ? announcement.creator[0] ?? null
          : announcement.creator ?? null

        return {
          id: announcement.id,
          title: announcement.title,
          message: announcement.message,
          audience: announcement.audience,
          status: announcement.status,
          publish_at: announcement.publish_at,
          created_at: announcement.created_at,
          creator_name: creator?.full_name ?? null,
          creator_email: creator?.email ?? null,
        }
      }) satisfies Announcement[]

      const normalizedAppointments = (appointmentsResponse.data ?? []).map((appointment) => {
        const branch = Array.isArray(appointment.branches)
          ? appointment.branches[0] ?? null
          : appointment.branches ?? null

        const profileInfo = Array.isArray(appointment.profiles)
          ? appointment.profiles[0] ?? null
          : appointment.profiles ?? null

        return {
          id: appointment.id,
          branch_id: appointment.branch_id ?? null,
          branch_name: branch?.name ?? null,
          status: normalizeAppointmentStatus(appointment.status),
          starts_at: appointment.starts_at,
          created_at: appointment.created_at,
          customer_id: appointment.customer_id ?? null,
          customer_name: profileInfo?.full_name ?? null,
          customer_email: profileInfo?.email ?? null,
        }
      }) satisfies MasterAppointment[]

      const policyRecords = new Map(
        (policiesResponse.data ?? []).map((policy) => [policy.name, { id: policy.id, value: policy.value }]),
      )

      const bookingPolicyRecord = policyRecords.get('booking_rules')
      const integrationPolicyRecord = policyRecords.get('integrations')

      setBranches(normalizedBranches)
      setProfiles(normalizedProfiles)
      setAnnouncements(normalizedAnnouncements)
      setAppointments(normalizedAppointments)
      setBranchAssignments({})
      setUserRoleEdits({})

      setBookingPolicy({
        id: bookingPolicyRecord?.id ?? null,
        value: {
          ...defaultBookingRules,
          ...(bookingPolicyRecord?.value as Partial<BookingRules> | null ?? {}),
        },
      })

      setIntegrationPolicy({
        id: integrationPolicyRecord?.id ?? null,
        value: {
          ...defaultIntegrationPolicy,
          ...(integrationPolicyRecord?.value as Partial<IntegrationPolicy> | null ?? {}),
        },
      })

      const groupedAdmins = (branchAdminsResponse.data ?? []).reduce<Record<string, BranchAdminAssignment[]>>(
        (accumulator, assignment) => {
          const profileData = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles
          const entry: BranchAdminAssignment = {
            id: assignment.id,
            branch_id: assignment.branch_id,
            user_id: assignment.user_id,
            profile: profileData
              ? {
                  id: profileData.id,
                  full_name: profileData.full_name ?? null,
                  email: profileData.email ?? null,
                  role: (profileData.role ?? 'admin') as ProfileRole,
                }
              : null,
          }

          const current = accumulator[assignment.branch_id] ?? []
          return { ...accumulator, [assignment.branch_id]: [...current, entry] }
        },
        {},
      )

      setBranchAdmins(groupedAdmins)

      setStatus('ready')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ocorreu um erro inesperado ao carregar o painel administrativo.'
      setError(message)
      setStatus('idle')
    }
  }, [router, variant])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!active) return
      await fetchMasterData()
    }

    load()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (!session) {
        setBranches([])
        setProfiles([])
        setAnnouncements([])
        setAppointments([])
        setStatus('idle')
        setSigningOut(false)
        router.replace('/login')
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        fetchMasterData()
      }
    })

    return () => {
      active = false
      subscription?.subscription.unsubscribe()
    }
  }, [fetchMasterData, router])

  const isLoading = status !== 'ready' && !error

  const adminUsers = useMemo(() => profiles.filter((profile) => profile.role === 'admin'), [profiles])
  const masterUsers = useMemo(
    () => profiles.filter((profile) => profile.role === 'adminmaster' || profile.role === 'adminsuper'),
    [profiles],
  )
  const clientUsers = useMemo(() => profiles.filter((profile) => profile.role === 'client'), [profiles])
  const roleOptions = useMemo<ProfileRole[]>(() => {
    if (currentUserRole === 'adminsuper') {
      return ['client', 'admin']
    }
    return ['client', 'admin', 'adminsuper', 'adminmaster']
  }, [currentUserRole])

  const appointmentsThisMonth = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)

    return appointments.filter((appointment) => new Date(appointment.starts_at).getTime() >= start.getTime()).length
  }, [appointments])

  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((branch) => {
      map.set(branch.id, branch.name)
    })
    return map
  }, [branches])

  const appointmentStatusBreakdown = useMemo(() => {
    const breakdown = appointmentStatuses.map((status) => ({
      status,
      count: appointments.filter((appointment) => appointment.status === status).length,
    }))

    const total = breakdown.reduce((sum, item) => sum + item.count, 0)

    return { breakdown, total }
  }, [appointments])

  const branchLeaderboard = useMemo(() => {
    const counts = new Map<string, number>()

    appointments.forEach((appointment) => {
      if (!appointment.branch_id) return
      counts.set(appointment.branch_id, (counts.get(appointment.branch_id) ?? 0) + 1)
    })

    return Array.from(counts.entries())
      .map(([branchId, count]) => ({ branchId, branchName: branchNameMap.get(branchId) ?? 'Filial', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [appointments, branchNameMap])
  const appointmentTrend = useMemo(() => {
    const now = new Date()
    const months: { label: string; count: number }[] = []

    for (let offset = 5; offset >= 0; offset -= 1) {
      const reference = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const count = appointments.filter((appointment) => {
        const starts = new Date(appointment.starts_at)
        return starts.getFullYear() === reference.getFullYear() && starts.getMonth() === reference.getMonth()
      }).length

      months.push({
        label: reference
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', '')
          .toUpperCase(),
        count,
      })
    }

    return months
  }, [appointments])

  const ownerlessBranches = useMemo(() => branches.filter((branch) => !branch.owner_id), [branches])

  const publishedAnnouncements = useMemo(
    () => announcements.filter((announcement) => announcement.status === 'published'),
    [announcements],
  )

  const auditEvents = useMemo(() => {
    const events: {
      id: string
      icon: string
      title: string
      description: string
      timestamp: string | null
    }[] = []

    announcements.forEach((announcement) => {
      events.push({
        id: `announcement-${announcement.id}`,
        icon: announcement.status === 'published' ? '📢' : '🗂️',
        title: announcement.status === 'published' ? 'Comunicado publicado' : 'Comunicado criado',
        description: announcement.title,
        timestamp: announcement.created_at,
      })
    })

    branches.forEach((branch) => {
      events.push({
        id: `branch-${branch.id}`,
        icon: '🏢',
        title: 'Filial cadastrada',
        description: branch.owner?.full_name
          ? `${branch.name} · Responsável ${branch.owner.full_name}`
          : `${branch.name} · Sem responsável`,
        timestamp: branch.created_at,
      })
    })

    appointments.forEach((appointment) => {
      events.push({
        id: `appointment-${appointment.id}`,
        icon: '📅',
        title:
          appointment.status === 'canceled'
            ? 'Agendamento cancelado'
            : appointment.status === 'completed'
            ? 'Agendamento concluído'
            : 'Agendamento criado',
        description: `${appointment.branch_name ?? 'Filial não definida'} · ${
          appointment.customer_name ?? 'Cliente não identificado'
        }`,
        timestamp: appointment.created_at,
      })
    })

    return events
      .filter((event) => Boolean(event.timestamp))
      .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
      .slice(0, 18)
  }, [announcements, appointments, branches])

  const activeSectionInfo = useMemo(
    () => sections.find((section) => section.key === activeSection) ?? sections[0],
    [activeSection],
  )
  const currentSectionIcon = sectionIcons[activeSectionInfo.key]
  const isOverviewSection = activeSectionInfo.key === 'overview'

  const totalBranches = branches.length
  const totalAppointments = appointments.length
  const totalAdmins = adminUsers.length
  const totalMasters = masterUsers.length
  const totalClients = clientUsers.length
  const averageAppointmentsPerBranch = totalBranches > 0 ? Math.round(totalAppointments / totalBranches) : 0
  const isMasterUser = currentUserRole === 'adminmaster'

  const glassCardClass = styles.heroCard
  const panelCardClass = styles.panelCard
  const mutedPanelClass = styles.mutedPanel
  const primaryButtonClass = styles.primaryButton
  const secondaryButtonClass = styles.secondaryButton
  const dangerButtonClass = styles.dangerButton
  const inputClass = styles.input
  const textareaClass = styles.textarea
  const badgeClass = styles.badge
  const labelClass = styles.field
  const labelCaptionClass = styles.fieldLabel
  const navButtonBaseClass = styles.navButton
  const navButtonActiveClass = styles.navButtonActive
  const navButtonInactiveClass = styles.navButtonInactive

  const resetFormStates = useCallback(() => {
    setNewBranch({ name: '', timezone: timezoneOptions[0], owner_id: '' })
    setBranchAssignments({})
    setNewAnnouncement({ title: '', message: '', audience: 'all' })
    setUserRoleEdits({})
    setBranchAdminSelection({})
  }, [])

  const refreshMasterData = useCallback(
    async (message?: ActionFeedback) => {
      await fetchMasterData()
      resetFormStates()
      if (message) {
        setActionMessage(message)
      }
    },
    [fetchMasterData, resetFormStates],
  )

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((previous) => !previous)
  }, [])

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const { style } = document.body
    const previousOverflow = style.overflow

    if (isMenuOpen) {
      style.overflow = 'hidden'
    }

    return () => {
      style.overflow = previousOverflow
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)')

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        setIsMenuOpen(false)
      }
    }

    handleChange(mediaQuery)

    const listener = (event: MediaQueryListEvent) => handleChange(event)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    }

    mediaQuery.addListener(listener)
    return () => mediaQuery.removeListener(listener)
  }, [])

  const handleSignOut = useCallback(async () => {
    if (signingOut) {
      return
    }

    setSigningOut(true)
    setSignOutError(null)

    const { error: logoutError } = await supabase.auth.signOut()

    if (logoutError) {
      setSignOutError(logoutError.message || 'Não foi possível encerrar a sessão. Tente novamente.')
      setSigningOut(false)
      return
    }
  }, [signingOut])

  const handleBranchAssignmentChange = (branchId: string, ownerId: string) => {
    setBranchAssignments((previous) => ({ ...previous, [branchId]: ownerId }))
  }

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    if (!newBranch.name.trim()) {
      setActionMessage({ type: 'error', text: 'Informe um nome para a nova filial.' })
      return
    }

    const payload: { name: string; timezone: string; owner_id?: string | null } = {
      name: newBranch.name.trim(),
      timezone: newBranch.timezone,
    }

    if (newBranch.owner_id) {
      payload.owner_id = newBranch.owner_id
    }

    const { error: insertError } = await supabase.from('branches').insert(payload)

    if (insertError) {
      setActionMessage({ type: 'error', text: 'Não foi possível criar a filial. Tente novamente.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Filial criada com sucesso!' })
  }

  const handleAssignOwner = async (branchId: string) => {
    setActionMessage(null)
    const ownerId = branchAssignments[branchId] ?? ''

    const { error: updateError } = await supabase
      .from('branches')
      .update({ owner_id: ownerId || null })
      .eq('id', branchId)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Não foi possível atualizar o responsável da filial.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Responsável atualizado com sucesso.' })
  }

  const handleBranchAdminSelect = (branchId: string, adminId: string) => {
    setBranchAdminSelection((previous) => ({ ...previous, [branchId]: adminId }))
  }

  const handleAddBranchAdmin = async (branchId: string) => {
    setActionMessage(null)
    const userId = branchAdminSelection[branchId]

    if (!userId) {
      setActionMessage({ type: 'error', text: 'Selecione um admin para atribuir à filial.' })
      return
    }

    const { error: insertError } = await supabase
      .from('branch_admins')
      .insert({ branch_id: branchId, user_id: userId, assigned_by: currentUserId })

    if (insertError) {
      setActionMessage({ type: 'error', text: 'Não foi possível adicionar o admin à filial.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Admin atribuído à filial.' })
  }

  const handleRemoveBranchAdmin = async (assignmentId: string) => {
    setActionMessage(null)

    const { error: deleteError } = await supabase.from('branch_admins').delete().eq('id', assignmentId)

    if (deleteError) {
      setActionMessage({ type: 'error', text: 'Não foi possível remover o admin desta filial.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Admin removido da filial.' })
  }

  const handleDeleteBranch = async (branchId: string) => {
    setActionMessage(null)

    const { error: deleteError } = await supabase.from('branches').delete().eq('id', branchId)

    if (deleteError) {
      setActionMessage({
        type: 'error',
        text: 'Não foi possível remover a filial. Verifique serviços vinculados antes de tentar novamente.',
      })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Filial removida da rede.' })
  }

  const handleRoleSelectChange = (profileId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as Profile['role']
    setUserRoleEdits((previous) => ({ ...previous, [profileId]: value }))
  }

  const handleUpdateUserRole = async (profileId: string) => {
    setActionMessage(null)
    const role = userRoleEdits[profileId]
    const callerRole = currentUserRole

    if (!role) {
      setActionMessage({ type: 'error', text: 'Selecione um cargo válido antes de salvar.' })
      return
    }

    if (callerRole === 'adminsuper' && (role === 'adminsuper' || role === 'adminmaster')) {
      setActionMessage({ type: 'error', text: 'Você não pode promover usuários para este cargo.' })
      return
    }

    const { error: updateError } = await supabase.rpc('set_profile_role', {
      target_user_id: profileId,
      new_role: role,
    })

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Não foi possível atualizar o cargo do usuário.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Cargo atualizado com sucesso.' })
  }

  const handleCreateAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
      setActionMessage({ type: 'error', text: 'Informe título e mensagem para o comunicado.' })
      return
    }

    const payload = {
      title: newAnnouncement.title.trim(),
      message: newAnnouncement.message.trim(),
      audience: newAnnouncement.audience,
      status: 'published',
      publish_at: new Date().toISOString(),
      created_by: currentUserId,
    }

    const { error: insertError } = await supabase.from('system_announcements').insert(payload)

    if (insertError) {
      setActionMessage({ type: 'error', text: 'Não foi possível publicar o comunicado.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Comunicado publicado para toda a rede.' })
  }

  const handleUpdateAnnouncementStatus = async (announcementId: string, status: string) => {
    setActionMessage(null)

    const { error: updateError } = await supabase
      .from('system_announcements')
      .update({ status })
      .eq('id', announcementId)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Não foi possível atualizar o status do comunicado.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Status do comunicado atualizado.' })
  }

  const handleDeleteAnnouncement = async (announcementId: string) => {
    setActionMessage(null)

    const { error: deleteError } = await supabase.from('system_announcements').delete().eq('id', announcementId)

    if (deleteError) {
      setActionMessage({ type: 'error', text: 'Não foi possível remover o comunicado.' })
      return
    }

    await refreshMasterData({ type: 'success', text: 'Comunicado removido.' })
  }

  const handleBookingPolicyChange = <K extends keyof BookingRules>(key: K, value: BookingRules[K]) => {
    setBookingPolicy((previous) => ({
      ...previous,
      value: {
        ...previous.value,
        [key]: value,
      },
    }))
  }

  const handleSaveBookingPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    const payload = {
      id: bookingPolicy.id ?? undefined,
      name: 'booking_rules',
      value: bookingPolicy.value,
    }

    const { data, error: upsertError } = await supabase
      .from('platform_policies')
      .upsert(payload, { onConflict: 'name' })
      .select()
      .maybeSingle()

    if (upsertError) {
      setActionMessage({ type: 'error', text: 'Não foi possível salvar as regras globais.' })
      return
    }

    setBookingPolicy((previous) => ({
      ...previous,
      id: data?.id ?? previous.id,
    }))

    setActionMessage({ type: 'success', text: 'Políticas de agendamento atualizadas.' })
  }

  const handleIntegrationPolicyChange = <T extends keyof IntegrationPolicy>(
    domain: T,
    patch: Partial<IntegrationPolicy[T]>,
  ) => {
    setIntegrationPolicy((previous) => ({
      ...previous,
      value: {
        ...previous.value,
        [domain]: {
          ...previous.value[domain],
          ...patch,
        },
      },
    }))
  }

  const handleSaveIntegrationPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    const payload = {
      id: integrationPolicy.id ?? undefined,
      name: 'integrations',
      value: integrationPolicy.value,
    }

    const { data, error: upsertError } = await supabase
      .from('platform_policies')
      .upsert(payload, { onConflict: 'name' })
      .select()
      .maybeSingle()

    if (upsertError) {
      setActionMessage({ type: 'error', text: 'Não foi possível salvar as integrações padrão.' })
      return
    }

    setIntegrationPolicy((previous) => ({
      ...previous,
      id: data?.id ?? previous.id,
    }))

    setActionMessage({ type: 'success', text: 'Integrações padrão atualizadas.' })
  }

  const renderOverviewSection = (): ReactElement => {
    const maxTrendValue = Math.max(1, ...appointmentTrend.map((point) => point.count))

    return (
      <section className={styles.dashboardSection}>
        <div className={glassCardClass}>
          <div className={styles.heroIntro}>
            <span className={badgeClass}>{panelTitle}</span>
            <h2 className={styles.heroTitle}>Comando total da operação SaaS</h2>
            <p className={styles.heroSubtitle}>{headerDescription}</p>
          </div>
          <dl className={styles.heroMetrics}>
            <div className={styles.heroMetric}>
              <dt className={styles.heroMetricLabel}>Filiais ativas</dt>
              <dd className={styles.heroMetricValue}>{totalBranches}</dd>
            </div>
            <div className={styles.heroMetric}>
              <dt className={styles.heroMetricLabel}>Agendamentos (30 dias)</dt>
              <dd className={styles.heroMetricValue}>{appointmentsThisMonth}</dd>
            </div>
            <div className={styles.heroMetric}>
              <dt className={styles.heroMetricLabel}>Usuários conectados</dt>
              <dd className={styles.heroMetricValue}>{totalAdmins + totalMasters + totalClients}</dd>
            </div>
            <div className={styles.heroMetric}>
              <dt className={styles.heroMetricLabel}>Média por filial</dt>
              <dd className={styles.heroMetricValue}>{averageAppointmentsPerBranch}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.dashboardGrid}>
          <article className={`${panelCardClass} ${styles.chartCardWide}`}>
            <div className={styles.chartHeader}>
              <div>
                <h3>Tendência de agendamentos</h3>
                <p>Visão consolidada dos últimos 6 meses</p>
              </div>
              <span className={styles.chartHighlight}>{totalAppointments} registros</span>
            </div>
            <div className={styles.chartBars}>
              {appointmentTrend.map((point) => (
                <div key={point.label} className={styles.chartBar}>
                  <div
                    className={styles.chartBarFill}
                    style={{ height: `${Math.max(12, (point.count / maxTrendValue) * 100)}%` }}
                  >
                    <span className={styles.chartBarValue}>{point.count}</span>
                  </div>
                  <span className={styles.chartBarLabel}>{point.label}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={panelCardClass}>
            <div className={styles.chartHeader}>
              <div>
                <h3>Status dos agendamentos</h3>
                <p>Distribuição consolidada da plataforma</p>
              </div>
            </div>
            <ul className={styles.statusList}>
              {appointmentStatusBreakdown.breakdown.map((item) => {
                const percentage = appointmentStatusBreakdown.total
                  ? Math.round((item.count / appointmentStatusBreakdown.total) * 100)
                  : 0
                return (
                  <li key={item.status} className={styles.statusListItem}>
                    <div className={styles.statusListMeta}>
                      <span className={styles.statusListLabel}>{item.status}</span>
                      <span className={styles.statusListValue}>{percentage}%</span>
                    </div>
                    <div className={styles.statusBar}>
                      <div className={styles.statusBarFill} style={{ width: `${percentage}%` }} />
                    </div>
                    <span className={styles.statusListValue}>{item.count}</span>
                  </li>
                )
              })}
            </ul>
          </article>

          <article className={`${panelCardClass} ${styles.listCard}`}>
            <div className={styles.listHeader}>
              <h3>Filiais com maior volume</h3>
              <p>Top unidades nos últimos meses</p>
            </div>
            {branchLeaderboard.length === 0 ? (
              <p className={styles.listEmpty}>Nenhum agendamento registrado para gerar o ranking.</p>
            ) : (
              <ul className={styles.listContent}>
                {branchLeaderboard.map((entry, index) => (
                  <li key={entry.branchId} className={styles.listItem}>
                    <span className={styles.listItemTitle}>{index + 1}º · {entry.branchName}</span>
                    <span className={styles.listTag}>{entry.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={panelCardClass}>
            <div className="space-y-4">
              <div className={styles.chartHeader}>
                <div>
                  <h3>Auditoria em tempo real</h3>
                  <p>Acompanhe o que mudou na plataforma</p>
                </div>
              </div>
              {auditEvents.length === 0 ? (
                <div className={`${mutedPanelClass} text-sm`}>
                  Sem atividades recentes registradas nas últimas horas.
                </div>
              ) : (
                <ul className="space-y-3">
                  {auditEvents.map((event) => (
                    <li key={event.id} className="flex items-start gap-3">
                      <span className="text-xl leading-none">{event.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-emerald-950">{event.title}</p>
                        <p className="text-sm text-emerald-900/70">{event.description}</p>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-emerald-900/60">
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>

        <article className={panelCardClass}>
          <div className={styles.listHeader}>
            <h3>Comunicados recentes</h3>
            <p>Mensagens publicadas para toda a rede</p>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.tableHeadCell}>Título</th>
                  <th className={styles.tableHeadCell}>Audiência</th>
                  <th className={styles.tableHeadCell}>Status</th>
                  <th className={styles.tableHeadCell}>Publicado em</th>
                </tr>
              </thead>
              <tbody>
                {publishedAnnouncements.length === 0 ? (
                  <tr className={styles.tableBodyRow}>
                    <td className={styles.tableCell} colSpan={4}>
                      Nenhum comunicado publicado até o momento.
                    </td>
                  </tr>
                ) : (
                  publishedAnnouncements.slice(0, 6).map((announcement) => (
                    <tr key={announcement.id} className={styles.tableBodyRow}>
                      <td className={`${styles.tableCell} font-semibold`}>{announcement.title}</td>
                      <td className={styles.tableCell}>{announcement.audience}</td>
                      <td className={styles.tableCell}>{announcement.status}</td>
                      <td className={styles.tableCell}>
                        {announcement.publish_at
                          ? new Date(announcement.publish_at).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    )
  }

  const renderBranchesSection = (): ReactElement => (
    <section className="space-y-10">
      <div className={`${panelCardClass} space-y-6`}>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-emerald-950">Cadastrar nova filial</h2>
          <p className="text-sm text-emerald-900/70">
            Defina unidades e atribua responsáveis para cada operação licenciada.
          </p>
        </div>
        <form className="grid gap-5 md:grid-cols-3" onSubmit={handleCreateBranch}>
          <label className={`${labelClass} md:col-span-3`}>
            <span className={labelCaptionClass}>Nome da filial</span>
            <input
              className={inputClass}
              value={newBranch.name}
              onChange={(event) => setNewBranch((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Unidade Centro"
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Fuso horário</span>
            <select
              className={inputClass}
              value={newBranch.timezone}
              onChange={(event) => setNewBranch((previous) => ({ ...previous, timezone: event.target.value }))}
            >
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            <span className={labelCaptionClass}>Responsável (admin)</span>
            <select
              className={inputClass}
              value={newBranch.owner_id}
              onChange={(event) => setNewBranch((previous) => ({ ...previous, owner_id: event.target.value }))}
            >
              <option value="">Sem responsável</option>
              {adminUsers.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name ?? admin.email ?? 'Admin'}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3 flex justify-end">
            <button className={primaryButtonClass} type="submit">
              Cadastrar filial
            </button>
          </div>
        </form>
      </div>

      <div className={`${panelCardClass} space-y-4`}>
        <div className={styles.listHeader}>
          <h3>Filiais cadastradas</h3>
          <p>Gerencie responsáveis e fusos horários</p>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.tableHeadCell}>Filial</th>
                <th className={styles.tableHeadCell}>Responsável</th>
                <th className={styles.tableHeadCell}>Fuso</th>
                <th className={styles.tableHeadCell}>Criada em</th>
                <th className={styles.tableHeadCell}>Admins da filial</th>
                <th className={styles.tableHeadCell}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr className={styles.tableBodyRow}>
                  <td className={styles.tableCell} colSpan={6}>
                    Nenhuma filial cadastrada até o momento.
                  </td>
                </tr>
              ) : (
                branches.map((branch) => {
                  const selectValue = branchAssignments[branch.id] ?? branch.owner_id ?? ''
                  const isDirty = selectValue !== (branch.owner_id ?? '')
                  const adminsForBranch = branchAdmins[branch.id] ?? []
                  const availableAdmins = adminUsers.filter(
                    (admin) => !adminsForBranch.some((assignment) => assignment.user_id === admin.id),
                  )
                  const adminSelectValue = branchAdminSelection[branch.id] ?? ''
                  const canManageBranch = isMasterUser || branch.owner_id === currentUserId

                  return (
                    <tr key={branch.id} className={styles.tableBodyRow}>
                      <td className={`${styles.tableCell} font-semibold`}>{branch.name}</td>
                      <td className={styles.tableCell}>
                        <select
                          className={inputClass}
                          value={selectValue}
                          onChange={(event) => handleBranchAssignmentChange(branch.id, event.target.value)}
                          disabled={!canManageBranch}
                        >
                          <option value="">Sem responsável</option>
                          {adminUsers.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              {admin.full_name ?? admin.email ?? 'Admin'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={styles.tableCell}>{branch.timezone}</td>
                      <td className={styles.tableCell}>
                        {branch.created_at ? new Date(branch.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.branchAdminBlock}>
                          <p className={styles.tableCaption}>Admins da filial</p>
                          {adminsForBranch.length === 0 ? (
                            <p className={styles.branchAdminHelper}>Nenhum admin atribuído.</p>
                          ) : (
                            <ul className={styles.branchAdminList}>
                              {adminsForBranch.map((assignment) => (
                                <li key={assignment.id} className={styles.branchAdminItem}>
                                  <span className={styles.branchAdminTag}>
                                    {assignment.profile?.full_name ?? assignment.profile?.email ?? 'Admin'}
                                  </span>
                                  {canManageBranch ? (
                                    <button
                                      type="button"
                                      className={styles.inlineDanger}
                                      onClick={() => handleRemoveBranchAdmin(assignment.id)}
                                    >
                                      Remover
                                    </button>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}

                          {canManageBranch ? (
                            <div className={styles.branchAdminActions}>
                              <select
                                className={inputClass}
                                value={adminSelectValue}
                                onChange={(event) => handleBranchAdminSelect(branch.id, event.target.value)}
                              >
                                <option value="">Adicionar admin</option>
                                {availableAdmins.map((admin) => (
                                  <option key={admin.id} value={admin.id}>
                                    {admin.full_name ?? admin.email ?? 'Admin'}
                                  </option>
                                ))}
                              </select>
                              <button
                                className={secondaryButtonClass}
                                type="button"
                                onClick={() => handleAddBranchAdmin(branch.id)}
                                disabled={!adminSelectValue}
                              >
                                Vincular admin
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className={secondaryButtonClass}
                            type="button"
                            onClick={() => handleAssignOwner(branch.id)}
                            disabled={!isDirty || !canManageBranch}
                          >
                            Salvar responsável
                          </button>
                          <button
                            className={dangerButtonClass}
                            type="button"
                            onClick={() => handleDeleteBranch(branch.id)}
                            disabled={!canManageBranch}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )

  const renderUsersSection = (): ReactElement => (
    <section className={`${panelCardClass} space-y-6`}>
      <div className={styles.listHeader}>
        <h3>Usuários da plataforma</h3>
        <p>Atualize permissões e cargos com segurança</p>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.tableHeadCell}>Nome</th>
              <th className={styles.tableHeadCell}>E-mail</th>
              <th className={styles.tableHeadCell}>WhatsApp</th>
              <th className={styles.tableHeadCell}>Cargo</th>
              <th className={styles.tableHeadCell}>Criado em</th>
              <th className={styles.tableHeadCell}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr className={styles.tableBodyRow}>
                <td className={styles.tableCell} colSpan={6}>
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : (
              profiles.map((profile) => {
                const roleValue = userRoleEdits[profile.id] ?? profile.role
                const isDirty = roleValue !== profile.role
                const isSelf = profile.id === currentUserId
                const options = roleOptions.includes(roleValue) ? roleOptions : [roleValue, ...roleOptions]

                return (
                  <tr key={profile.id} className={styles.tableBodyRow}>
                    <td className={`${styles.tableCell} font-semibold`}>{profile.full_name ?? '—'}</td>
                    <td className={styles.tableCell}>{profile.email ?? '—'}</td>
                    <td className={styles.tableCell}>{profile.whatsapp ?? '—'}</td>
                    <td className={styles.tableCell}>
                      <select
                        className={inputClass}
                        value={roleValue}
                        onChange={(event) => handleRoleSelectChange(profile.id, event)}
                        disabled={isSelf}
                      >
                        {options.map((roleOption) => (
                          <option
                            key={roleOption}
                            value={roleOption}
                            disabled={!roleOptions.includes(roleOption) && roleOption !== roleValue}
                          >
                            {roleLabels[roleOption]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.tableCell}>
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className={styles.tableCell}>
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => handleUpdateUserRole(profile.id)}
                        disabled={!isDirty || isSelf}
                      >
                        Atualizar cargo
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const renderAnnouncementsSection = (): ReactElement => (
    <section className="space-y-10">
      <div className={`${panelCardClass} space-y-6`}>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-emerald-950">Publicar comunicado</h2>
          <p className="text-sm text-emerald-900/70">
            Envie orientações e atualizações para toda a base de clientes e administradores.
          </p>
        </div>
        <form className="grid gap-5" onSubmit={handleCreateAnnouncement}>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Título</span>
            <input
              className={inputClass}
              value={newAnnouncement.title}
              onChange={(event) => setNewAnnouncement((previous) => ({ ...previous, title: event.target.value }))}
              placeholder="Atualização de produto"
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Mensagem</span>
            <textarea
              className={textareaClass}
              rows={4}
              value={newAnnouncement.message}
              onChange={(event) => setNewAnnouncement((previous) => ({ ...previous, message: event.target.value }))}
              placeholder="Compartilhe novidades, treinamento e boas práticas..."
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Audiência</span>
            <select
              className={inputClass}
              value={newAnnouncement.audience}
              onChange={(event) => setNewAnnouncement((previous) => ({ ...previous, audience: event.target.value }))}
            >
              <option value="all">Todos</option>
              <option value="admins">Somente admins</option>
              <option value="clients">Somente clientes</option>
            </select>
          </label>
          <div className="flex justify-end">
            <button className={primaryButtonClass} type="submit">
              Publicar comunicado
            </button>
          </div>
        </form>
      </div>

      <div className={`${panelCardClass} space-y-4`}>
        <div className={styles.listHeader}>
          <h3>Comunicados cadastrados</h3>
          <p>Controle status e mantenha os avisos atualizados</p>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.tableHeadCell}>Título</th>
                <th className={styles.tableHeadCell}>Audiência</th>
                <th className={styles.tableHeadCell}>Status</th>
                <th className={styles.tableHeadCell}>Criado em</th>
                <th className={styles.tableHeadCell}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr className={styles.tableBodyRow}>
                  <td className={styles.tableCell} colSpan={5}>
                    Nenhum comunicado cadastrado.
                  </td>
                </tr>
              ) : (
                announcements.map((announcement) => (
                  <tr key={announcement.id} className={styles.tableBodyRow}>
                    <td className={`${styles.tableCell} font-semibold`}>{announcement.title}</td>
                    <td className={styles.tableCell}>{announcement.audience}</td>
                    <td className={styles.tableCell}>{announcement.status}</td>
                    <td className={styles.tableCell}>
                      {announcement.created_at
                        ? new Date(announcement.created_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className={styles.tableCell}>
                      <div className="flex flex-wrap items-center gap-2">
                        {announcement.status !== 'published' && (
                          <button
                            className={secondaryButtonClass}
                            type="button"
                            onClick={() => handleUpdateAnnouncementStatus(announcement.id, 'published')}
                          >
                            Publicar
                          </button>
                        )}
                        {announcement.status === 'published' && (
                          <button
                            className={secondaryButtonClass}
                            type="button"
                            onClick={() => handleUpdateAnnouncementStatus(announcement.id, 'archived')}
                          >
                            Arquivar
                          </button>
                        )}
                        <button
                          className={dangerButtonClass}
                          type="button"
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )

  const renderPoliciesSection = (): ReactElement => (
    <section className={`${panelCardClass} space-y-6`}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-emerald-950">Regras globais de agendamento</h2>
        <p className="text-sm text-emerald-900/70">
          Defina limites e políticas que impactam todas as filiais do ecossistema.
        </p>
      </div>
      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSaveBookingPolicy}>
        <label className={labelClass}>
          <span className={labelCaptionClass}>Máximo de agendamentos por dia</span>
          <input
            className={inputClass}
            type="number"
            min={1}
            value={bookingPolicy.value.maxDailyBookings}
            onChange={(event) => handleBookingPolicyChange('maxDailyBookings', Number(event.target.value))}
          />
        </label>
        <label className={labelClass}>
          <span className={labelCaptionClass}>Janela de cancelamento (horas)</span>
          <input
            className={inputClass}
            type="number"
            min={0}
            value={bookingPolicy.value.cancellationWindowHours}
            onChange={(event) => handleBookingPolicyChange('cancellationWindowHours', Number(event.target.value))}
          />
        </label>
        <label className={labelClass}>
          <span className={labelCaptionClass}>Lembrete automático (horas)</span>
          <input
            className={inputClass}
            type="number"
            min={0}
            value={bookingPolicy.value.autoReminderHours}
            onChange={(event) => handleBookingPolicyChange('autoReminderHours', Number(event.target.value))}
          />
        </label>
        <label className={`${labelClass} flex-row items-center gap-3`}>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={bookingPolicy.value.requireDeposit}
            onChange={(event) => handleBookingPolicyChange('requireDeposit', event.target.checked)}
          />
          <span className={labelCaptionClass}>Exigir sinal para confirmar agendamento</span>
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button className={primaryButtonClass} type="submit">
            Salvar políticas globais
          </button>
        </div>
      </form>
    </section>
  )

  const renderIntegrationsSection = (): ReactElement => (
    <section className="space-y-10">
      <div className={`${panelCardClass} space-y-6`}>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-emerald-950">Integrações padrão do SaaS</h2>
          <p className="text-sm text-emerald-900/70">
            Configure provedores oficiais e políticas de rollout para todos os clientes da plataforma.
          </p>
        </div>
        <form className="grid gap-6" onSubmit={handleSaveIntegrationPolicy}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              <span className={labelCaptionClass}>Pagamentos (Stripe)</span>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={integrationPolicy.value.stripe.enabled}
                  onChange={(event) => handleIntegrationPolicyChange('stripe', { enabled: event.target.checked })}
                />
                <span className="text-sm text-emerald-900/70">Habilitar pagamentos online</span>
              </div>
            </label>
            <label className={labelClass}>
              <span className={labelCaptionClass}>Modo Stripe</span>
              <select
                className={inputClass}
                value={integrationPolicy.value.stripe.mode}
                onChange={(event) =>
                  handleIntegrationPolicyChange('stripe', {
                    mode: event.target.value as IntegrationPolicy['stripe']['mode'],
                  })
                }
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Produção</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              <span className={labelCaptionClass}>Provedor de e-mail</span>
              <input
                className={inputClass}
                value={integrationPolicy.value.email.provider}
                onChange={(event) => handleIntegrationPolicyChange('email', { provider: event.target.value })}
              />
            </label>
            <label className={labelClass}>
              <span className={labelCaptionClass}>Status de e-mail</span>
              <select
                className={inputClass}
                value={integrationPolicy.value.email.status}
                onChange={(event) =>
                  handleIntegrationPolicyChange('email', {
                    status: event.target.value as IntegrationPolicy['email']['status'],
                  })
                }
              >
                <option value="connected">Conectado</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              <span className={labelCaptionClass}>Provedor WhatsApp</span>
              <input
                className={inputClass}
                value={integrationPolicy.value.whatsapp.provider}
                onChange={(event) => handleIntegrationPolicyChange('whatsapp', { provider: event.target.value })}
              />
            </label>
            <label className={labelClass}>
              <span className={labelCaptionClass}>Status WhatsApp</span>
              <select
                className={inputClass}
                value={integrationPolicy.value.whatsapp.status}
                onChange={(event) =>
                  handleIntegrationPolicyChange('whatsapp', {
                    status: event.target.value as IntegrationPolicy['whatsapp']['status'],
                  })
                }
              >
                <option value="connected">Conectado</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              <span className={labelCaptionClass}>Analytics</span>
              <input
                className={inputClass}
                value={integrationPolicy.value.analytics.provider}
                onChange={(event) => handleIntegrationPolicyChange('analytics', { provider: event.target.value })}
              />
            </label>
            <label className={labelClass}>
              <span className={labelCaptionClass}>Property ID</span>
              <input
                className={inputClass}
                value={integrationPolicy.value.analytics.propertyId}
                onChange={(event) => handleIntegrationPolicyChange('analytics', { propertyId: event.target.value })}
                placeholder="analytics-123"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button className={primaryButtonClass} type="submit">
              Salvar integrações padrão
            </button>
          </div>
        </form>
      </div>
    </section>
  )

  const renderAuditSection = (): ReactElement => (
    <section className={`${panelCardClass} space-y-6`}>
      <div className={styles.listHeader}>
        <h3>Auditoria consolidada</h3>
        <p>Histórico unificado de eventos relevantes</p>
      </div>
      {auditEvents.length === 0 ? (
        <div className={`${mutedPanelClass} text-sm`}>
          Nenhuma atividade registrada recentemente.
        </div>
      ) : (
        <ul className="space-y-4">
          {auditEvents.map((event) => (
            <li key={event.id} className="flex items-start gap-3 rounded-2xl border border-emerald-900/10 bg-white/70 p-4">
              <span className="text-lg leading-none">{event.icon}</span>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-emerald-950">{event.title}</p>
                <p className="text-sm text-emerald-900/70">{event.description}</p>
              </div>
              <span className="text-xs text-emerald-900/60">
                {event.timestamp
                  ? new Date(event.timestamp).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  if (isLoading) {
    return (
      <main className={`${styles.page} ${styles.loadingState}`} aria-busy="true" aria-live="polite">
        <span className="sr-only">Carregando painel {panelTitle.toLowerCase()}…</span>
      </main>
    )
  }

  let sectionContent: ReactElement

  switch (activeSection) {
    case 'overview':
      sectionContent = renderOverviewSection()
      break
    case 'branches':
      sectionContent = renderBranchesSection()
      break
    case 'users':
      sectionContent = renderUsersSection()
      break
    case 'announcements':
      sectionContent = renderAnnouncementsSection()
      break
    case 'policies':
      sectionContent = renderPoliciesSection()
      break
    case 'integrations':
      sectionContent = renderIntegrationsSection()
      break
    case 'audit':
    default:
      sectionContent = renderAuditSection()
      break
  }
  const navigationLabel = `Menu de navegação do ${panelTitle.toLowerCase()}`

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.hamburger}
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="admin-master-sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </button>
          <div className={styles.topBarTitleGroup}>
            <span className={styles.sidebarEyebrow}>Painel</span>
            <span className={styles.sidebarTitle}>{panelTitle}</span>
          </div>
        </div>

        {isMenuOpen && <div className={styles.menuOverlay} aria-hidden="true" onClick={closeMenu} />}

        <aside
          id="admin-master-sidebar"
          className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}
          aria-label={navigationLabel}
        >
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleGroup}>
              <span className={styles.sidebarEyebrow}>Painel</span>
              <h1 className={styles.sidebarTitle}>{panelTitle}</h1>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeMenu}
              aria-label="Fechar menu de navegação"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className={styles.sidebarNav}>
            {sections.map((section) => {
              const isActive = activeSection === section.key
              return (
                <button
                  key={section.key}
                  className={`${navButtonBaseClass} ${isActive ? navButtonActiveClass : navButtonInactiveClass}`}
                  onClick={() => {
                    setActiveSection(section.key)
                    setActionMessage(null)
                    closeMenu()
                  }}
                >
                  <div className={styles.navButtonContent}>
                    <span className={styles.navIcon}>{sectionIcons[section.key]}</span>
                    <span className={styles.navText}>
                      <span className={styles.navTitle}>{section.label}</span>
                      <span className={styles.navDescription}>{section.description}</span>
                    </span>
                  </div>
                  <svg className={styles.navChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </nav>
        </aside>

        <section className={styles.contentArea}>
          <div className={styles.contentShell}>
            {isOverviewSection ? (
              <header className={styles.headerGrid}>
                <div className={glassCardClass}>
                  <div className={styles.heroIntro}>
                    <span className={badgeClass}>Visão estratégica</span>
                    <h2 className={styles.heroTitle}>Orquestre todas as unidades do seu SaaS</h2>
                    <p className={styles.heroSubtitle}>{headerDescription}</p>
                  </div>
                  <dl className={styles.heroMetrics}>
                    <div className={styles.heroMetric}>
                      <dt className={styles.heroMetricLabel}>Admins masters</dt>
                      <dd className={styles.heroMetricValue}>{totalMasters}</dd>
                    </div>
                    <div className={styles.heroMetric}>
                      <dt className={styles.heroMetricLabel}>Admins unidade</dt>
                      <dd className={styles.heroMetricValue}>{totalAdmins}</dd>
                    </div>
                    <div className={styles.heroMetric}>
                      <dt className={styles.heroMetricLabel}>Clientes</dt>
                      <dd className={styles.heroMetricValue}>{totalClients}</dd>
                    </div>
                    <div className={styles.heroMetric}>
                      <dt className={styles.heroMetricLabel}>Filiais sem responsável</dt>
                      <dd className={styles.heroMetricValue}>{ownerlessBranches.length}</dd>
                    </div>
                  </dl>
                </div>
                <div className={panelCardClass}>
                  <div className={styles.quickActionsHeader}>
                    <h3>Ações rápidas</h3>
                    <p>Atualize dados ou finalize sua sessão com segurança.</p>
                  </div>
                  <div className={styles.quickActionsButtons}>
                    <button className={secondaryButtonClass} onClick={() => fetchMasterData()} disabled={status === 'loading'}>
                      {status === 'loading' ? 'Atualizando…' : 'Atualizar dados'}
                    </button>
                    <button className={primaryButtonClass} onClick={handleSignOut} disabled={signingOut}>
                      {signingOut ? 'Encerrando…' : 'Sair do painel'}
                    </button>
                  </div>
                  {signOutError && <p className={styles.errorText}>{signOutError}</p>}
                </div>
              </header>
            ) : (
              <header className={styles.sectionHeader}>
                <div className={`${panelCardClass} ${styles.sectionHeaderCard}`}>
                  <div className={styles.sectionHeaderInfo}>
                    <span className={styles.sectionHeaderIcon}>{currentSectionIcon}</span>
                    <div className={styles.sectionHeaderText}>
                      <span className={styles.sectionHeaderEyebrow}>Área selecionada</span>
                      <h2 className={styles.sectionHeaderTitle}>{activeSectionInfo.label}</h2>
                      <p className={styles.sectionHeaderDescription}>{activeSectionInfo.description}</p>
                    </div>
                  </div>
                  <div className={styles.sectionHeaderActions}>
                    <button className={secondaryButtonClass} onClick={() => fetchMasterData()} disabled={status === 'loading'}>
                      {status === 'loading' ? 'Atualizando…' : 'Recarregar dados'}
                    </button>
                    <button className={primaryButtonClass} onClick={handleSignOut} disabled={signingOut}>
                      {signingOut ? 'Encerrando…' : 'Sair'}
                    </button>
                  </div>
                </div>
                {signOutError && <p className={styles.errorText}>{signOutError}</p>}
              </header>
            )}

            {error && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <p>{error}</p>
                <div>
                  <button className={primaryButtonClass} onClick={() => fetchMasterData()}>
                    Tentar novamente
                  </button>
                </div>
              </div>
            )}

            {actionMessage && (
              <div
                className={`${styles.feedback} ${
                  actionMessage.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
                }`}
              >
                {actionMessage.text}
              </div>
            )}

            {sectionContent}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function AdminSuperPage() {
  return <AdminPlatformPage variant="adminsuper" />
}
