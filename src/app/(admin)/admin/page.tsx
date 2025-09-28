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
    <section className="space-y-8">
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1f2d28]">Cadastrar nova filial</h2>
          <p className="muted-text">Gerencie a expansão do seu negócio adicionando novas unidades.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateBranch}>
          <label className="grid gap-2 text-sm">
            <span>Nome</span>
            <input
              className="input"
              value={newBranch.name}
              onChange={(event) => setNewBranch((state) => ({ ...state, name: event.target.value }))}
              placeholder="Ex: Unidade Centro"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Fuso horário</span>
            <select
              className="input"
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
            <button className="btn-primary w-full" type="submit">
              Adicionar filial
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[#1f2d28]">Filiais cadastradas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {branches.map((branch) => {
            const form = branchEdits[branch.id] ?? {
              name: branch.name,
              timezone: branch.timezone,
            }
            return (
              <div key={branch.id} className="card space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#1f2d28]">{branch.name}</h3>
                  <p className="muted-text text-xs">Criada em {new Date(branch.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-2 text-sm text-[#1f2d28]">
                  <div>
                    <span className="font-medium">Fuso horário:</span> {branch.timezone}
                  </div>
                  <div>
                    <span className="font-medium">ID:</span> {branch.id}
                  </div>
                </div>
                <div className="space-y-3 border-t border-[color:rgba(31,45,40,0.08)] pt-4">
                  <h4 className="text-sm font-medium text-[#1f2d28]">Editar filial</h4>
                  <div className="grid gap-3">
                    <label className="grid gap-2 text-sm">
                      <span>Nome</span>
                      <input
                        className="input"
                        value={form.name}
                        onChange={(event) =>
                          setBranchEdits((state) => ({
                            ...state,
                            [branch.id]: { ...form, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span>Fuso horário</span>
                      <select
                        className="input"
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
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="btn-primary flex-1"
                        type="button"
                        onClick={() => handleUpdateBranch(branch.id)}
                      >
                        Salvar alterações
                      </button>
                      <button
                        className="btn-secondary flex-1 border-red-200 text-red-600"
                        type="button"
                        onClick={() => handleDeleteBranch(branch.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {branches.length === 0 && (
            <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.8)]">
              Nenhuma filial cadastrada até o momento.
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const renderServiceTypesSection = () => (
    <section className="space-y-8">
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1f2d28]">Cadastrar tipo de serviço</h2>
          <p className="muted-text">
            Organize seus serviços por categorias para facilitar a navegação e o agendamento.
          </p>
        </div>
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleCreateServiceType}>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span>Nome</span>
            <input
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Filial</span>
            <select
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Status</span>
            <select
              className="input"
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
          <label className="grid gap-2 text-sm md:col-span-4">
            <span>Descrição</span>
            <textarea
              className="input min-h-[72px]"
              value={newServiceType.description}
              onChange={(event) =>
                setNewServiceType((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              placeholder="Descreva o tipo de serviço"
            />
          </label>
          <div className="flex items-end md:col-span-4">
            <button className="btn-primary w-full" type="submit">
              Adicionar tipo
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[#1f2d28]">Tipos cadastrados</h2>
        <div className="space-y-4">
          {serviceTypes.map((type) => {
            const form =
              serviceTypeEdits[type.id] ?? ({
                name: type.name,
                branch_id: type.branch_id ?? '',
                description: type.description ?? '',
                active: type.active,
              } satisfies ServiceTypeFormState)

            return (
              <div key={type.id} className="card space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1f2d28]">{type.name}</h3>
                    <p className="muted-text text-xs">Criado em {new Date(type.created_at).toLocaleString()}</p>
                  </div>
                  <span className="badge self-start md:self-auto">
                    {type.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="space-y-3">
                  <label className="grid gap-2 text-sm">
                    <span>Nome</span>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(event) =>
                        setServiceTypeEdits((state) => ({
                          ...state,
                          [type.id]: { ...form, name: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span>Filial</span>
                    <select
                      className="input"
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
                  <label className="grid gap-2 text-sm">
                    <span>Status</span>
                    <select
                      className="input"
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
                  <label className="grid gap-2 text-sm">
                    <span>Descrição</span>
                    <textarea
                      className="input min-h-[72px]"
                      value={form.description}
                      onChange={(event) =>
                        setServiceTypeEdits((state) => ({
                          ...state,
                          [type.id]: { ...form, description: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="btn-primary flex-1"
                      type="button"
                      onClick={() => handleUpdateServiceType(type.id)}
                    >
                      Salvar alterações
                    </button>
                    <button
                      className="btn-secondary flex-1 border-red-200 text-red-600"
                      type="button"
                      onClick={() => handleDeleteServiceType(type.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {serviceTypes.length === 0 && (
            <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.8)]">
              Nenhum tipo de serviço cadastrado até o momento.
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const renderServicesSection = () => (
    <section className="space-y-8">
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1f2d28]">Cadastrar serviço</h2>
          <p className="muted-text">
            Controle seu portfólio com todos os detalhes necessários para um agendamento preciso.
          </p>
        </div>
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleCreateService}>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span>Nome</span>
            <input
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Filial</span>
            <select
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Tipo</span>
            <select
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Duração (min)</span>
            <input
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Preço (centavos)</span>
            <input
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Sinal (centavos)</span>
            <input
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Intervalo (min)</span>
            <input
              className="input"
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
          <label className="grid gap-2 text-sm">
            <span>Status</span>
            <select
              className="input"
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
          <label className="grid gap-2 text-sm md:col-span-4">
            <span>Descrição</span>
            <textarea
              className="input min-h-[72px]"
              value={newService.description}
              onChange={(event) =>
                setNewService((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              placeholder="Descreva os detalhes do serviço"
            />
          </label>
          <div className="flex items-end md:col-span-4">
            <button className="btn-primary w-full" type="submit">
              Adicionar serviço
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[#1f2d28]">Serviços cadastrados</h2>
        <div className="space-y-4">
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

            const branchName = branches.find((branch) => branch.id === service.branch_id)?.name
            const typeName = service.service_type_id
              ? serviceTypes.find((type) => type.id === service.service_type_id)?.name
              : null

            return (
              <div key={service.id} className="card space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1f2d28]">{service.name}</h3>
                    <p className="muted-text text-xs">Atualizado em {new Date(service.created_at).toLocaleString()}</p>
                  </div>
                  <span className="badge self-start md:self-auto">
                    {service.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="text-sm text-[#1f2d28]">
                    <span className="font-medium">Filial:</span> {branchName ?? 'Não vinculada'}
                  </div>
                  <div className="text-sm text-[#1f2d28]">
                    <span className="font-medium">Tipo:</span> {typeName ?? 'Sem categoria'}
                  </div>
                  <div className="text-sm text-[#1f2d28]">
                    <span className="font-medium">Duração:</span> {service.duration_min} minutos
                  </div>
                  <div className="text-sm text-[#1f2d28]">
                    <span className="font-medium">Preço:</span> R$ {(service.price_cents / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-[#1f2d28]">
                    <span className="font-medium">Sinal:</span> R$ {(service.deposit_cents / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-[#1f2d28]">
                    <span className="font-medium">Intervalo:</span> {service.buffer_min} minutos
                  </div>
                </div>
                <div className="space-y-3 border-t border-[color:rgba(31,45,40,0.08)] pt-4">
                  <h4 className="text-sm font-medium text-[#1f2d28]">Editar serviço</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm">
                      <span>Nome</span>
                      <input
                        className="input"
                        value={form.name}
                        onChange={(event) =>
                          setServiceEdits((state) => ({
                            ...state,
                            [service.id]: { ...form, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span>Filial</span>
                      <select
                        className="input"
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
                    <label className="grid gap-2 text-sm">
                      <span>Tipo</span>
                      <select
                        className="input"
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
                    <label className="grid gap-2 text-sm">
                      <span>Duração (min)</span>
                      <input
                        className="input"
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
                    <label className="grid gap-2 text-sm">
                      <span>Preço (centavos)</span>
                      <input
                        className="input"
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
                    <label className="grid gap-2 text-sm">
                      <span>Sinal (centavos)</span>
                      <input
                        className="input"
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
                    <label className="grid gap-2 text-sm">
                      <span>Intervalo (min)</span>
                      <input
                        className="input"
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
                    <label className="grid gap-2 text-sm">
                      <span>Status</span>
                      <select
                        className="input"
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
                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span>Descrição</span>
                      <textarea
                        className="input min-h-[72px]"
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="btn-primary flex-1"
                      type="button"
                      onClick={() => handleUpdateService(service.id)}
                    >
                      Salvar alterações
                    </button>
                    <button
                      className="btn-secondary flex-1 border-red-200 text-red-600"
                      type="button"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {services.length === 0 && (
            <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.8)]">
              Nenhum serviço cadastrado até o momento.
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const renderAppointmentsSection = () => (
    <section className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        {groupedAppointments.map((group) => (
          <div key={group.key} className="card space-y-2">
            <span className="text-sm font-medium uppercase tracking-wide text-[#2f6d4f]">
              {group.label}
            </span>
            <p className="text-3xl font-semibold text-[#1f2d28]">{group.items.length}</p>
            <p className="muted-text text-xs">
              {group.statuses.length > 1
                ? 'Inclui agendamentos confirmados ou reservados.'
                : `Status: ${appointmentStatusLabels[group.statuses[0]]}`}
            </p>
          </div>
        ))}
      </div>

      {groupedAppointments.map((group) => (
        <div key={group.key} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#1f2d28]">{group.label}</h2>
            <span className="badge">{group.items.length} registros</span>
          </div>
          {group.items.length === 0 ? (
            <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.8)]">
              Nenhum agendamento {group.label.toLowerCase()}.
            </div>
          ) : (
            <div className="space-y-4">
              {group.items.map((appointment) => (
                <div key={appointment.id} className="card space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[#1f2d28]">
                        {appointment.services?.name ?? 'Serviço não informado'}
                      </h3>
                      <p className="muted-text text-xs">ID: {appointment.id}</p>
                    </div>
                    <span className="badge">
                      {appointmentStatusLabels[appointment.status] ?? appointment.status}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-[#1f2d28] md:grid-cols-2">
                    <div>
                      <span className="font-medium">Cliente:</span>{' '}
                      {appointment.profiles?.full_name ?? 'Sem nome informado'}
                    </div>
                    <div>
                      <span className="font-medium">E-mail:</span>{' '}
                      {appointment.profiles?.email ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium">Início:</span>{' '}
                      {new Date(appointment.starts_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Fim:</span>{' '}
                      {new Date(appointment.ends_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )

  const renderClientsSection = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#1f2d28]">Clientes cadastrados</h2>
        <span className="badge">{clients.length} clientes</span>
      </div>
      {clients.length === 0 ? (
        <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.8)]">
          Nenhum cliente cadastrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:rgba(31,45,40,0.08)] text-sm">
            <thead>
              <tr className="bg-[color:rgba(47,109,79,0.05)] text-left text-[#1f2d28]">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Desde</th>
                <th className="px-4 py-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:rgba(31,45,40,0.08)]">
              {clients.map((client) => (
                <tr key={client.id} className="text-[#1f2d28]">
                  <td className="px-4 py-3">{client.full_name ?? '—'}</td>
                  <td className="px-4 py-3">{client.email ?? '—'}</td>
                  <td className="px-4 py-3">{client.whatsapp ?? '—'}</td>
                  <td className="px-4 py-3">
                    {client.created_at ? new Date(client.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[color:rgba(31,45,40,0.7)]">{client.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  const renderPlaceholderSection = (message: string) => (
    <section className="surface-muted flex min-h-[320px] items-center justify-center text-sm text-[color:rgba(31,45,40,0.8)]">
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
    <main className="relative flex min-h-screen flex-1 flex-col bg-[color:rgba(47,109,79,0.04)] md:flex-row">
      <div className="flex items-center justify-between border-b border-[color:rgba(31,45,40,0.08)] bg-white/95 px-6 py-4 backdrop-blur md:hidden">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:rgba(31,45,40,0.6)]">Painel</p>
          <h1 className="text-2xl font-semibold text-[#1f2d28]">Administração</h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(31,45,40,0.12)] bg-white px-4 py-2 text-sm font-semibold text-[#1f2d28] shadow-sm transition hover:border-[color:rgba(47,109,79,0.3)] hover:text-[#2f6d4f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-full max-w-xs transform border-r border-[color:rgba(31,45,40,0.08)] bg-white px-6 py-6 shadow-xl transition duration-300 ease-in-out md:static md:flex md:w-72 md:translate-x-0 md:border-b-0 md:border-r md:shadow-none ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col gap-6">
          <div className="flex items-center justify-between md:block">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgba(31,45,40,0.6)]">Painel</p>
              <h1 className="text-2xl font-semibold text-[#1f2d28]">Administração</h1>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(31,45,40,0.12)] text-[#1f2d28] shadow-sm transition hover:border-[color:rgba(47,109,79,0.3)] hover:text-[#2f6d4f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:hidden"
              onClick={closeMenu}
              aria-label="Fechar menu de navegação"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-1">
            {sections.map((section) => {
              const isActive = activeSection === section.key
              return (
                <button
                  key={section.key}
                  className={`flex w-full flex-col rounded-2xl px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-[color:rgba(47,109,79,0.12)] text-[#1f2d28] shadow-sm'
                      : 'text-[color:rgba(31,45,40,0.75)] hover:bg-[color:rgba(47,109,79,0.08)]'
                  }`}
                  onClick={() => {
                    setActiveSection(section.key)
                    setActionMessage(null)
                    closeMenu()
                  }}
                >
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span className="text-xs text-[color:rgba(31,45,40,0.6)]">{section.description}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>
      <section className="flex-1 overflow-y-auto px-6 pb-16 pt-8 md:pb-16 md:pt-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr),280px]">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f2d28] via-[#2f6d4f] to-[#5dbf90] p-8 text-white shadow-xl">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-3xl md:h-40 md:w-40" aria-hidden="true" />
              <div className="flex flex-col gap-6">
                <div className="space-y-3">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                    Painel administrativo
                  </span>
                  <h2 className="text-3xl font-semibold leading-tight md:text-4xl">Bem-vindo(a) ao controle da agenda</h2>
                  <p className="text-sm text-white/80">{headerDescription}</p>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {highlightStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                      <dt className="text-xs font-medium uppercase tracking-wide text-white/70">{stat.label}</dt>
                      <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="card flex w-full flex-col gap-4 rounded-3xl border border-[color:rgba(47,109,79,0.12)] bg-white/90 p-6 text-sm shadow-md backdrop-blur">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#1f2d28]">Ações rápidas</h3>
                <p className="text-xs text-[color:rgba(31,45,40,0.6)]">Gerencie seu acesso e mantenha os dados sempre atualizados.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button className="btn-primary w-full" onClick={handleSignOut} disabled={signingOut}>
                  {signingOut ? 'Encerrando sessão…' : 'Sair do painel'}
                </button>
                <button
                  className="btn-secondary w-full"
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
            <div className="surface-muted space-y-3 rounded-3xl border border-[color:rgba(47,109,79,0.12)] bg-white/70 p-6 text-sm text-[color:rgba(31,45,40,0.85)] backdrop-blur">
              <p>{error}</p>
              <div className="flex justify-start">
                <button className="btn-primary" onClick={() => fetchAdminData()}>
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {actionMessage && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                actionMessage.type === 'success'
                  ? 'border-[color:rgba(47,109,79,0.3)] bg-[color:rgba(47,109,79,0.1)] text-[#1f2d28]'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {actionMessage.text}
            </div>
          )}

          {sectionContent}
        </div>
      </section>
    </main>
  )
}
