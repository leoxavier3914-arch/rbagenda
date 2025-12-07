# Auditoria total rbagenda – 2025-12-07

## 1. Visão geral da arquitetura
- **App Router (src/app):** organizado por grupos de rotas: `(client)` concentra a experiência do cliente (agendamentos, procedimento, perfil, checkout, etc.), `(auth)` lida com login/signup, `(admin)` traz páginas administrativas, e demais rotas de sistema (api/, success) ficam na raiz do App Router.
- **Layouts:** `RootLayout` aplica fontes/cores globais, textura fixa (`brand-texture-overlay`) e marca o `body` com a classe `client-fullscreen` para rotas do shell do cliente. O grupo `(client)` envolve as páginas em `ClientLayout`, que liga o `LavaLampProvider` e, quando aplicável, o shell `ClientFullScreenLayout` com menu e padding condicionado por rota.
- **Fundo animado:** `LavaLampProvider` injeta o canvas duplo (camadas dark/light) com paleta derivada de CSS vars (`--dark`, `--light`, `--lava-alpha-*`), respeita `prefers-reduced-motion`, expõe `refreshPalette` e sincroniza com ajustes de tema das páginas. Rotas de cliente incluem a textura/gradiente global de `globals.css` e estilos específicos de procedimento via `procedimento.css`.
- **Componentes compartilhados:** wrappers do cliente (`ClientPageShell`, `ClientSection`, `ClientPageHeader`, `ClientGlassPanel`) vivem em `src/components/client` e são usados nos fluxos principais. O menu/painel `ClientMenu` e o layout `ClientFullScreenLayout` ficam em `src/components/` e compõem o shell contínuo do app cliente.

## 2. Estrutura de pastas e responsabilidade por área
- `src/app/(client)/`: rotas de cliente (`/procedimento`, `/agendamentos`, `/meu-perfil`, `/checkout`, `/configuracoes`, `/suporte`, `/regras`, `/indice`). `ClientLayout` aplica LavaLamp e o shell fullscreen.
- `src/app/(auth)/`: páginas de autenticação (`/login`, `/signup`).
- `src/app/(admin)/`: visão administrativa (`/admin`, `/admin/adminsuper`) com estilos próprios.
- `src/app/api/`: rotas de backend (agendamentos, slots, pagamentos, webhooks Stripe, cron de lembretes e manutenção de appointments).
- `src/components/`: infraestrutura compartilhada do cliente (menu, shell fullscreen, LavaLampProvider, CheckoutPage, FlowShell, BookingFlow) e design system mínimo (`client/ClientPageLayout`, `client/LashIcon`).
- `src/lib/`: utilitários de domínio (auth, db Supabase, disponibilidade, agendamentos, pagamentos, lembretes, WhatsApp, Stripe client-side, hook `useLavaRevealStage`).
- `src/app/globals.css` e `src/app/procedimento.css`: estilos globais, resets, gradientes, variáveis de tema e ajustes específicos do fluxo de procedimento.
- `docs/`: documentação anterior (auditoria parcial e notas visuais) e o presente documento.

## 3. Layouts, fundo e providers
- **RootLayout (`src/app/layout.tsx`):** importa `globals.css` e `procedimento.css`, define metadados/manifesto PWA, calcula rota atual para aplicar `body.client-fullscreen` em rotas do shell do cliente e renderiza a `brand-texture-overlay` fixa sob todo o conteúdo.
- **ClientLayout (`src/app/(client)/layout.tsx`):** client component que ativa `LavaLampProvider` para todas as rotas do grupo, omitindo o shell de menu em `/checkout` (importante para o fluxo de pagamento embutido).
- **ClientFullScreenLayout (`src/components/ClientFullScreenLayout.tsx`):** adiciona `body.client-fullscreen`, esconde `brand-texture-overlay`, injeta `ClientMenu` e controla padding para rotas sensíveis (`/agendamentos`, `/procedimento`, `/meu-perfil`).
- **LavaLampProvider:** cria canvases de lava em camadas dark/light, usa CSS vars (`--dark`, `--light`, `--lava-alpha-min/max`) para gerar paleta dinâmica, re-semente blobs em resize e oferece `refreshPalette` para páginas que editam tema. Respeita `prefers-reduced-motion` e remove listeners no cleanup.
- **Ciclo do fundo:** `/procedimento`, `/agendamentos` e `/meu-perfil` vivem dentro do shell fullscreen com lava ativa e gradiente fixo; `/checkout` mantém LavaLamp mas sem menu; páginas auxiliares (`/configuracoes`, `/suporte`, `/regras`, `/indice`) usam o mesmo body class e textura.

## 4. Fluxos de negócio principais
- **Autenticação/sessão:** Home (`/`) verifica a sessão via `supabase.auth.getSession`, redireciona para login se ausente; resolve o `role` pela tabela `profiles` e direciona para `/procedimento` (cliente) ou `/admin/adminsuper`/painel admin. Páginas de login/signup no grupo `(auth)` são client-side simples.
- **Agendamentos (`/agendamentos`):** página client-side lista agendamentos do Supabase, normaliza status, pagina 5 itens, permite filtrar (ativos/pendentes/cancelados/concluídos), recalcula disponibilidade com `buildAvailabilityData` para reagendamento, suporta cancelamento e pagamento de sinal via Stripe (usando `stripePromise`). UI agora está segmentada em subcomponentes locais (`@components`) sobre o shell `ClientPageShell`/`ClientSection`, mantendo os mesmos cards e lógica existentes.
- **Procedimento (`/procedimento`):** fluxo multi-etapas (tipo → técnica → dia → horário → resumo). Carrega catálogo de serviços/técnicas do Supabase, gera slots com `buildAvailabilityData`/`DEFAULT_SLOT_TEMPLATE`, trata buffers (`DEFAULT_FALLBACK_BUFFER_MINUTES`), integra com Stripe (`stripePromise`) para iniciar checkout e usa `useLavaLamp` para resemear paleta ao entrar/sair. UI usa wrappers `ProcedimentoWrapper`, `ProcedimentoGrid`, `ProcedimentoCard`, header e CSS específico.
- **Meu perfil (`/meu-perfil`):** lê/escreve perfil no Supabase (nome, WhatsApp, email, aniversário), permite salvar preferências de paleta/fundo ajustando CSS vars (card, glass, background, bolhas, opacidades) e persistindo em `localStorage`; usa `useLavaLamp` e `useLavaRevealStage` para sincronizar revelação do fundo. Inclui upload de avatar (storage local) e reset de paleta.
- **Checkout (`/checkout`):** servidor resolve `searchParams` (client_secret, appointment_id) e renderiza `CheckoutPage`, que injeta Stripe Elements com tema customizado e `FlowShell`; permite finalizar pagamento ligado ao agendamento.
- **Configurações/Suporte/Regras/Índice:** páginas informativas ou de preferências locais com `card` e conteúdo estático; mantêm o shell do cliente.
- **Área admin:** `/admin` exibe painel de bookings via `BookingFlow` e exige papel admin; `/admin/adminsuper` traz visão ampliada (detalhes definidos na página), ambos fora do menu do cliente.
- **APIs:**
  - `/api/appointments`: cria agendamentos (serviço ou experiência) validando body com Zod; resolve staff disponível; grava em `appointments` com status `pending` e valores de preço/sinal.
  - `/api/slots`: expõe disponibilidade usando helpers de `availability.ts` (considera buffers e zona padrão).
  - `/api/payments/create`: gera sessões de pagamento/intent para Stripe.
  - `/api/webhooks/stripe`: recebe eventos `checkout.session.*` e `charge.refunded` para atualizar estado de pagamento/agendamento.
  - `/api/cron/appointments` e `/api/cron/reminders`: funções para manter/cancelar agendamentos e disparar lembretes (usam service role via `getSupabaseAdmin`).

## 5. Componentes compartilhados
- **ClientPageLayout (`src/components/client`):** fornece `ClientPageShell` (wrapper com classes globais e hero), `ClientSection` (stack/padding), `ClientPageHeader` (título, subtítulo, losango), `ClientGlassPanel` (cartão “glass” com label). Base para páginas do cliente.
- **ClientFullScreenLayout/ClientMenu:** shell fullscreen com menu lateral (icones de calendário, plus, perfil, admin, suporte, settings). `ClientMenu` carrega perfil do Supabase para nome/role, calcula iniciais, destaca rota ativa, permite logout e controla padding de conteúdo.
- **LavaLampProvider/useLavaLamp:** provider + hook para animar fundo e resemear paleta conforme variáveis de tema.
- **Ícones e auxiliares:** `LashIcon` centraliza o SVG de cílios usado em cards/listas; `FlowShell` (usado em checkout) padroniza caixas de fluxo com sombras/gradiente; `BookingFlow` compõe interface do painel admin.
- **Procedimento components (`src/app/(client)/procedimento/@components`):** cards, grids, header e wrappers reutilizados entre etapas e ajustados ao tema.

## 6. Estilos e CSS
- **Globais:** `src/app/globals.css` define Tailwind layers, variáveis de cor/tipografia, gradiente de fundo, classes utilitárias (`client-hero-wrapper`, `page`, `glass`, `card`, grids) e estiliza o corpo quando `client-fullscreen` está ativo. Inclui reset para seleção, links e tipografia.
- **Procedimento:** `src/app/procedimento.css` complementa com estilos otimizados para mobile (painel de paleta, sliders, calendário/slots, navegação de técnicas), controlando overlays e animações.
- **CSS Modules:** cada página sensível possui módulo próprio (ex.: `procedimento.module.css`, `agendamentos.module.css`, `meu-perfil.module.css`, `configuracoes.module.css`, etc.), encapsulando layout e evitando bleed. `ClientFullScreenLayout.module.css` esconde a textura global quando o shell está ativo.
- **Tema/lava:** variáveis `--dark`, `--light`, `--glass*`, `--inner*`, `--lava-alpha-*` são usadas pelo LavaLampProvider e pelos wrappers; `/meu-perfil` altera essas variáveis em runtime e persiste em storage/local CSS.

## 7. Integrações externas e infraestrutura
- **Supabase:** usado para auth (`supabase.auth` no cliente, `getSupabaseAdmin` server-side com service role), tabelas de `profiles`, `services`, `service_type_assignments`, `appointments`, `appointment_payment_totals`, `staff`. Cron functions (Edge/Scheduler) em `/api/cron/*` replicam lógica de manutenção/cancelamento descrita no README.
- **Stripe:** checkout client-side via `@stripe/react-stripe-js`/Elements com `stripePromise`; server-side em `/api/payments/create` cria sessões, e `/api/webhooks/stripe` sincroniza eventos (pagamento aprovado, expirado, estorno) com Supabase.
- **Outros:** lembretes/WhatsApp tratados por helpers (`whatsapp.ts`, `reminders.ts`), e cron GitHub Actions/Edge para manutenção de appointments conforme README.

## 8. Pontos fortes da arquitetura atual
- Separação clara por grupos do App Router (cliente, auth, admin) com layouts dedicados.
- Shell de cliente consistente via `ClientFullScreenLayout` + `ClientMenu` e wrappers de página, garantindo UX uniforme nas rotas sensíveis.
- Fundo animado encapsulado em provider único com paleta derivada de CSS vars, permitindo personalização controlada.
- Uso extensivo de CSS Modules para isolar estilos e manter a identidade visual.
- Utilitários de disponibilidade/pagamentos separados em `src/lib`, facilitando reuso em páginas e APIs.

## 9. Riscos e pontos fracos
- Dependência de variáveis globais para tema/lava: ajustes incorretos em `/meu-perfil` podem afetar todas as páginas do shell.
- Lógica de disponibilidade e manipulação de slots agora está centralizada no hook compartilhado `useClientAvailability`; ajustes de regra precisam considerar impacto simultâneo em `/procedimento` e `/agendamentos`.
- Páginas sensíveis são `use client` pesadas com muita lógica inline; difícil testar isoladamente e arriscado para regressões de UX.
- `ClientLayout` controla exceções de shell via lista estática de rotas (ex.: `/checkout`); novas rotas fullscreen podem exigir ajustes manuais.
- APIs dependem de acesso service role; configuração incorreta de env bloqueia boot (db.ts lança erro se variáveis faltarem).

## 10. Oportunidades de melhoria e sugestões
 - Consolidar controle de tema/lava em contexto dedicado (com validação/limites) para evitar corrupção de CSS vars e facilitar reset global.
 - Modularizar páginas grandes (`/procedimento`, `/agendamentos`, `/meu-perfil`) em subcomponentes/hook por etapa (estado, Supabase, Stripe) para melhorar testabilidade.
 - Tornar a lista de rotas que ocultam menu configurável (ex.: via prop/contexto) evitando edits manuais em `ClientLayout` e `ClientFullScreenLayout`.
 - Adicionar testes de integração para APIs críticas (payments, webhooks, cron) e para o fluxo de agendamento completo, cobrindo Stripe + Supabase.
 - Incluir testes e monitoramento do hook `useClientAvailability` para garantir buffers/filtros idênticos em páginas sensíveis.

## 11. Atualizações recentes
- Extraído hook compartilhado `useClientAvailability` (`src/hooks/useClientAvailability.ts`) para centralizar carregamento e montagem de disponibilidade com buffers e filtros aplicados; páginas `/procedimento` e `/agendamentos` passaram a usá-lo sem alterar regras de negócio ou UI.
- `/procedimento` modularizado em subcomponentes internos no grupo `@components`, mantendo layout e integrações existentes.
- `/agendamentos` reorganizado em subcomponentes locais (`@components`) sem alterar regras de negócio, filtros ou integrações de disponibilidade/pagamento.
