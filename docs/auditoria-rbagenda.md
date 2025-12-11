# Auditoria rbagenda

## 1. Visão geral da arquitetura de cliente
- Rotas de cliente vivem em `src/app/(client)` com páginas client-side. Layout padrão fornecido por `ClientPageLayout` (`ClientPageShell`, `ClientSection`, `ClientGlassPanel`) e `ClientFullScreenLayout` no layout de `(client)`. `checkout` é exceção: recebe só `LavaLampProvider`.
- Fundo animado controlado por `LavaLampProvider` e variáveis CSS globais (`--bg-*`, `--inner-*`, `--glass`, `--glass-stroke`, `--card-stroke`, `--dark`, `--light`, `--lava-alpha-*`); `refreshPalette` redesenha blobs. Classes globais (`client-hero-wrapper`, `page`, `stack`, `glass`, `label`) estão em `globals.css` e agora definem padding vertical mais enxuto (topo 64px + safe-area, base 26px) com gaps menores.
- Páginas sensíveis: `/procedimento`, `/agendamentos`, `/meu-perfil` compartilham hero, vidro e tipografia; `/login` e `/regras` têm observações específicas abaixo.

## 2. Comportamento das páginas sensíveis
### 2.1 `/procedimento` (`src/app/(client)/procedimento/page.tsx`)
- **Objetivo**: fluxo completo de agendamento (tipo → técnica → dia → horário → criação de appointment + início do pagamento de sinal via Stripe).
- **Arquivos e componentes**: rota `page.tsx`; CSS `procedimento.module.css`; subcomponentes em `@components` (`TypeSelectionSection`, `TechniqueSelectionSection`, `DateSelectionSection`, `TimeSelectionSection`, `SummaryBar`, `SummaryModal`, `PayLaterNotice`, `AdminCustomizationPanel`, `ProcedimentoWrapper`, `ProcedimentoCard/Grid/Header`); tipos em `types.ts`.
- **Fluxo de dados/estado**: carrega sessão Supabase e catálogo (`service_types` + assignments + `services`), normaliza preços/duração/buffer. Usa `useClientAvailability` com `subscribe: true`, canal `procedimento-appointments`, buffer/timezone padrão e fallback por `buildAvailabilityData` se erro. Estados: seleção de tipo/técnica/dia/slot, controle de mês, flags de admin/hero, catálogo e modais (summary, pay later). Cria appointment via `/api/appointments` com token; inicia depósito via `/api/payments/create` e redireciona para `/checkout`; “Pagar depois” leva a `/agendamentos`.
- **Layout e UX**: `ProcedimentoWrapper` agora usa `ClientPageShell` + `ClientSection` mantendo a transição `heroReady`; seções em vidro com ícones `LashIcon`; legenda de calendário (available/booked/full/mine/disabled); barra de resumo fixa. Respeita `prefers-reduced-motion` e força `force-motion` salvo se removido manualmente.
- **Organização**: modularizado em seções e tipos; lógica de disponibilidade isolada no hook; cálculo de slots local usando snapshot. Mantém padrão de outras páginas (shell + glass + lava).
- **Pontos fortes/fracos**: forte clareza do fluxo e reuso de hook; risco em ajustes do buffer/timezone/assinatura de `useClientAvailability` e na criação/pagamento distribuída. Falta testes e centralização de erros.
- **Recomendações**: extrair camada de serviço para pagamentos; validar slots no servidor; adicionar testes de integração para a cadeia tipo→técnica→slot; considerar reutilizar components de resumo em outros fluxos.

### 2.2 `/agendamentos` (`src/app/(client)/agendamentos/page.tsx`)
- **Objetivo**: listar agendamentos, filtrar por status, pagar sinal, cancelar e reagendar respeitando janela de segurança.
- **Arquivos e componentes**: rota `page.tsx`; CSS `agendamentos.module.css`; componentes `AppointmentsHeader`, `StatusFiltersBar`, `AppointmentsList`, `ConfirmCancelModal`, `RescheduleModal`, `BlockedModal`, `SuccessModal`; tipos em `types.ts`.
- **Fluxo de dados/estado**: requer sessão (redirect para `/login` se ausente). Busca `appointments` + `services`/`service_types` + `appointment_payment_totals`; normaliza valores e nomes. Estados de filtro/paginação (ITEMS_PER_PAGE=5), modais de pagamento/cancelamento/bloqueio/sucesso/edição e mensagens. `RescheduleModal` usa `useClientAvailability` (sem subscribe, filtrado por serviço, buffer/timezone padrão, fallback), busca slots via `/api/slots`, bloqueia hoje/passado e horários fora de `CANCEL_THRESHOLD_HOURS` (env ou 24h). Pagamento via `/api/payments/create` → `/checkout`; cancelamento via `/api/appointments/{id}/cancel`; reagendamento via `/api/appointments/{id}/reschedule`.
- **Layout e UX**: shell padrão com painel de vidro e rodapé; lista mostra status, valores (total/sinal/pago) e badges de depósito; modais seguem vidro. Calendário do modal marca `mine/full/booked/available`.
- **Organização**: fluxo dividido em componentes; lógica de disponibilidade encapsulada no hook. Mantém padrão estrutural do shell e redirecionamento de sessão agora feito via `router.replace` (evita reload).
- **Pontos fortes/fracos**: boa separação de UI vs. dados; risco em consistência de disponibilidade/buffer; pagamentos e cancelamentos distribuídos sem camada de serviço nem testes; lógica de janela de cancelamento replicada.
- **Recomendações**: unificar tratamento de erros e loading de pagamentos; validar cancelamento/reagendamento também no backend; adicionar testes de paginação e filtros; compartilhar componentes de badge/valor entre lista e modais.

### 2.3 `/meu-perfil` (`src/app/(client)/meu-perfil/page.tsx`)
- **Objetivo**: editar dados pessoais, senha, avatar local e preferências de tema/lava.
- **Arquivos e componentes**: rota `page.tsx`; CSS `meu-perfil.module.css`; `ProfileHeader`, `ProfileForm`, `AvatarUploader`, `ThemePreferencesPanel`; tipos em `types.ts` (`Profile`, `ThemeState`, `defaultTheme`).
- **Fluxo de dados/estado**: obtém sessão e perfil em `profiles`; guarda campos e estados de salvar/sair. Avatar em `localStorage` (`rb_meu_perfil_avatar`). Painel de tema lê vars CSS (`--inner-*`, `--bg-*`, `--glass`, `--glass-stroke`, `--card-stroke`, `--dark`, `--light`, `--lava-alpha-*`), valida/normaliza, aplica via `setProperty` e chama `refreshPalette`; painel só aparece para perfis admin*. Usa `REVEAL_STAGE` para transições e mantém `force-motion`.
- **Layout e UX**: shell padrão com painéis de vidro; header com ações de sign-out; formulário e painel de cor em cartões separados.
- **Organização**: lógica de tema isolada no painel; tipos compartilhados; UI modular. Avatar permanece acoplado ao storage local.
- **Pontos fortes/fracos**: controles de cor completos e alinhados ao lava; risco de valores inválidos quebrando contraste; falta persistência remota do avatar e testes de validação de cor.
- **Recomendações**: validar cores com schema; salvar avatar no servidor; mover lógica de tema para hook compartilhado; cobrir fluxo de salvar perfil com testes e estados de erro.

### 2.4 `/login` (`src/app/(auth)/login/page.tsx`)
- **Objetivo**: autenticar usuário e redirecionar para `/meu-perfil`.
- **Arquivos e componentes**: rota `page.tsx`; CSS `login.module.css`; usa `ClientPageShell`, `ClientSection`, `ClientGlassPanel` e `LavaLampProvider`.
- **Fluxo de dados/estado**: `supabase.auth.getSession` roda no mount para evitar flicker; se houver sessão, redireciona. `onAuthStateChange` mantém sync. Estados: email, password, msg, `loading`, `checkingSession`, `heroReady`. `heroReady` é ativado no mount para liberar animações; enquanto `checkingSession` é true, o formulário permanece visível com aviso (evita “sumir” atrás de skeleton). Submit usa `signInWithPassword`; em sucesso chama `redirectByRole` (perfil) e trata ausência de sessão com aviso.
- **Layout e UX**: cartão “liquid glass” com logo em pílula, inputs com ícones, botão degradê e links de suporte/signup. Usa shell completo com lava; card centralizado.
- **Organização**: estado todo na página; lógica de sessão encapsulada em hooks Supabase; layout segue padrão de vidro.
- **Pontos fortes/fracos**: fluxo de sessão agora estável (formulário permanece visível); ainda falta feedback granular de erros Supabase e testes de autenticação.
- **Recomendações**: adicionar tratamento de erros por código; validar form antes de submit; mover redirecionamento por role para helper compartilhado.

### 2.5 `/regras` (`src/app/(client)/regras/page.tsx`)
- **Objetivo**: exibir regras públicas da agenda para usuários autenticados.
- **Arquivos e componentes**: rota `page.tsx`; CSS `rules.module.css`; subcomponentes locais em `@components` (`RulesHeader`, `RulesSectionList`, `RulesSectionCard`, `RulesSectionDivider`); tipos em `types.ts`.
- **Fluxo de dados/estado**: checa sessão Supabase no mount (`getSession`); se ausente ou erro, redireciona para `/login`. `heroReady` ativa animações do shell.
- **Layout e UX**: usa `ClientPageShell` + `ClientSection`, mas **não** usa `ClientGlassPanel`; conteúdo permanece direto no fundo com lava. Ornamento (flourish + diamond) e divisórias brancas entre cards foram preservados. Containers agora esticam para a largura disponível (limites de 720/960px) para evitar shrink-to-fit com `overflow` escondendo linhas em telas estreitas, garantindo quebra natural de texto; reforço de `word-break` evita truncamento em telas menores. O topo e o rodapé usam apenas o padding padrão do shell (64px/26px) sem min-height extra, evitando blocos de fundo vazio.
- **Organização**: modularizada em header, lista e cartões; array de regras tipado para facilitar manutenção sem alterar conteúdo.
- **Pontos fortes/fracos**: clareza visual mantida e alinhamento com padrão de autenticação. Risco baixo; depende apenas do Supabase para sessão.
- **Recomendações**: monitorar responsividade para garantir que textos longos continuem sem truncamento; manter ornamento e ausência de glass em futuros ajustes.

### 2.6 `/suporte` (`src/app/(client)/suporte/page.tsx`)
- **Objetivo**: centralizar canais de atendimento (em construção).
- **Arquivos e componentes**: rota `page.tsx`; CSS `suporte.module.css`; subcomponentes locais `SupportHeader`, `SupportChannelsList`, `SupportContent`; tipos em `types.ts`.
- **Fluxo de dados/estado**: checa sessão Supabase no mount via `getSession` e `router.replace('/login')` em ausência/erro; `heroReady` ativa animações do shell.
- **Layout e UX**: utiliza `ClientPageShell` + `ClientSection` + `ClientGlassPanel`; lista de canais em vidro com texto quebrando naturalmente em telas estreitas. A seção não sobrescreve padding/min-height e herda o espaçamento padrão do shell para manter o hero alinhado às demais rotas.
- **Organização**: canais definidos em array tipado, separados em header + lista reutilizável.
- **Recomendações**: preencher dados reais e acoplar ações (deep-links para WhatsApp/e-mail) quando disponíveis.

## 3. Hooks e helpers compartilhados
- `useClientAvailability` (`src/hooks/useClientAvailability.ts`): recebe `serviceId`, `enabled`, `subscribe`, `channel`, `fallbackBufferMinutes`, `timezone`, mensagem de erro e `initialLoading`. Retorna snapshot de disponibilidade (dias, slots, busy intervals), loading, erro e `reloadAvailability`. Redireciona para `/login` sem sessão, busca `appointments` (status `pending/reserved/confirmed`) de 0–60 dias e inclui buffers por serviço; pode assinar Realtime para recarregar.
- Tema/Lava: `useLavaLamp.refreshPalette` usado no painel admin de `/procedimento` e no painel de tema do `/meu-perfil`; `useLavaRevealStage` coordena transições (`heroReady`). Dependem de CSS vars globais.
- Layout: `ClientPageLayout` mantém grid `page`/`stack`, vidro e labels; `ClientFullScreenLayout` injeta header/rodapé; `/regras` é exceção sem painel de vidro. `ClientSection` agora é referência de espaçamento vertical com padding mais curto (64px no topo, 32px na base + safe-area) e sem min-height forçada; páginas que tinham padding próprio (ex.: `/regras`, `/suporte`) herdaram o padrão para alinhar o hero e reduzir fundo vazio.

## 4. Riscos, pontos fracos e oportunidades
- `useClientAvailability` é ponto crítico para `/procedimento` e reagendamento; mudar status/buffer/timezone ou remover redirecionamento pode quebrar slots ou segurança de janela.
- Tema depende de variáveis globais; valores inválidos afetam lava e contraste das páginas sensíveis.
- Fluxo de pagamento (Stripe) é chamado diretamente dos componentes; falta camada de serviço e testes de erro.
- Avatar somente local; risco de perda em novos dispositivos.
- Shell e classes globais são dependências fortes; alterações em `globals.css` impactam todas as páginas.

## 5. Atualizações recentes
- Shell e spacing: padding vertical do shell reduzido (64px topo, 32px base + safe-area) e gaps menores na `.page`; `ClientSection` perdeu min-height forçada para evitar blocos de lava vazios em telas curtas.
- `/procedimento`: wrapper agora usa `ClientPageShell` + `ClientSection` mantendo hero, sem alterar fluxo ou glass existente, e removeu min-heights/padding duplicados do módulo local.
- `/agendamentos`: redirecionamentos de sessão via `router.replace` (sem reload) mantendo modais/lista; wrapper local sem min-height extra.
- `/meu-perfil`: extratos anteriores mantidos, agora sem min-height custom no wrapper para seguir o shell enxuto.
- `/login`: shell de cliente aplicado; `heroReady` ativado no mount e `checkingSession` mostra aviso em vez de esconder o form, evitando flicker.
- `/regras`: reforço de quebra de linha para evitar truncamento mantendo ornamentos/divisórias. Padding próprio removido e espaçamento final reduzido para alinhar início do hero ao padrão do shell.
- `/suporte`: agora protegido por sessão, usa shell completo (lava + glass), canais modularizados em header/lista com tipos locais e sem padding custom na section (usa apenas o `ClientSection`).

## Cheat sheet (para PRs futuras)
- Shell padrão: `ClientPageShell`/`ClientSection` + vidro (`ClientGlassPanel`); `ClientSection` define padding top 64px, bottom 32px (mais safe-area) sem min-height forçada. Exceção `checkout` sem shell.
- `/procedimento`: sequência tipo → técnica → dia → horário; usa `useClientAvailability` com subscribe e filtros de buffer/duração; pagamento inicia via `/api/payments/create`.
- `/agendamentos`: filtros + paginação; pagar/cancelar/reagendar; `RescheduleModal` usa `useClientAvailability` (60 dias, buffer padrão) e `/api/slots`; respeita `CANCEL_THRESHOLD_HOURS`.
- `/meu-perfil`: edita perfil Supabase, avatar em `localStorage`, tema via CSS vars + `refreshPalette`; apenas admins alteram aparência.
- `/login`: lava + shell completo; formulário permanece visível enquanto verifica sessão; redirect para `/meu-perfil` em sucesso.
- `/regras`: conteúdo direto no fundo sem glass; divisórias brancas e ornamento central devem permanecer.
- Riscos-chave: alterações em CSS vars/tema ou `useClientAvailability` impactam as rotas sensíveis; fluxos de pagamento e avatar seguem sem testes nem persistência server-side.
