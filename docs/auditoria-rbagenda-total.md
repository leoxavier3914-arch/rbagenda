# Auditoria técnica completa – rbagenda

## 1. Visão geral da arquitetura de cliente
- **Rotas**: vivem em `src/app/(client)`; cada página sensível é `use client` e renderiza no cliente.
- **Shell visual**: componentes em `src/components/client/ClientPageLayout` fornecem `ClientPageShell` (wrapper `client-hero-wrapper` + `page`), `ClientSection` (centering + `stack`) e `ClientGlassPanel` (classe `glass`/`label`).
- **Fundo/tema**: `LavaLampProvider` (`src/components/LavaLampProvider.tsx`) lê variáveis CSS (`--dark`, `--light`, `--lava-alpha-*`, `--bg-*`, `--inner-*`, `--glass`, `--glass-stroke`, `--card-stroke`) e redesenha blobs; `useLavaLamp.refreshPalette` força reseed. `globals.css` mantém classes globais esperadas.
- **Páginas sensíveis**: `/procedimento`, `/agendamentos`, `/meu-perfil` compartilham hero animado, grid `page`/`stack`, cartões de vidro e tipografia.

## 2. Comportamento detalhado das páginas sensíveis
### 2.1 `/procedimento`
- **Objetivo**: conduzir escolha de serviço/técnica, seleção de data/horário, criação de agendamento e início de pagamento de sinal (Stripe).
- **Arquivos**: `page.tsx` centraliza estado; CSS em `procedimento.module.css`; subcomponentes em `@components` (`TypeSelectionSection`, `TechniqueSelectionSection`, `DateSelectionSection`, `TimeSelectionSection`, `SummaryBar`, `SummaryModal`, `PayLaterNotice`, `AdminCustomizationPanel`, `ProcedimentoWrapper`, `ProcedimentoCard/Grid/Header`). Tipos em `types.ts` (`ServiceTechnique`, `TechniqueCatalogEntry`, `ServiceOption`, `SummarySnapshot`).
- **Fluxo de dados/estado**:
  - Carrega sessão Supabase; redireciona para `/login` se ausente.
  - Busca catálogo em `service_types` com `service_type_assignments` e `services`; normaliza números (preço, duração, buffer, depósito), filtra ativos e ordena.
  - Usa `useClientAvailability` com `subscribe: true`, canal `procedimento-appointments`, `fallbackBufferMinutes` padrão, timezone padrão e mensagem customizada. `availabilitySnapshot` cai para `buildAvailabilityData` vazio com fallback se erro.
  - Estados: seleção de tipo/técnica/dia/slot, controle de mês (year/month), catálogo (`catalogStatus/error`), admin flag, hero readiness, mensagens e modais (summary, pay later). Slots calculados combinando `availability.daySlots`/`busyIntervals`, duração + buffer do serviço, fechamento `18:00`, eliminação de horários passados (mesmo dia) e sobreposição.
  - Cria agendamento via POST `/api/appointments` com token Supabase; guarda `appointmentId` e snapshot. Pagamento de sinal: POST `/api/payments/create` (mode deposit) e redirect para `/checkout?client_secret=...&appointment_id=...`. Botão “Pagar depois” abre aviso e direciona para `/agendamentos`.
- **Layout/UX**: wrapper `ProcedimentoWrapper` aplica hero + page; seções com cards de vidro e ícones `LashIcon`; legenda de calendário com estados (available/booked/full/mine/disabled). Barra de resumo fixa em viewport quando há seleção. Respeita `prefers-reduced-motion` e força classe `force-motion` (removível via hash `nomotion`).
- **Invariantes**: manter sequência tipo→técnica→dia→horário; preservar filtros de disponibilidade (buffer, timezone, janela de 60 dias, interseção com busy intervals); não permitir slots passados/fora do fechamento; exigir sessão antes de criar/pagar; reutilizar snapshot para evitar duplicidade; manter canal de subscribe para atualizações em tempo real.

### 2.2 `/agendamentos`
- **Objetivo**: listar agendamentos do cliente, filtrar por status, pagar sinal, cancelar e reagendar respeitando janelas de segurança.
- **Arquivos**: `page.tsx`, CSS `agendamentos.module.css`, subcomponentes `@components` (`AppointmentsHeader`, `StatusFiltersBar`, `AppointmentsList`, `ConfirmCancelModal`, `RescheduleModal`, `BlockedModal`, `SuccessModal`). Tipos em `types.ts` (status, categorias, `NormalizedAppointment`, `CalendarDayEntry`, `SlotOption`).
- **Fluxo de dados/estado**:
  - Sessão Supabase obrigatória; redireciona para `/login` se faltante.
  - Busca `appointments` do cliente com relações de serviços/tipos e totais pagos (`appointment_payment_totals`); normaliza valores (total, sinal, pago) e nomes de serviço/técnica (preferindo relacionamentos explícitos e caindo para assignments). Ordena por `starts_at` asc.
  - Mantém filtros de status (`STATUS_FILTERS`), paginação (`ITEMS_PER_PAGE=5`), mensagens e diálogos (pagamento, cancelamento, bloqueio por prazo, sucesso, edição). Determina se pode cancelar/editar com base em `CANCEL_THRESHOLD_HOURS` (env var, default 24h) e status.
  - Pagamento de sinal: POST `/api/payments/create` e redirect para `/checkout` se `client_secret`. Cancelamento: POST `/api/appointments/{id}/cancel`. Sucesso/cancelamento abrem modais informativos.
  - Reagendamento: `RescheduleModal` usa `useClientAvailability` com `serviceId` filtrado, fallback de buffer/timezone, sem subscribe. Calendário marca dias `mine/full/booked/available`; bloqueia hoje/passado e fora do limite de cancelamento. Carrega slots via `/api/slots?service_id=...&date=...`; converte para rótulos e marca desabilitados se `hoursUntil` < limite. POST `/api/appointments/{id}/reschedule` salva.
- **Layout/UX**: shell padrão (PageShell + Section), rodapé `ROMEIKE BEAUTY`. Lista mostra status com labels, valores formatados, badge de sinal pago/parcial/aguardando. Modais de confirmação/bloqueio/sucesso seguem estilo vidro.
- **Invariantes**: respeitar janela mínima (`CANCEL_THRESHOLD_HOURS`) para cancelamento/reagendamento; impedir pagamento se depósito quitado ou status cancelado/completado; manter sincronização de disponibilidade do `RescheduleModal` para evitar conflitos de slots; preservar paginação e filtros existentes.

### 2.3 `/meu-perfil`
- **Objetivo**: permitir ao cliente editar perfil, senha, avatar local e paleta do tema/lava.
- **Arquivos**: `page.tsx`, CSS `meu-perfil.module.css`, subcomponentes `@components` (`ProfileHeader`, `ProfileForm`, `AvatarUploader`, `ThemePreferencesPanel`). Tipos em `types.ts` (`Profile`, `ThemeState`, `defaultTheme`).
- **Fluxo de dados/estado**:
  - Carrega sessão Supabase e perfil (`profiles` com `full_name`, `whatsapp`, `email`, `birth_date`, `role`); redireciona para `/login` se ausente. Armazena campos de formulário, estados de salvar/sair, erros e sucesso.
  - Avatar: lido/salvo em `localStorage` (`rb_meu_perfil_avatar`); refs controlam área de avatar e ações.
  - Tema: sincroniza CSS vars atuais via `getComputedStyle` (`--inner-top/bottom`, `--card-stroke`, `--bg-top/bottom`, `--glass`, `--glass-stroke`, `--dark/light`, `--lava-alpha-*`), normaliza hex/alpha, aplica via `document.documentElement.style.setProperty`, usa `refreshPalette` para redesenhar fundo. Apenas perfis admin* podem editar aparência; painel fecha se permissão faltar.
  - Usa `REVEAL_STAGE` via `useLavaRevealStage` para coordenar animações. Mantém `force-motion` no root durante a página.
- **Layout/UX**: shell padrão com painéis de vidro (`ClientGlassPanel`); header com ações de sign-out, formulário de perfil, uploader e painel de cores com sliders/inputs hex. Valida HEX e alpha antes de aplicar; normaliza `rgbaFromHexAlpha`.
- **Invariantes**: preferências de tema persistem via CSS vars; `refreshPalette` deve ser chamado após mudanças relevantes; avatar permanece apenas local; admins controlam tema; validações de cor/alpha devem permanecer para evitar valores inválidos.

## 3. Hooks e helpers compartilhados
### 3.1 `useClientAvailability` (`src/hooks/useClientAvailability.ts`)
- **Interface**: opções `serviceId?`, `enabled` (default true), `subscribe` (default false), `channel` (canal Supabase opcional), `fallbackBufferMinutes` (default `DEFAULT_FALLBACK_BUFFER_MINUTES`), `timezone` (default `DEFAULT_TIMEZONE`), `errorMessage`, `initialLoading` (default true). Retorna `{ availability, isLoadingAvailability, availabilityError, reloadAvailability }`.
- **Lógica**: busca sessão; se ausente redireciona `/login`. Consulta `appointments` futuros (0–60 dias) com status relevantes (`pending/reserved/confirmed`), opcionalmente filtrando por `serviceId`; inclui `services(buffer_min)` para buffers. Normaliza com `buildAvailabilityData` (mapas de dias disponíveis, parcialmente ocupados, slots, busy intervals) considerando buffer e timezone. Pode subscrever mudanças em `appointments` via Realtime (se `subscribe`), recarregando snapshot quando registros relevantes forem alterados.
- **Pontos sensíveis**: falhas Supabase limpam snapshot e setam `availabilityError`. Timezone/buffer vêm de defaults; ajustes impactam simultaneamente `/procedimento` e `RescheduleModal` em `/agendamentos`. Assumem janela de 60 dias e status relevantes fixos.
- **Riscos de alteração**: mudar filtros de status, janela ou buffer altera disponibilidade das duas páginas; remover redirecionamento de login pode exibir erros silenciosos; alterar estrutura do snapshot quebra cálculos locais de slots/calendários.

### 3.2 Tema e shell
- `LavaLampProvider` depende de variáveis globais; `refreshPalette` é usado em `/procedimento` (painel admin) e `/meu-perfil` (preferências). Mudanças nos nomes de vars quebram renderização do fundo.
- `ClientPageLayout` fornece estrutura e classes esperadas por CSS modules das páginas; alterações podem desalinhá-las simultaneamente.

## 4. Tema, layout e experiência visual
- Tema global baseado em variáveis CSS; `/meu-perfil` permite editar diretamente e sincronizar com animação lava. `/procedimento` e `/agendamentos` consomem passivamente essas variáveis para seus cards de vidro e hero.
- Dependência forte de `glass`/`label`/`page`/`stack` para manter estilo consistente; alterações globais afetam todas as rotas sensíveis.
- `LavaLampProvider` lê `--dark`/`--light` para gerar gradientes; alteração dessas vars sem atualizar preferências pode resultar em contraste quebrado.

## 5. Riscos, pontos fracos e oportunidades
- Alterar `useClientAvailability` sem testes pode introduzir slots incorretos em `/procedimento` e reagendamentos; falta suite de integração.
- Ausência de persistência de avatar server-side; risco de perda ao trocar de dispositivo.
- Lógica de pagamento distribuída nos handlers das páginas; poderia ser extraída para helper/hook com tratamento de erros e loading unificado.
- Tema depende de manipulação manual de CSS vars; sem validação adicional, entradas inválidas podem quebrar visual. Poderia haver esquema/preview isolado.
- Forte dependência de classes globais; sugerido encapsular mais estilos em módulos ou storybook para validar regressões.

## 6. Atualizações recentes
- Disponibilidade centralizada em `useClientAvailability` com subscribe opcional e fallback de buffer/timezone.
- `/procedimento` modularizado em subcomponentes locais preservando fluxo e integração com Supabase/Stripe.
- `/agendamentos` reorganizado em subcomponentes; reagendamento consolidado em `RescheduleModal` com hook compartilhado e API de slots.
- `/meu-perfil` estruturado em subcomponentes; tema/cores expostos no painel e sincronizados com lava; avatar segue em `localStorage`.

## Cheat sheet
- Shell: `ClientPageShell` + `ClientSection` + `ClientGlassPanel`; fundo lava via `LavaLampProvider` e CSS vars.
- Disponibilidade: `useClientAvailability` (60 dias, status pending/reserved/confirmed, buffer por serviço, timezone padrão, subscribe opcional).
- `/procedimento`: sequência tipo→técnica→dia→horário; cria agendamento (`/api/appointments`) e inicia Stripe deposit (`/api/payments/create`).
- `/agendamentos`: filtros por status, paginação, pagar/cancelar/reagendar; `RescheduleModal` usa hook + `/api/slots`; respeita `CANCEL_THRESHOLD_HOURS`.
- `/meu-perfil`: edita perfil Supabase, avatar local, tema via CSS vars + `refreshPalette` (admins para aparência); mantém `force-motion`.
- Riscos: mudanças em CSS vars/tema ou hook de disponibilidade impactam todas as rotas sensíveis; pagamentos dependem de endpoints locais sem camada de abstração.
