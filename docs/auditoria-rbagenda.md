# Auditoria rbagenda

## 1. Visão geral da arquitetura de cliente
- Rotas de cliente vivem em `src/app/(client)`, com páginas client-side e wrappers de layout comuns.
- O shell visual usa `ClientPageLayout` (`ClientPageShell`, `ClientSection`, `ClientGlassPanel`) para centralizar espaçamentos, grid `page`/`stack`, rótulos (`label`) e vidro (`glass`).
- O fundo animado é controlado por `LavaLampProvider` e variáveis CSS globais (`--bg-top`, `--bg-bottom`, `--inner-top`, `--inner-bottom`, `--glass`, etc.); o provider lê essas variáveis e redesenha blobs com `refreshPalette`.
- Páginas sensíveis: `/procedimento`, `/agendamentos` e `/meu-perfil`, todas usando o mesmo hero/fundo lava e tipografia compartilhada.

## 2. Comportamento das páginas sensíveis
### 2.1 `/procedimento`
- **Objetivo**: fluxo completo de agendamento (escolha de tipo e técnica, seleção de dia/horário, criação de agendamento e início de pagamento de sinal via Stripe).
- **Arquivos principais**: `page.tsx` orquestra o fluxo; subcomponentes em `@components` (`TypeSelectionSection`, `TechniqueSelectionSection`, `DateSelectionSection`, `TimeSelectionSection`, `SummaryBar`, `SummaryModal`, `PayLaterNotice`, `AdminCustomizationPanel`, `ProcedimentoWrapper`). Tipos em `types.ts` descrevem serviços e snapshot de resumo.
- **Fluxo de estado**: mantém catálogo carregado do Supabase (`service_types` + `services`), seleção de tipo/técnica/dia/slot, mensagens e modais. Chama `useClientAvailability` com `subscribe` e canal dedicado, buffer padrão e timezone fixo; se falhar, cai em fallback gerado por `buildAvailabilityData`. Slots são filtrados por duração + buffer, horário mínimo do dia e intervalos ocupados. Cria agendamento via `/api/appointments` com sessão Supabase; inicia pagamento de depósito via `/api/payments/create` e redireciona para `/checkout`.
- **Layout/UX**: usa `ProcedimentoWrapper` (main hero + page), seções com cards de vidro e ícones (`LashIcon`), header com subtítulos e barra de resumo fixa (`SummaryBar`). Respeita `prefers-reduced-motion` para scroll suave e preserva classe `force-motion` para manter animação lava.
- **Invariantes**: sempre validar sessão antes de criar/pagar; preservar filtros de disponibilidade de `useClientAvailability` (buffer, timezone, 60 dias); impedir seleção de slots passados/fora do fechamento; manter sequência tipo → técnica → dia → horário e reuso do snapshot de resumo ao reabrir modal.

### 2.2 `/agendamentos`
- **Objetivo**: listar agendamentos do cliente com filtros por status, paginação, pagamento de sinal, cancelamento e reagendamento.
- **Arquivos principais**: `page.tsx` monta filtros, lista e modais; subcomponentes (`AppointmentsHeader`, `StatusFiltersBar`, `AppointmentsList`, `ConfirmCancelModal`, `RescheduleModal`, `BlockedModal`, `SuccessModal`). Tipos em `types.ts` padronizam status, calendário e slots.
- **Fluxo de estado**: carrega agendamentos do Supabase (`appointments` + serviços/tipos + totais pagos), normaliza valores monetários e nomes de serviço/técnica. Mantém seleção de categoria, paginação e diálogos de pagamento/cancelamento/edição. `RescheduleModal` usa `useClientAvailability` (filtrado por serviço) com fallback de buffer/timezone e monta calendário de 60 dias; busca slots via `/api/slots` e bloqueia horários antes do limite configurado. Cancela via `/api/appointments/{id}/cancel`, paga sinal via `/api/payments/create`, reagenda via `/api/appointments/{id}/reschedule`.
- **Layout/UX**: página embrulhada em `ClientPageShell` + `ClientSection`, cards de vidro e rodapé padrão. Lista mostra status, valores (total, sinal, pago) e ações condicionais a status e janela de cancelamento. Modais mostram avisos de bloqueio quando fora da janela de reagendamento.
- **Invariantes**: não permitir ações sem sessão; respeitar `CANCEL_THRESHOLD_HOURS` para cancelamento/reagendamento; só permitir pagamento se depósito for devido; manter sincronização de disponibilidade via `useClientAvailability` para evitar reagendar em slot indisponível.

### 2.3 `/meu-perfil`
- **Objetivo**: editar dados pessoais (nome, email, whatsapp, nascimento, senha), avatar local e preferências de tema/lava.
- **Arquivos principais**: `page.tsx` controla estado; subcomponentes (`ProfileHeader`, `ProfileForm`, `AvatarUploader`, `ThemePreferencesPanel`). Tipos em `types.ts` trazem `Profile`, `ThemeState` e `defaultTheme`.
- **Fluxo de estado**: carrega sessão e perfil do Supabase (`profiles`), mantém campos editáveis e estado de salvar/deslogar. Avatar é lido/grava em `localStorage` com chave fixa; tema é sincronizado das variáveis CSS atuais e aplicado de volta via `document.documentElement.style.setProperty`, com `refreshPalette` do `useLavaLamp` para redesenhar o fundo. Respeita `REVEAL_STAGE` para transições.
- **Layout/UX**: usa `ClientPageShell`, painéis de vidro (`ClientGlassPanel`), cards e inputs estilizados pelo módulo CSS. Menu do avatar controla upload e ações; painel de tema expõe sliders/inputs de cor que atualizam variáveis (`--inner-top/bottom`, `--bg-top/bottom`, `--glass`, `--glass-stroke`, `--card-stroke`, `--dark`, `--light`, `--lava-alpha-*`).
- **Invariantes**: preferências de tema devem persistir via CSS vars e refletir no fundo lava; avatar continua armazenado em `localStorage`; manter validações de hex/alpha e sincronização com `refreshPalette`; admins únicos podem alterar aparência.

### 2.4 `/login`
- **Layout/UX**: página usa `LavaLampProvider` + shell compartilhado (`ClientPageShell`/`ClientSection`/`ClientGlassPanel`) com card de vidro centralizado, logo textual “ROMEIKE BEAUTY” acima do card, formulário com e-mail/senha (placeholders padronizados) e link “Esqueceu sua senha? Clique aqui” centralizado; CTA principal “Entrar” e link inferior “Ainda não tem uma conta? Criar conta” para cadastro.

## 3. Hooks e helpers compartilhados
- `useClientAvailability` (`src/hooks/useClientAvailability.ts`): recebe `serviceId`, `enabled`, `subscribe`, `channel`, `fallbackBufferMinutes`, `timezone`, mensagem de erro e flag de loading inicial. Retorna snapshot de disponibilidade (`buildAvailabilityData`), estados de loading/erro e `reloadAvailability`. Busca agendamentos futuros (60 dias) no Supabase, aplica buffers por serviço e normaliza para conjuntos de dias/slots; pode subscrever a mudanças em `appointments` para recarregar. Falhas do Supabase zeram snapshot e mostram mensagem configurável; timezone e buffer padronizados garantem consistência entre `/procedimento` e `/agendamentos`.
- Tema/Lava: `LavaLampProvider` lê variáveis globais, monta paleta gradiente (`--dark`/`--light`) e redesenha blobs; `useLavaLamp.refreshPalette` é usado em `/procedimento` (painel admin) e `/meu-perfil` (preferências de tema). Globais em `globals.css` (cores base e classes `client-hero-wrapper`, `page`, `glass`).
- Layout: `ClientPageLayout` oferece shell e cartões de vidro reutilizados pelas três páginas, garantindo consistência de espaçamento e hierarquia visual.

## 4. Riscos, pontos fracos e oportunidades
- Mudanças em `useClientAvailability` afetam simultaneamente escolha de slots em `/procedimento` e reagendamento em `/agendamentos` (buffers/timezone/assinaturas Supabase).
- Dependência forte de variáveis CSS para tema: qualquer alteração em nomes ou cálculo de paleta pode quebrar o fundo lava e a leitura de cores em `/meu-perfil`.
- Lógica de pagamento (Stripe) vive em chamadas locais (`/api/payments/create`); falta isolamento/testes automatizados para erros de rede e estados de modal.
- O upload de avatar é apenas localStorage; ausência de backup server-side pode surpreender usuários em novos dispositivos.
- O shell depende de classes globais (`page`, `stack`, `glass`); mudanças em `globals.css` afetam todas as páginas sensíveis.

## 5. Atualizações recentes
- `/procedimento`: modularizado em `@components` mantendo fluxo e uso de `useClientAvailability` com fallback de buffer/timezone.
- `/agendamentos`: lista e modais reorganizados em subcomponentes; reagendamento centralizado em `RescheduleModal` usando `useClientAvailability` e slots via API.
- `/meu-perfil`: extração de subcomponentes, persistência de avatar em `localStorage` e sincronização de tema com `LavaLampProvider`.
- Hook `useClientAvailability`: consolidado para busca/subscribe em Supabase e normalização de dias/slots com buffer padrão.

## Cheat sheet (para PRs futuras)
- Shell padrão: `ClientPageShell`/`ClientSection` + `glass`/`label`; fundo lava via `LavaLampProvider` e CSS vars.
- `/procedimento`: sequência tipo → técnica → dia → horário; usa `useClientAvailability` com subscribe e filtros de buffer/duração; pagamento inicia via `/api/payments/create`.
- `/agendamentos`: filtros por status + paginação; ações de pagar/cancelar/reagendar; `RescheduleModal` usa `useClientAvailability` (60 dias, buffer padrão) e `/api/slots`.
- `/meu-perfil`: edita perfil Supabase, avatar em `localStorage`, tema via CSS vars + `refreshPalette`; apenas admins podem alterar aparência.
- Riscos-chave: alterações em CSS vars/tema ou `useClientAvailability` impactam todas as páginas sensíveis simultaneamente.
