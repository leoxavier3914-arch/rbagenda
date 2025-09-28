'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/db'

type LoadingState = 'idle' | 'loading' | 'ready'

type Branch = {
  id: string
  name: string
  timezone: string
  created_at: string
}

type ServiceType = {
  id: string
  branch_id: string | null
  name: string
  description: string | null
  active: boolean
  order_index: number
  created_at: string
}

type Service = {
  id: string
  branch_id: string | null
  service_type_id: string | null
  name: string
  description: string | null
  duration_min: number
  price_cents: number
  deposit_cents: number
  buffer_min: number
  active: boolean
  created_at: string
}

const appointmentStatuses = ['pending', 'reserved', 'confirmed', 'canceled', 'completed'] as const

type AppointmentStatus = (typeof appointmentStatuses)[number]

type AdminAppointment = {
  id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  profiles: { full_name: string | null; email: string | null } | null
  services: { name: string | null } | null
}

type ClientProfile = {
  id: string
  full_name: string | null
  email: string | null
  whatsapp: string | null
  created_at: string | null
}

type AdminSection =
  | 'filiais'
  | 'servicos'
  | 'tipos'
  | 'agendamentos'
  | 'clientes'
  | 'emailjs'
  | 'configuracoes'

type ActionFeedback = {
  type: 'success' | 'error'
  text: string
}

const headerDescription =
  'Gerencie todas as operações do estúdio em um painel unificado. Cadastre filiais, organize serviços, acompanhe agendamentos e administre sua base de clientes.'

const timezoneOptions = [
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Manaus',
  'America/Fortaleza',
  'America/Recife',
]

type AppointmentGroup = {
  key: string
  label: string
  statuses: AppointmentStatus[]
}

const appointmentGroups: AppointmentGroup[] = [
  { key: 'ativos', label: 'Ativos', statuses: ['confirmed', 'reserved'] },
  { key: 'pendentes', label: 'Pendentes', statuses: ['pending'] },
  { key: 'finalizados', label: 'Finalizados', statuses: ['completed'] },
  { key: 'cancelados', label: 'Cancelados', statuses: ['canceled'] },
]

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  reserved: 'Reservado',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  completed: 'Finalizado',
}

const normalizeAppointmentStatus = (status: string | null): AppointmentStatus => {
  if (!status) {
    return 'pending'
  }

  return appointmentStatuses.includes(status as AppointmentStatus)
    ? (status as AppointmentStatus)
    : 'pending'
}

type BranchFormState = {
  name: string
  timezone: string
}

type ServiceTypeFormState = {
  name: string
  branch_id: string
  description: string
  active: boolean
}

type ServiceFormState = {
  name: string
  branch_id: string
  service_type_id: string
  description: string
  duration_min: string
  price_cents: string
  deposit_cents: string
  buffer_min: string
  active: boolean
}

const sections: { key: AdminSection; label: string; description: string }[] = [
  { key: 'agendamentos', label: 'Agendamentos', description: 'Monitoramento das reservas' },
  { key: 'filiais', label: 'Filiais', description: 'Unidades e horários' },
  { key: 'servicos', label: 'Serviços', description: 'Portfólio completo' },
  { key: 'tipos', label: 'Tipos', description: 'Categorias de serviços' },
  { key: 'clientes', label: 'Clientes', description: 'Base de clientes' },
  { key: 'emailjs', label: 'EmailJS', description: 'Integrações de e-mail' },
  { key: 'configuracoes', label: 'Configurações', description: 'Preferências do painel' },
]

export default function Admin() {
  const router = useRouter()
  const [status, setStatus] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<ActionFeedback | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSection>('agendamentos')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const [branches, setBranches] = useState<Branch[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])

  const [newBranch, setNewBranch] = useState<BranchFormState>({
    name: '',
    timezone: timezoneOptions[0],
  })

  const [branchEdits, setBranchEdits] = useState<Record<string, BranchFormState>>({})

  const [newServiceType, setNewServiceType] = useState<ServiceTypeFormState>({
    name: '',
    branch_id: '',
    description: '',
    active: true,
  })
  const [serviceTypeEdits, setServiceTypeEdits] = useState<Record<string, ServiceTypeFormState>>({})

  const [newService, setNewService] = useState<ServiceFormState>({
    name: '',
    branch_id: '',
    service_type_id: '',
    description: '',
    duration_min: '30',
    price_cents: '0',
    deposit_cents: '0',
    buffer_min: '15',
    active: true,
  })
  const [serviceEdits, setServiceEdits] = useState<Record<string, ServiceFormState>>({})

  const fetchAdminData = useCallback(async () => {
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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error('Não foi possível verificar suas permissões. Tente novamente.')
      }

      if (profile?.role !== 'admin') {
        setStatus('idle')
        router.replace('/dashboard')
        return
      }

      const [branchesResponse, serviceTypesResponse, servicesResponse, appointmentsResponse, clientsResponse] = await Promise.all([
        supabase.from('branches').select('id, name, timezone, created_at').order('created_at', { ascending: false }),
        supabase
          .from('service_types')
          .select('id, branch_id, name, description, active, order_index, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('services')
          .select(
            'id, branch_id, service_type_id, name, description, duration_min, price_cents, deposit_cents, buffer_min, active, created_at'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select(
            'id, starts_at, ends_at, status, profiles:profiles!appointments_customer_id_fkey(full_name, email), services:services(name)'
          )
          .order('starts_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp, created_at, role')
          .eq('role', 'client')
          .order('created_at', { ascending: false }),
      ])

      if (branchesResponse.error) {
        throw new Error('Não foi possível carregar as filiais. Tente novamente.')
      }

      if (serviceTypesResponse.error) {
        throw new Error('Não foi possível carregar os tipos de serviço.')
      }

      if (servicesResponse.error) {
        throw new Error('Não foi possível carregar os serviços cadastrados.')
      }

      if (appointmentsResponse.error) {
        throw new Error('Não foi possível carregar os agendamentos. Tente novamente.')
      }

      if (clientsResponse.error) {
        throw new Error('Não foi possível carregar os clientes. Tente novamente.')
      }

      const normalizedAppointments = (appointmentsResponse.data ?? []).map((appointment) => {
        const profile = Array.isArray(appointment.profiles)
          ? appointment.profiles[0] ?? null
          : appointment.profiles ?? null

        const service = Array.isArray(appointment.services)
          ? appointment.services[0] ?? null
          : appointment.services ?? null

        return {
          id: appointment.id,
          starts_at: appointment.starts_at,
          ends_at: appointment.ends_at,
          status: normalizeAppointmentStatus(appointment.status),
          profiles: profile,
          services: service,
        }
      }) satisfies AdminAppointment[]

      const normalizedServices = (servicesResponse.data ?? []).map((service) => ({
        ...service,
        description: service.description ?? null,
        branch_id: service.branch_id ?? null,
        service_type_id: service.service_type_id ?? null,
      })) satisfies Service[]

      const normalizedServiceTypes = (serviceTypesResponse.data ?? []).map((type) => ({
        ...type,
        description: type.description ?? null,
        branch_id: type.branch_id ?? null,
      })) satisfies ServiceType[]

      const normalizedBranches = (branchesResponse.data ?? []).map((branch) => ({
        ...branch,
      })) satisfies Branch[]

      const normalizedClients = (clientsResponse.data ?? []).map((client) => ({
        id: client.id,
        full_name: client.full_name,
        email: client.email,
        whatsapp: client.whatsapp,
        created_at: client.created_at,
      })) satisfies ClientProfile[]

      setBranches(normalizedBranches)
      setServiceTypes(normalizedServiceTypes)
      setServices(normalizedServices)
      setAppointments(normalizedAppointments)
      setClients(normalizedClients)
      setBranchEdits({})
      setServiceTypeEdits({})
      setServiceEdits({})
      setStatus('ready')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro inesperado. Tente novamente.'
      setError(message)
      setStatus('idle')
    }
  }, [router])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!active) return
      await fetchAdminData()
    }

    load()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (!session) {
        setAppointments([])
        setServices([])
        setServiceTypes([])
        setBranches([])
        setClients([])
        setStatus('idle')
        setSigningOut(false)
        router.replace('/login')
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        fetchAdminData()
      }
    })

    return () => {
      active = false
      subscription?.subscription.unsubscribe()
    }
  }, [fetchAdminData, router])

  const isLoading = status !== 'ready' && !error

  const groupedAppointments = useMemo(() => {
    return appointmentGroups.map((group) => ({
      ...group,
      items: appointments.filter((appt) => group.statuses.includes(appt.status)),
    }))
  }, [appointments])

  const upcomingAppointmentsCount = useMemo(
    () => appointments.filter((appt) => ['confirmed', 'reserved'].includes(appt.status)).length,
    [appointments],
  )

  const pendingAppointmentsCount = useMemo(
    () => appointments.filter((appt) => appt.status === 'pending').length,
    [appointments],
  )

  const activeServicesCount = useMemo(
    () => services.filter((service) => service.active).length,
    [services],
  )

  const highlightStats = useMemo(
    () => [
      { label: 'Agendamentos ativos', value: upcomingAppointmentsCount },
      { label: 'Pendentes', value: pendingAppointmentsCount },
      { label: 'Clientes', value: clients.length },
      { label: 'Serviços ativos', value: activeServicesCount },
    ],
    [upcomingAppointmentsCount, pendingAppointmentsCount, clients.length, activeServicesCount],
  )

  const glassCardClass =
    'rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_45px_90px_-60px_rgba(16,58,40,0.65)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_60px_120px_-60px_rgba(16,58,40,0.45)]'
  const panelCardClass =
    'rounded-3xl border border-emerald-900/15 bg-white/85 p-8 shadow-[0_45px_70px_-50px_rgba(16,58,40,0.55)] backdrop-blur-xl'
  const mutedPanelClass =
    'rounded-3xl border border-emerald-900/10 bg-emerald-50/55 p-8 text-emerald-900/85 shadow-inner shadow-emerald-900/5 backdrop-blur-xl'
  const primaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:from-emerald-500 hover:to-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none'
  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-500/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none'
  const dangerButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-red-300/70 bg-red-50/80 px-5 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:border-red-400 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
  const inputClass =
    'w-full rounded-2xl border border-emerald-900/15 bg-white/85 px-4 py-3 text-sm text-emerald-950 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 placeholder:text-emerald-900/40'
  const textareaClass = `${inputClass} min-h-[96px]`
  const labelClass = 'grid gap-2 text-sm font-medium text-emerald-950/80'
  const labelCaptionClass = 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/55'
  const surfaceCardClass =
    'rounded-3xl border border-emerald-900/10 bg-white/65 p-6 shadow-[0_35px_60px_-45px_rgba(16,58,40,0.4)] backdrop-blur'
  const navButtonBaseClass =
    'group flex w-full items-center justify-between gap-3 rounded-3xl px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2'
  const badgeClass =
    'inline-flex w-fit items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-emerald-900/70'
  const statCardClass =
    'rounded-3xl border border-white/60 bg-gradient-to-br from-white/95 via-white/80 to-emerald-50/70 p-6 shadow-[0_35px_70px_-45px_rgba(16,58,40,0.55)] backdrop-blur-xl'

  const sectionIcons: Record<AdminSection, string> = {
    agendamentos: '📅',
    filiais: '🏢',
    servicos: '💼',
    tipos: '🗂️',
    clientes: '🧑‍🤝‍🧑',
    emailjs: '✉️',
    configuracoes: '⚙️',
  }

  const resetFormStates = useCallback(() => {
    setNewBranch({ name: '', timezone: timezoneOptions[0] })
    setBranchEdits({})
    setNewServiceType({ name: '', branch_id: '', description: '', active: true })
    setServiceTypeEdits({})
    setNewService({
      name: '',
      branch_id: '',
      service_type_id: '',
      description: '',
      duration_min: '30',
      price_cents: '0',
      deposit_cents: '0',
      buffer_min: '15',
      active: true,
    })
    setServiceEdits({})
  }, [])

  const refreshData = useCallback(
    async (message?: ActionFeedback) => {
      await fetchAdminData()
      resetFormStates()
      if (message) {
        setActionMessage(message)
      }
    },
    [fetchAdminData, resetFormStates]
  )

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev)
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

  const handleSignOut = useCallback(async () => {
    if (signingOut) return

    setSigningOut(true)
    setSignOutError(null)

    const { error: logoutError } = await supabase.auth.signOut()

    if (logoutError) {
      setSignOutError(logoutError.message || 'Não foi possível encerrar a sessão. Tente novamente.')
      setSigningOut(false)
      return
    }

    router.replace('/login')
    setSigningOut(false)
  }, [router, signingOut])

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    if (!newBranch.name.trim()) {
      setActionMessage({ type: 'error', text: 'Informe um nome para a filial.' })
      return
    }

    const { error: createError } = await supabase
      .from('branches')
      .insert({ name: newBranch.name.trim(), timezone: newBranch.timezone })

    if (createError) {
      setActionMessage({ type: 'error', text: 'Não foi possível criar a filial. Tente novamente.' })
      return
    }

    await refreshData({ type: 'success', text: 'Filial criada com sucesso!' })
  }

  const handleUpdateBranch = async (branchId: string) => {
    const form = branchEdits[branchId] ?? {
      name: '',
      timezone: timezoneOptions[0],
    }

    if (!form.name.trim()) {
      setActionMessage({ type: 'error', text: 'Informe um nome válido para atualizar a filial.' })
      return
    }

    const { error: updateError } = await supabase
      .from('branches')
      .update({ name: form.name.trim(), timezone: form.timezone })
      .eq('id', branchId)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Não foi possível atualizar a filial. Tente novamente.' })
      return
    }

    await refreshData({ type: 'success', text: 'Filial atualizada com sucesso!' })
  }

  const handleDeleteBranch = async (branchId: string) => {
    setActionMessage(null)

    const { error: deleteError } = await supabase.from('branches').delete().eq('id', branchId)

    if (deleteError) {
      setActionMessage({
        type: 'error',
        text: 'Não foi possível remover a filial. Verifique se há serviços vinculados.',
      })
      return
    }

    await refreshData({ type: 'success', text: 'Filial removida com sucesso!' })
  }

  const handleCreateServiceType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    if (!newServiceType.name.trim() || !newServiceType.branch_id) {
      setActionMessage({ type: 'error', text: 'Informe o nome e a filial para cadastrar o tipo de serviço.' })
      return
    }

    const { error: createError } = await supabase.from('service_types').insert({
      name: newServiceType.name.trim(),
      branch_id: newServiceType.branch_id,
      description: newServiceType.description.trim() || null,
      active: newServiceType.active,
    })

    if (createError) {
      setActionMessage({ type: 'error', text: 'Não foi possível criar o tipo de serviço. Tente novamente.' })
      return
    }

    await refreshData({ type: 'success', text: 'Tipo de serviço criado com sucesso!' })
  }

  const handleUpdateServiceType = async (typeId: string) => {
    const form = serviceTypeEdits[typeId]

    if (!form || !form.name.trim() || !form.branch_id) {
      setActionMessage({ type: 'error', text: 'Informe todos os campos para atualizar o tipo de serviço.' })
      return
    }

    const { error: updateError } = await supabase
      .from('service_types')
      .update({
        name: form.name.trim(),
        branch_id: form.branch_id,
        description: form.description.trim() || null,
        active: form.active,
      })
      .eq('id', typeId)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Não foi possível atualizar o tipo de serviço. Tente novamente.' })
      return
    }

    await refreshData({ type: 'success', text: 'Tipo de serviço atualizado com sucesso!' })
  }

  const handleDeleteServiceType = async (typeId: string) => {
    setActionMessage(null)

    const { error: deleteError } = await supabase.from('service_types').delete().eq('id', typeId)

    if (deleteError) {
      setActionMessage({
        type: 'error',
        text: 'Não foi possível remover o tipo de serviço. Verifique se há serviços vinculados.',
      })
      return
    }

    await refreshData({ type: 'success', text: 'Tipo de serviço removido com sucesso!' })
  }

  const handleCreateService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)

    if (!newService.name.trim() || !newService.branch_id) {
      setActionMessage({ type: 'error', text: 'Informe o nome e a filial para cadastrar o serviço.' })
      return
    }

    const duration = Number(newService.duration_min)
    const price = Number(newService.price_cents)
    const deposit = Number(newService.deposit_cents)
    const buffer = Number(newService.buffer_min)

    if (Number.isNaN(duration) || duration <= 0) {
      setActionMessage({ type: 'error', text: 'Informe um tempo de duração válido para o serviço.' })
      return
    }

    if (Number.isNaN(price) || price < 0 || Number.isNaN(deposit) || deposit < 0) {
      setActionMessage({ type: 'error', text: 'Informe valores válidos para preço e sinal.' })
      return
    }

    if (Number.isNaN(buffer) || buffer < 0) {
      setActionMessage({ type: 'error', text: 'Informe um intervalo válido entre atendimentos.' })
      return
    }

    const { error: createError } = await supabase.from('services').insert({
      name: newService.name.trim(),
      branch_id: newService.branch_id,
      service_type_id: newService.service_type_id || null,
      description: newService.description.trim() || null,
      duration_min: duration,
      price_cents: price,
      deposit_cents: deposit,
      buffer_min: buffer,
      active: newService.active,
    })

    if (createError) {
      setActionMessage({ type: 'error', text: 'Não foi possível criar o serviço. Tente novamente.' })
      return
    }

    await refreshData({ type: 'success', text: 'Serviço criado com sucesso!' })
  }

  const handleUpdateService = async (serviceId: string) => {
    const form = serviceEdits[serviceId]

    if (!form || !form.name.trim() || !form.branch_id) {
      setActionMessage({ type: 'error', text: 'Informe todos os campos obrigatórios para atualizar o serviço.' })
      return
    }

    const duration = Number(form.duration_min)
    const price = Number(form.price_cents)
    const deposit = Number(form.deposit_cents)
    const buffer = Number(form.buffer_min)

    if (Number.isNaN(duration) || duration <= 0) {
      setActionMessage({ type: 'error', text: 'Informe um tempo de duração válido para o serviço.' })
      return
    }

    if (Number.isNaN(price) || price < 0 || Number.isNaN(deposit) || deposit < 0) {
      setActionMessage({ type: 'error', text: 'Informe valores válidos para preço e sinal.' })
      return
    }

    if (Number.isNaN(buffer) || buffer < 0) {
      setActionMessage({ type: 'error', text: 'Informe um intervalo válido entre atendimentos.' })
      return
    }

    const { error: updateError } = await supabase
      .from('services')
      .update({
        name: form.name.trim(),
        branch_id: form.branch_id,
        service_type_id: form.service_type_id || null,
        description: form.description.trim() || null,
        duration_min: duration,
        price_cents: price,
        deposit_cents: deposit,
        buffer_min: buffer,
        active: form.active,
      })
      .eq('id', serviceId)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Não foi possível atualizar o serviço. Tente novamente.' })
      return
    }

    await refreshData({ type: 'success', text: 'Serviço atualizado com sucesso!' })
  }

  const handleDeleteService = async (serviceId: string) => {
    setActionMessage(null)

    const { error: deleteError } = await supabase.from('services').delete().eq('id', serviceId)

    if (deleteError) {
      setActionMessage({
        type: 'error',
        text: 'Não foi possível remover o serviço. Verifique se existem agendamentos relacionados.',
      })
      return
    }

    await refreshData({ type: 'success', text: 'Serviço removido com sucesso!' })
  }

  const renderBranchSection = () => (
    <section className="space-y-10">
      <div className={`${panelCardClass} space-y-6`}>
        <div className="space-y-3">
          <span className={badgeClass}>Cadastro de filiais</span>
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Cadastrar nova filial</h2>
          <p className="text-sm text-emerald-900/70">
            Estruture a expansão do estúdio registrando novas unidades com fuso horário personalizado.
          </p>
        </div>
        <form
          className="grid gap-5 md:grid-cols-[minmax(0,2fr),minmax(0,2fr),minmax(0,1.2fr)]"
          onSubmit={handleCreateBranch}
        >
          <label className={labelClass}>
            <span className={labelCaptionClass}>Nome</span>
            <input
              className={inputClass}
              value={newBranch.name}
              onChange={(event) => setNewBranch((state) => ({ ...state, name: event.target.value }))}
              placeholder="Ex: Unidade Centro"
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Fuso horário</span>
            <select
              className={inputClass}
              value={newBranch.timezone}
              onChange={(event) => setNewBranch((state) => ({ ...state, timezone: event.target.value }))}
            >
              {timezoneOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className={`${primaryButtonClass} w-full`} type="submit">
              Adicionar filial
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Filiais cadastradas</h2>
            <p className="text-sm text-emerald-900/70">Atualize rapidamente detalhes e mantenha as informações consistentes.</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/50">
            {branches.length} {branches.length === 1 ? 'filial' : 'filiais'}
          </span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {branches.map((branch) => {
            const form = branchEdits[branch.id] ?? {
              name: branch.name,
              timezone: branch.timezone,
            }
            return (
              <div key={branch.id} className={`${surfaceCardClass} space-y-5`}>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-950">{branch.name}</h3>
                      <p className="text-xs text-emerald-900/60">
                        Criada em {new Date(branch.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {branch.timezone}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900/60">ID: {branch.id}</p>
                </div>
                <div className="space-y-4 border-t border-emerald-900/10 pt-4">
                  <h4 className="text-sm font-semibold text-emerald-950">Editar filial</h4>
                  <div className="grid gap-4">
                    <label className={labelClass}>
                      <span className={labelCaptionClass}>Nome</span>
                      <input
                        className={inputClass}
                        value={form.name}
                        onChange={(event) =>
                          setBranchEdits((state) => ({
                            ...state,
                            [branch.id]: { ...form, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className={labelClass}>
                      <span className={labelCaptionClass}>Fuso horário</span>
                      <select
                        className={inputClass}
                        value={form.timezone}
                        onChange={(event) =>
                          setBranchEdits((state) => ({
                            ...state,
                            [branch.id]: { ...form, timezone: event.target.value },
                          }))
                        }
                      >
                        {timezoneOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        className={`${primaryButtonClass} flex-1`}
                        type="button"
                        onClick={() => handleUpdateBranch(branch.id)}
                      >
                        Salvar alterações
                      </button>
                      <button
                        className={`${dangerButtonClass} flex-1`}
                        type="button"
                        onClick={() => handleDeleteBranch(branch.id)}
                      >
                        Remover filial
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {branches.length === 0 && (
            <div className={`${mutedPanelClass} text-sm`}>
              Nenhuma filial cadastrada até o momento.
            </div>
          )}
        </div>
      </div>
    </section>
  )
  const renderServiceTypesSection = () => (
    <section className="space-y-10">
      <div className={`${panelCardClass} space-y-6`}>
        <div className="space-y-3">
          <span className={badgeClass}>Organização</span>
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Cadastrar tipo de serviço</h2>
          <p className="text-sm text-emerald-900/70">
            Estruture seu catálogo em categorias para acelerar a busca por serviços durante o agendamento.
          </p>
        </div>
        <form className="grid gap-5 md:grid-cols-4" onSubmit={handleCreateServiceType}>
          <label className={`${labelClass} md:col-span-2`}>
            <span className={labelCaptionClass}>Nome</span>
            <input
              className={inputClass}
              value={newServiceType.name}
              onChange={(event) =>
                setNewServiceType((state) => ({
                  ...state,
                  name: event.target.value,
                }))
              }
              placeholder="Ex: Sobrancelhas"
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Filial</span>
            <select
              className={inputClass}
              value={newServiceType.branch_id}
              onChange={(event) =>
                setNewServiceType((state) => ({
                  ...state,
                  branch_id: event.target.value,
                }))
              }
            >
              <option value="">Selecione uma filial</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Status</span>
            <select
              className={inputClass}
              value={newServiceType.active ? 'true' : 'false'}
              onChange={(event) =>
                setNewServiceType((state) => ({
                  ...state,
                  active: event.target.value === 'true',
                }))
              }
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </label>
          <label className={`${labelClass} md:col-span-4`}>
            <span className={labelCaptionClass}>Descrição</span>
            <textarea
              className={textareaClass}
              value={newServiceType.description}
              onChange={(event) =>
                setNewServiceType((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              placeholder="Descreva como esta categoria organiza seus serviços"
            />
          </label>
          <div className="md:col-span-4 flex items-end">
            <button className={`${primaryButtonClass} w-full`} type="submit">
              Adicionar tipo
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Tipos cadastrados</h2>
            <p className="text-sm text-emerald-900/70">Edite descrições, status e vínculos com filiais em tempo real.</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/50">
            {serviceTypes.length} {serviceTypes.length === 1 ? 'categoria' : 'categorias'}
          </span>
        </div>
        <div className="grid gap-6">
          {serviceTypes.map((type) => {
            const form =
              serviceTypeEdits[type.id] ?? ({
                name: type.name,
                branch_id: type.branch_id ?? '',
                description: type.description ?? '',
                active: type.active,
              } satisfies ServiceTypeFormState)

            return (
              <div key={type.id} className={`${surfaceCardClass} space-y-5`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-emerald-950">{type.name}</h3>
                    <p className="text-xs text-emerald-900/60">
                      Criado em {new Date(type.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold ${
                      type.active
                        ? 'bg-emerald-500/15 text-emerald-700'
                        : 'bg-amber-200/40 text-amber-700'
                    }`}
                  >
                    {type.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Nome</span>
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(event) =>
                        setServiceTypeEdits((state) => ({
                          ...state,
                          [type.id]: { ...form, name: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Filial</span>
                    <select
                      className={inputClass}
                      value={form.branch_id}
                      onChange={(event) =>
                        setServiceTypeEdits((state) => ({
                          ...state,
                          [type.id]: { ...form, branch_id: event.target.value },
                        }))
                      }
                    >
                      <option value="">Selecione uma filial</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Status</span>
                    <select
                      className={inputClass}
                      value={form.active ? 'true' : 'false'}
                      onChange={(event) =>
                        setServiceTypeEdits((state) => ({
                          ...state,
                          [type.id]: { ...form, active: event.target.value === 'true' },
                        }))
                      }
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Descrição</span>
                    <textarea
                      className={textareaClass}
                      value={form.description}
                      onChange={(event) =>
                        setServiceTypeEdits((state) => ({
                          ...state,
                          [type.id]: { ...form, description: event.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className={`${primaryButtonClass} flex-1`}
                    type="button"
                    onClick={() => handleUpdateServiceType(type.id)}
                  >
                    Salvar alterações
                  </button>
                  <button
                    className={`${dangerButtonClass} flex-1`}
                    type="button"
                    onClick={() => handleDeleteServiceType(type.id)}
                  >
                    Remover tipo
                  </button>
                </div>
              </div>
            )
          })}
          {serviceTypes.length === 0 && (
            <div className={`${mutedPanelClass} text-sm`}>
              Nenhum tipo de serviço cadastrado até o momento.
            </div>
          )}
        </div>
      </div>
    </section>
  )
  const renderServicesSection = () => (
    <section className="space-y-10">
      <div className={`${panelCardClass} space-y-6`}>
        <div className="space-y-3">
          <span className={badgeClass}>Portfólio</span>
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Cadastrar serviço</h2>
          <p className="text-sm text-emerald-900/70">
            Construa descrições completas com preço, duração e intervalo entre atendimentos para uma operação consistente.
          </p>
        </div>
        <form className="grid gap-5 md:grid-cols-4" onSubmit={handleCreateService}>
          <label className={`${labelClass} md:col-span-2`}>
            <span className={labelCaptionClass}>Nome</span>
            <input
              className={inputClass}
              value={newService.name}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  name: event.target.value,
                }))
              }
              placeholder="Ex: Design de sobrancelhas"
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Filial</span>
            <select
              className={inputClass}
              value={newService.branch_id}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  branch_id: event.target.value,
                }))
              }
            >
              <option value="">Selecione uma filial</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Tipo</span>
            <select
              className={inputClass}
              value={newService.service_type_id}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  service_type_id: event.target.value,
                }))
              }
            >
              <option value="">Sem categoria</option>
              {serviceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Duração (min)</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={newService.duration_min}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  duration_min: event.target.value,
                }))
              }
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Preço (centavos)</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={newService.price_cents}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  price_cents: event.target.value,
                }))
              }
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Sinal (centavos)</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={newService.deposit_cents}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  deposit_cents: event.target.value,
                }))
              }
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Intervalo (min)</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={newService.buffer_min}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  buffer_min: event.target.value,
                }))
              }
            />
          </label>
          <label className={labelClass}>
            <span className={labelCaptionClass}>Status</span>
            <select
              className={inputClass}
              value={newService.active ? 'true' : 'false'}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  active: event.target.value === 'true',
                }))
              }
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </label>
          <label className={`${labelClass} md:col-span-4`}>
            <span className={labelCaptionClass}>Descrição</span>
            <textarea
              className={textareaClass}
              value={newService.description}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              placeholder="Detalhe benefícios, materiais e diferenciais deste serviço"
            />
          </label>
          <div className="md:col-span-4 flex items-end">
            <button className={`${primaryButtonClass} w-full`} type="submit">
              Adicionar serviço
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Serviços cadastrados</h2>
            <p className="text-sm text-emerald-900/70">
              Ajuste rapidamente preços, intervalos e descrições para manter o catálogo atualizado.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/50">
            {services.length} {services.length === 1 ? 'serviço' : 'serviços'}
          </span>
        </div>
        <div className="grid gap-6">
          {services.map((service) => {
            const form =
              serviceEdits[service.id] ?? ({
                name: service.name,
                branch_id: service.branch_id ?? '',
                service_type_id: service.service_type_id ?? '',
                description: service.description ?? '',
                duration_min: String(service.duration_min),
                price_cents: String(service.price_cents),
                deposit_cents: String(service.deposit_cents),
                buffer_min: String(service.buffer_min),
                active: service.active,
              } satisfies ServiceFormState)

            return (
              <div key={service.id} className={`${surfaceCardClass} space-y-5`}>
                <div className="flex flex-col gap-3 border-b border-emerald-900/10 pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-emerald-950">{service.name}</h3>
                    <p className="text-xs text-emerald-900/60">
                      Criado em {new Date(service.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-900/65">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
                        service.active
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-amber-200/40 text-amber-700'
                      }`}
                    >
                      {service.active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="rounded-full bg-white/70 px-3 py-1 font-semibold">
                      {service.duration_min} min
                    </span>
                    <span className="rounded-full bg-white/70 px-3 py-1 font-semibold">
                      Intervalo {service.buffer_min} min
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Nome</span>
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, name: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Filial</span>
                    <select
                      className={inputClass}
                      value={form.branch_id}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, branch_id: event.target.value },
                        }))
                      }
                    >
                      <option value="">Selecione uma filial</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Tipo</span>
                    <select
                      className={inputClass}
                      value={form.service_type_id}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, service_type_id: event.target.value },
                        }))
                      }
                    >
                      <option value="">Sem categoria</option>
                      {serviceTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Duração (min)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      value={form.duration_min}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, duration_min: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Preço (centavos)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={form.price_cents}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, price_cents: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Sinal (centavos)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={form.deposit_cents}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, deposit_cents: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Intervalo (min)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={form.buffer_min}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, buffer_min: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    <span className={labelCaptionClass}>Status</span>
                    <select
                      className={inputClass}
                      value={form.active ? 'true' : 'false'}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, active: event.target.value === 'true' },
                        }))
                      }
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                  <label className={`${labelClass} md:col-span-2`}>
                    <span className={labelCaptionClass}>Descrição</span>
                    <textarea
                      className={textareaClass}
                      value={form.description}
                      onChange={(event) =>
                        setServiceEdits((state) => ({
                          ...state,
                          [service.id]: { ...form, description: event.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3 border-t border-emerald-900/10 pt-4 sm:flex-row">
                  <button
                    className={`${primaryButtonClass} flex-1`}
                    type="button"
                    onClick={() => handleUpdateService(service.id)}
                  >
                    Salvar alterações
                  </button>
                  <button
                    className={`${dangerButtonClass} flex-1`}
                    type="button"
                    onClick={() => handleDeleteService(service.id)}
                  >
                    Remover serviço
                  </button>
                </div>
              </div>
            )
          })}
          {services.length === 0 && (
            <div className={`${mutedPanelClass} text-sm`}>
              Nenhum serviço cadastrado até o momento.
            </div>
          )}
        </div>
      </div>
    </section>
  )
  const renderAppointmentsSection = () => (
    <section className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {groupedAppointments.map((group) => (
          <div key={group.key} className={`${statCardClass} space-y-3`}>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/55">{group.label}</span>
            <p className="text-3xl font-semibold text-emerald-950">{group.items.length}</p>
            <p className="text-xs text-emerald-900/60">
              {group.statuses.length > 1
                ? 'Inclui agendamentos confirmados ou reservados.'
                : `Status: ${appointmentStatusLabels[group.statuses[0]]}`}
            </p>
          </div>
        ))}
      </div>

      {groupedAppointments.map((group) => (
        <div key={group.key} className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">{group.label}</h2>
              <p className="text-sm text-emerald-900/70">
                Visualize o histórico de cada reserva com dados completos de cliente e horários.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/50">
              {group.items.length} {group.items.length === 1 ? 'agendamento' : 'agendamentos'}
            </span>
          </div>
          {group.items.length === 0 ? (
            <div className={`${mutedPanelClass} text-sm`}>
              Nenhum agendamento {group.label.toLowerCase()}.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {group.items.map((appointment) => (
                <article key={appointment.id} className={`${surfaceCardClass} space-y-4`}>
                  <div className="flex flex-col gap-3 border-b border-emerald-900/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-emerald-950">
                        {appointment.services?.name ?? 'Serviço não informado'}
                      </h3>
                      <p className="text-xs text-emerald-900/60">ID: {appointment.id}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {appointmentStatusLabels[appointment.status] ?? appointment.status}
                    </span>
                  </div>
                  <dl className="grid gap-3 text-sm text-emerald-900/80 md:grid-cols-2">
                    <div className="space-y-1">
                      <dt className={labelCaptionClass}>Cliente</dt>
                      <dd className="font-semibold">{appointment.profiles?.full_name ?? 'Sem nome informado'}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={labelCaptionClass}>E-mail</dt>
                      <dd>{appointment.profiles?.email ?? '—'}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={labelCaptionClass}>Início</dt>
                      <dd>{new Date(appointment.starts_at).toLocaleString()}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={labelCaptionClass}>Fim</dt>
                      <dd>{new Date(appointment.ends_at).toLocaleString()}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
  const renderClientsSection = () => (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">Clientes cadastrados</h2>
          <p className="text-sm text-emerald-900/70">Acompanhe a evolução da sua base e mantenha o relacionamento ativo.</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/50">
          {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>
      {clients.length === 0 ? (
        <div className={`${mutedPanelClass} text-sm`}>
          Nenhum cliente cadastrado ainda.
        </div>
      ) : (
        <div className={`${panelCardClass} overflow-hidden p-0`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-emerald-950">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-600/15 to-emerald-400/15 text-left text-xs uppercase tracking-[0.18em] text-emerald-900/70">
                  <th className="px-6 py-4 font-semibold">Nome</th>
                  <th className="px-6 py-4 font-semibold">E-mail</th>
                  <th className="px-6 py-4 font-semibold">WhatsApp</th>
                  <th className="px-6 py-4 font-semibold">Desde</th>
                  <th className="px-6 py-4 font-semibold">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/10 bg-white/85">
                {clients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-emerald-500/5">
                    <td className="px-6 py-4 font-semibold">{client.full_name ?? '—'}</td>
                    <td className="px-6 py-4">{client.email ?? '—'}</td>
                    <td className="px-6 py-4">{client.whatsapp ?? '—'}</td>
                    <td className="px-6 py-4">
                      {client.created_at ? new Date(client.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-emerald-900/60">{client.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
  const renderPlaceholderSection = (message: string) => (
    <section className={`${mutedPanelClass} flex min-h-[320px] items-center justify-center text-center text-sm`}>
      {message}
    </section>
  )

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-16" aria-busy="true" aria-live="polite">
        <span className="sr-only">Carregando painel administrativo…</span>
      </main>
    )
  }

  let sectionContent: ReactElement

  switch (activeSection) {
    case 'filiais':
      sectionContent = renderBranchSection()
      break
    case 'servicos':
      sectionContent = renderServicesSection()
      break
    case 'tipos':
      sectionContent = renderServiceTypesSection()
      break
    case 'clientes':
      sectionContent = renderClientsSection()
      break
    case 'emailjs':
      sectionContent = renderPlaceholderSection('Em breve! Integração com EmailJS em desenvolvimento.')
      break
    case 'configuracoes':
      sectionContent = renderPlaceholderSection('Em breve! Personalize configurações avançadas do painel.')
      break
    case 'agendamentos':
    default:
      sectionContent = renderAppointmentsSection()
      break
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200/60">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-700/20 blur-3xl" aria-hidden="true" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        <div className="flex items-center justify-between gap-3 border-b border-white/40 bg-white/80 px-6 py-4 backdrop-blur lg:hidden">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-900/60">Painel</p>
            <h1 className="text-2xl font-semibold text-emerald-950">Administração</h1>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm shadow-emerald-500/10 transition hover:bg-white"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="admin-sidebar"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </button>
        </div>

        {isMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-emerald-900/30 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
            onClick={closeMenu}
          />
        )}

        <aside
          id="admin-sidebar"
          className={`fixed inset-y-0 left-0 z-40 w-full max-w-xs transform bg-white/75 px-6 py-8 shadow-2xl shadow-emerald-900/15 backdrop-blur-xl transition duration-300 ease-in-out lg:static lg:flex lg:w-80 lg:translate-x-0 lg:border-r lg:border-white/60 lg:shadow-none ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex h-full flex-col gap-8">
            <div className="flex items-center justify-between lg:block">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-900/60">Painel</p>
                <h1 className="text-2xl font-semibold text-emerald-950">Administração</h1>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-emerald-900 shadow-sm shadow-emerald-500/10 transition hover:bg-white lg:hidden"
                onClick={closeMenu}
                aria-label="Fechar menu de navegação"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-2">
              {sections.map((section) => {
                const isActive = activeSection === section.key
                return (
                  <button
                    key={section.key}
                    className={`${navButtonBaseClass} ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-950 shadow-lg shadow-emerald-500/25'
                        : 'text-emerald-900/65 hover:bg-white/70'
                    }`}
                    onClick={() => {
                      setActiveSection(section.key)
                      setActionMessage(null)
                      closeMenu()
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-lg">
                        {sectionIcons[section.key]}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{section.label}</span>
                        <span className="block text-xs text-emerald-900/60">{section.description}</span>
                      </span>
                    </div>
                    <svg
                      className={`h-5 w-5 transition ${isActive ? 'translate-x-1 opacity-100' : 'opacity-40 group-hover:opacity-70'}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                    </svg>
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto px-6 py-10 lg:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
            <header className="grid gap-6 xl:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className={`${glassCardClass} space-y-8`}>
                <div className="space-y-4">
                  <span className={badgeClass}>Painel administrativo</span>
                  <h2 className="text-3xl font-semibold leading-tight text-white drop-shadow-sm md:text-4xl">
                    Controle completo da agenda e operações
                  </h2>
                  <p className="text-sm text-white/80">{headerDescription}</p>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {highlightStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-white/15 px-4 py-3 text-white backdrop-blur-sm">
                      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">{stat.label}</dt>
                      <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className={`${panelCardClass} space-y-6`}>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-emerald-950">Ações rápidas</h3>
                  <p className="text-xs text-emerald-900/70">Gerencie sua sessão e atualize os dados do painel quando precisar.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button className={`${primaryButtonClass} w-full`} onClick={handleSignOut} disabled={signingOut}>
                    {signingOut ? 'Encerrando sessão…' : 'Sair do painel'}
                  </button>
                  <button
                    className={`${secondaryButtonClass} w-full`}
                    onClick={() => fetchAdminData()}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Atualizando…' : 'Atualizar dados'}
                  </button>
                </div>
                {signOutError && <p className="text-xs text-red-600">{signOutError}</p>}
              </div>
            </header>

            {error && (
              <div className={`${mutedPanelClass} space-y-3 text-sm`}>
                <p>{error}</p>
                <div>
                  <button className={primaryButtonClass} onClick={() => fetchAdminData()}>
                    Tentar novamente
                  </button>
                </div>
              </div>
            )}

            {actionMessage && (
              <div
                className={`rounded-3xl border px-5 py-3 text-sm shadow-sm ${
                  actionMessage.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900'
                    : 'border-red-300 bg-red-50 text-red-700'
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
