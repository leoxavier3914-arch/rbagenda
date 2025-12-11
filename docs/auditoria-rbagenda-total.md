# Auditoria técnica completa – rbagenda

## 1. Visão geral da arquitetura
- **Árvore de rotas**: vive em `src/app`.
  - **(client)**: `procedimento`, `agendamentos`, `meu-perfil`, `suporte`, `regras`, `indice`, `configuracoes`, `checkout` (sem shell) e assets compartilhados. Cada rota é `use client` para preservar animações e estados.
  - **(auth)**: `login` e `signup`, ambos com `LavaLampProvider` dedicado.
  - **(admin)**: `/admin` isolado em `(admin)/admin` com estilo próprio.
  - **Raiz**: `page.tsx` (landing estática), `success/page.tsx` (retorno de pagamento), APIs internas em `src/app/api` (`appointments`, `slots`).
- **Shell de cliente**: `src/components/client/ClientPageLayout` expõe `ClientPageShell` (hero wrapper + `client-hero-ready`), `ClientSection` (centro + grid `page`/`stack`) e `ClientGlassPanel` (aplica classe `glass`/`label`). Usado em todas as rotas sensíveis; `ClientFullScreenLayout` injeta header/rodapé e é acionado pelo layout de `(client)`. `checkout` é exceção e recebe apenas `LavaLampProvider` pleno.
- **Fundo animado**: `LavaLampProvider` (`src/components/LavaLampProvider.tsx`) lê variáveis CSS (`--dark`, `--light`, `--lava-alpha-*`, `--bg-*`, `--inner-*`, `--glass`, `--glass-stroke`, `--card-stroke`) e gera blobs; `refreshPalette` força reseed. Mantém respeito a `prefers-reduced-motion` e usa classe `force-motion` quando necessária.
- **Hooks globais**: `useClientAvailability` centraliza disponibilidade; hooks de tema/lava (`useLavaLamp`, `useLavaRevealStage`) coordenam animações e mudanças de paleta. `globals.css` ancora classes estruturais (`client-hero-wrapper`, `page`, `glass`, `label`) e tokens de cor.

## 2. Fluxos principais de negócio
### 2.1 Agendamento de procedimento
- **Origem dos dados**: Supabase `service_types` + `service_type_assignments` + `services` compõem catálogo; horários ocupados vêm de `appointments` (status `pending/reserved/confirmed`, janela 0–60 dias) com `services.buffer_min` para cálculos de folga.
- **Fluxo**: cliente escolhe tipo → técnica → dia → horário usando snapshot de `useClientAvailability` com `subscribe: true` (canal `procedimento-appointments`). Slots consideram duração + buffer, fechamento `18:00`, timezone padrão e filtragem de passados. Confirmado o slot, cria `appointment` via POST `/api/appointments` com token Supabase, guarda `appointmentId` + snapshot e abre modal de resumo.
- **Pagamento de sinal**: POST `/api/payments/create` (`mode: deposit`) retorna `client_secret`; redirect para `/checkout?client_secret=...&appointment_id=...`. Botão “Pagar depois” apenas grava agendamento e leva para `/agendamentos`.

### 2.2 Gerenciamento de agendamentos
- **Listagem**: carrega `appointments` do cliente com joins de serviço/técnica e totais (`appointment_payment_totals`), ordenados por `starts_at`. Filtros locais (`STATUS_FILTERS`) e paginação (`ITEMS_PER_PAGE=5`).
- **Pagamentos e cancelamento**: ação de pagar chama `/api/payments/create` e envia para checkout. Cancelamento envia POST `/api/appointments/{id}/cancel`, bloqueando se faltarem menos horas que `CANCEL_THRESHOLD_HOURS` (env ou padrão 24h).
- **Reagendamento**: `RescheduleModal` usa `useClientAvailability` sem subscribe, filtrando por `serviceId`. Calendário marca `mine/full/booked/available`, bloqueia hoje/passado e datas fora da janela de cancelamento. Slots vêm de `/api/slots?service_id=...&date=...`, aplicam buffer + timezone e desabilitam se `hoursUntil` < limiar. POST `/api/appointments/{id}/reschedule` salva.
- **Status/erros**: mantém modais de bloqueio, sucesso e mensagens para falhas; impede pagamento em `cancelled/completed` ou quando depósito já quitado.

### 2.3 Perfil do cliente
- **Dados**: perfis lidos de `profiles` (nome, email, whatsapp, nascimento, role). Sessão obrigatória; ausência redireciona `/login`.
- **Avatar**: somente local (`localStorage` chave `rb_meu_perfil_avatar`), sem persistência remota.
- **Tema/cores**: lê CSS vars correntes via `getComputedStyle`, normaliza (`--inner-*`, `--bg-*`, `--glass`, `--glass-stroke`, `--card-stroke`, `--dark`, `--light`, `--lava-alpha-*`), aplica via `style.setProperty` e chama `refreshPalette`. Painel de aparência só aparece para perfis admin*.
- **Shell**: usa `ClientPageShell` + `ClientSection` + painéis `ClientGlassPanel`; mantém `force-motion` para preservar animações.

### 2.4 Autenticação
- **Login**: `supabase.auth.getSession` inicial verifica sessão; `onAuthStateChange` mantém sync. `signInWithPassword` faz login e `router.replace('/meu-perfil')` no sucesso. Enquanto `checkingSession` é true, mostra aviso em vez de esconder o formulário; `heroReady` é ligado logo no mount para evitar atraso visual. Redireciona logados para perfil.
- **Checagem de sessão**: páginas sensíveis chamam `supabase.auth.getSession`; se não houver usuário, redirecionam para `/login`. APIs utilizam token da sessão para autorizar.
- **Signup**: rota `/(auth)/signup` segue fluxo padrão Supabase (registro simples).

## 3. Hooks, helpers e serviços
- **`useClientAvailability`** (`src/hooks/useClientAvailability.ts`): opções `serviceId`, `enabled` (default true), `subscribe` (default false), `channel`, `fallbackBufferMinutes` (default), `timezone` (default), `errorMessage`, `initialLoading` (default true). Retorna `{ availability, isLoadingAvailability, availabilityError, reloadAvailability }`. Faz `getSession` e redireciona para `/login` se vazio. Consulta `appointments` 0–60 dias com status relevantes, inclui `services(buffer_min)` e normaliza via `buildAvailabilityData` (dias, slots, busy intervals). Se `subscribe`, abre canal Realtime e recarrega quando registros relevantes mudam. Falhas zeram snapshot e exibem `availabilityError` custom.
- **Tema/lava**: `useLavaLamp` fornece `refreshPalette`; `useLavaRevealStage` coordena transições (ex.: `heroReady`). Dependem de nomes de variáveis globais e de `globals.css` para classes `glass`/`label`.
- **Helpers de API**: rotas locais `/api/appointments`, `/api/slots`, `/api/payments/create` recebem tokens Supabase e encapsulam acesso a Supabase/Stripe; páginas chamam via `fetch`/POST diretamente.

## 4. Tema, layout e sistema de “glass”
- **Glass**: classe global `.glass` + `.label` em `globals.css`; `ClientGlassPanel` envolve seções principais das páginas. CSS Modules (ex.: `procedimento.module.css`, `agendamentos.module.css`, `meu-perfil.module.css`, `login.module.css`) aplicam ajustes locais sem quebrar o vidro.
- **Fundo**: variáveis CSS controlam gradientes de fundo (`--bg-*`), inner glow (`--inner-*`), bordas (`--glass-stroke`, `--card-stroke`) e opacidades do lava (`--lava-alpha-*`). `LavaLampProvider` redesenha ao iniciar e quando `refreshPalette` é chamado (painel admin de procedimento, painel de tema do perfil).
- **Shell**: `ClientPageShell` coordena hero animado (`client-hero-wrapper`) e aplica classe `client-hero-ready` após ready; `ClientSection` organiza largura e espaçamento; `ClientFullScreenLayout` adiciona header/rodapé padrão. `/regras` usa shell mas propositalmente não usa `ClientGlassPanel`, exibindo conteúdo direto no fundo.

## 5. Riscos, pontos fracos e oportunidades
- **Disponibilidade**: alterações em `useClientAvailability` (status filtrados, janela de 60 dias, buffers ou timezone) impactam simultaneamente `/procedimento` e reagendamento em `/agendamentos`; ausência de testes automatizados amplia risco.
- **Pagamentos**: fluxos de depósito são chamados diretamente nas páginas; falta camada dedicada e testes de erro, podendo afetar criação/redirect do checkout.
- **Tema/lava**: dependência forte de variáveis CSS e `refreshPalette`; valores inválidos quebram contraste ou animações. Painéis deveriam ter validação adicional e preview isolado.
- **Persistência de avatar**: somente localStorage; trocar de dispositivo ou limpar cache apaga avatar.
- **Acessibilidade/UX**: modais e listas dependem de estados manuais; faltam testes de teclado/leitura de tela. Layouts baseados em classes globais podem regredir caso `globals.css` mude.

## 6. Atualizações recentes
- Modularização de `/procedimento`, `/agendamentos` e `/meu-perfil` em subcomponentes locais, mantendo integração com Supabase/Stripe e reuse do shell.
- Criação/uso do `ClientPageLayout` em todo o eixo de cliente, com `ClientFullScreenLayout` orquestrando header/rodapé.
- `useClientAvailability` centralizado com subscribe opcional, filtros de buffer/timezone e fallback robusto.
- `LavaLampProvider` e painel de tema refinados; `/meu-perfil` passa a aplicar `refreshPalette` após ajustes de cor.
- Página de login recebeu shell completo, cartão de vidro consistente, verificação de sessão antes do formulário e `heroReady` ativado no mount para evitar “sumir” do formulário.
- `/suporte` e `/regras` alinhadas ao shell; `/regras` mantém conteúdo direto no fundo com ornamentos/divisórias preservados.
- `/regras` modularizada em subcomponentes locais, tipagem dedicada e alinhamento de autenticação; ajustes de CSS evitam texto
  cortado sem alterar o visual.

## Cheat sheet
- **Shell**: `ClientPageShell` + `ClientSection` + `ClientGlassPanel`; fundo lava via `LavaLampProvider` e CSS vars. Exceção: `checkout` apenas com provider.
- **Disponibilidade**: `useClientAvailability` (status pending/reserved/confirmed, 60 dias, buffer por serviço, timezone default, subscribe opcional). Usado em `/procedimento` (com subscribe) e `RescheduleModal` em `/agendamentos` (sem subscribe).
- **Fluxos**: `/procedimento` cria appointment e inicia depósito Stripe; `/agendamentos` lista/filtro/paga/cancela/reagenda com `CANCEL_THRESHOLD_HOURS`; `/meu-perfil` edita perfil, avatar local e tema com `refreshPalette`.
- **Tema**: vars globais controlam glass/gradientes; painel de tema (admins) e painel admin do procedimento podem alterá-las.
- **Riscos**: mudanças em CSS vars/tema ou `useClientAvailability` impactam rotas sensíveis; fluxos de pagamento não têm camada de serviço nem testes; avatar permanece local apenas.
