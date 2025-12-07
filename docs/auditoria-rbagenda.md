# Auditoria rbagenda

## Estrutura geral
- Rotas de cliente vivem em `src/app/(client)`, usando páginas client-side (`'use client'`).
- O shell visual reutiliza o conjunto de componentes em `src/components/client/ClientPageLayout` (PageShell, Section, PageHeader, GlassPanel) para manter header → conteúdo consistente.
- As páginas sensíveis (`/procedimento`, `/agendamentos`, `/meu-perfil`) operam sobre o mesmo fundo animado controlado por `LavaLampProvider` e CSS variables (cores/gradientes definidos em `:root`).

## Componentes compartilhados
- `ClientPageLayout` fornece wrappers padrão de página, seção e cartões de vidro (`glass`, `label`, etc.).
- `LashIcon` (novo) fica em `src/components/client/LashIcon.tsx` e centraliza o ícone usado nos cards/listas de /procedimento e /agendamentos.

## Organização de estilos
- Cada página de cliente usa CSS Modules próprios (`*.module.css`), mantendo grid/cards/slots encapsulados.
- Classes globais esperadas pelos wrappers (`client-hero-wrapper`, `page`, `glass`, etc.) continuam sendo aplicadas via o shell padrão e pelos módulos das páginas.

## Comportamento das páginas
- `/procedimento` guia a escolha de tipo, técnica, dia e horário; controla disponibilidade via Supabase/Stripe e mostra um resumo fixo. Mantém animações condicionais a `prefers-reduced-motion` e força a persistência do fundo animado. UI agora está dividida em subcomponentes internos (`@components`) mantendo a mesma lógica e uso de `useClientAvailability`.
- `/agendamentos` lista e filtra agendamentos por status, permitindo pagar sinal, reagendar ou cancelar conforme regras de horário; usa o mesmo shell e cards de vidro. A tela foi organizada em subcomponentes locais (`@components`) sem alterar a lógica ou o consumo de `useClientAvailability` para carregar slots.
- `/meu-perfil` permite editar dados pessoais e customizar a paleta do fundo/lava via CSS variables e Supabase; usa o reveal stage para sincronizar animações com o hero. A UI está dividida em subcomponentes locais (`@components`) preservando lógica de perfil, tema e avatar.

## Riscos e oportunidades
- Alterações em variáveis de tema (meu-perfil) impactam o fundo global das páginas de cliente; validar regressões visuais ao mudar paleta.
- Novos usos do `LashIcon` podem seguir o padrão atual sem duplicar SVGs.
- O hook de disponibilidade compartilhado deve ser validado ao ajustar buffers/regras para evitar regressões simultâneas em `/procedimento` e `/agendamentos`.

## Atualizações recentes
- Lógica de disponibilidade/slots de `/procedimento` e `/agendamentos` foi centralizada no hook `useClientAvailability` (`src/hooks/useClientAvailability.ts`), mantendo filtros, buffers e dados exibidos inalterados.
- `/procedimento` foi modularizado em subcomponentes internos para melhorar legibilidade sem alterar lógica, layout ou integração com `useClientAvailability`.
- `/agendamentos` foi reorganizado em subcomponentes locais (`@components`) preservando o layout atual e toda a lógica de pagamentos, cancelamentos e reagendamentos com `useClientAvailability` para disponibilidade.
- `/meu-perfil` passou a usar subcomponentes locais (`@components`) mantendo a mesma lógica de perfil, tema, lava e avatar.
