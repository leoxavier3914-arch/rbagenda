# Auditoria rbagenda – 2025-12-07

## 1. Visão geral da arquitetura
- Projeto usa App Router do Next.js (pasta `src/app`). O `RootLayout` (`src/app/layout.tsx`) aplica `globals.css` e `procedimento.css`, injeta a `brand-texture-overlay` fixa e define `client-fullscreen` no `<body>` para rotas de cliente como `/agendamentos`, `/procedimento`, `/meu-perfil` (lista em `clientShellRoutes`).
- Rotas de cliente ficam em `src/app/(client)`, com um `ClientLayout` dedicado que envolve as páginas no `LavaLampProvider` e, por padrão, no `ClientFullScreenLayout`. Para `/checkout`, o layout mantém o provider mas omite o shell/menu para evitar padding extra.
- `ClientFullScreenLayout` adiciona/remover a classe `client-fullscreen` no `<body>`, controla padding para rotas específicas e esconde a `brand-texture-overlay` via CSS módulo, garantindo que o fundo proprietário (lava/texture) prevaleça.
- Distinção de rotas: páginas públicas/auth/admin usam outras pastas ((auth), (admin)), enquanto o grupo `(client)` oferece shell visual consistente com menu lateral e fundo animado.
- `LavaLampProvider` (com canvases `lavaDark`/`lavaLight` + textura SVG) fornece fundo animado e expõe contexto `refreshPalette` usado pelas páginas para sincronizar cores.
- Componentes compartilhados de cliente vivem em `src/components/client` (ex.: `ClientPageLayout` com shell/seções/painéis) e componentes de shell em `src/components` (`ClientFullScreenLayout`, `ClientMenu`).

## 2. Páginas de cliente: procedimento, agendamentos, meu-perfil
- `/procedimento` (`src/app/(client)/procedimento/page.tsx`)
  - Responsabilidade: fluxo de seleção de tipo/técnica/horário de procedimento e criação de pagamento/agendamento (Supabase + Stripe + disponibilidade). Gerencia paleta de cores dinâmica e preferências de movimento.
  - Layout: usa `ProcedimentoWrapper/Header/Grid/Card` (módulos locais) em vez dos wrappers genéricos; ainda roda dentro do `ClientFullScreenLayout` e `LavaLampProvider` herdados do layout `(client)`.
  - Modularização: componentes em `src/app/(client)/procedimento/@components` encapsulam wrapper da página, cabeçalho com diamante, grids e cards glass.
  - Fundo: utiliza o mesmo container `procedimento-root` provido pelo `LavaLampProvider` (textura + lava), mantendo consistência visual com outras páginas de cliente.

- `/agendamentos` (`src/app/(client)/agendamentos/page.tsx`)
  - Responsabilidade: listar, filtrar e detalhar agendamentos do usuário, permitindo cancelamento/remarcação, cálculo de valores pagos/devidos e integração com Stripe/Supabase.
  - Layout: usa `ClientPageShell`, `ClientSection`, `ClientPageHeader` e `ClientGlassPanel` para estruturar hero, seções e cards dentro do shell padrão de cliente.
  - Modularização: lógica concentrada na página, mas UI reusa componentes de `@/components/client/ClientPageLayout` e CSS módulo dedicado.
  - Fundo: herda `ClientFullScreenLayout` + `LavaLampProvider`; sem sobrescritas locais, portanto compartilha o fundo animado.

- `/meu-perfil` (`src/app/(client)/meu-perfil/page.tsx`)
  - Responsabilidade: edição de perfil (nome, WhatsApp, aniversário, senha), logout e customização de tema visual (cores da paleta e lava) com persistência local e sincronização via `useLavaLamp`.
  - Layout: usa `ClientPageShell`, `ClientSection`, `ClientPageHeader`, `ClientGlassPanel`; também integra `useLavaRevealStage` para controlar timing de revelação visual.
  - Modularização: lógica na página, com estilos isolados em CSS módulo; reutiliza o mesmo set de componentes de layout compartilhado.
  - Fundo: permanece dentro do shell/lava padrão; controles de tema apenas ajustam variáveis e chamam `refreshPalette`, sem alterar a presença do fundo ou overlays.

## 3. Layout, fundo e overlays (lava, textura, brand-texture-overlay)
- `RootLayout` sempre renderiza a `<div class="brand-texture-overlay">` fixa atrás do app; quando `client-fullscreen` está ativo, `ClientFullScreenLayout.module.css` a oculta para evitar conflito com o fundo de cliente.
- `body.client-fullscreen` (ativado tanto pelo `RootLayout` ao detectar rota quanto pelo `ClientFullScreenLayout` no cliente) define gradiente de fundo global em `globals.css` e variáveis usadas pela lava.
- `LavaLampProvider` envolve o conteúdo das rotas `(client)`, renderizando uma textura SVG fixa e dois canvases (`lavaDark` e `lavaLight`) em `div.lamp` com blend-modes `multiply` e `screen`. O provider mantém refs e controlador para reseed/sync da paleta baseada em CSS vars.
- Os caminhos `/procedimento`, `/agendamentos`, `/meu-perfil` compartilham o mesmo shell/layout de cliente (menu + classe `client-fullscreen` + provider), garantindo persistência do fundo animado ao navegar entre eles sem reset perceptível; apenas `/checkout` sai do menu mas mantém o provider.
- A textura de marca alternativa (brand-texture-overlay) só aparece em rotas fora do shell de cliente, pois é ocultada quando o shell está ativo.

## 4. Componentes compartilhados de cliente
- Fundamentais em `src/components/client/ClientPageLayout.tsx`: `ClientPageShell` (wrapper principal com classes `client-hero-wrapper`/`client-hero-ready`), `ClientSection` (centra e empilha conteúdo), `ClientPageHeader` (título + diamante opcional + subtítulo) e `ClientGlassPanel` (cartão glass com label opcional). Uso recomendado: envolver cada página com `ClientPageShell`, agrupar conteúdo em `ClientSection`, usar `ClientGlassPanel` para painéis/cards e `ClientPageHeader` para hero.
- Shell e navegação: `ClientFullScreenLayout` (wrapper que impõe body class e injeta `ClientMenu`) e `ClientMenu` (menu lateral/top, controle de padding e fetch de perfil via Supabase) em `src/components`.
- Componentes específicos de `/procedimento` em `src/app/(client)/procedimento/@components` permitem reuso interno (wrapper, cabeçalho, grid, card glass), mantendo a página coesa mesmo sem usar `ClientPageLayout` genérico.
- Potenciais duplicações: `/procedimento` mantém wrappers próprios semelhantes a `ClientPageShell`/`ClientSection`; futura convergência poderia alinhar nomenclatura/props sem alterar o comportamento atual. Além disso, padrões de “card glass + label” se repetem em diferentes CSS modules.

## 5. Estilos e organização de CSS
- CSS globais em `src/app/globals.css` definem variáveis de tema, estilos base do shell (`client-hero-wrapper`, `.page`, `.center`, `.stack`), gradientes de fundo e regras para `.procedimento-root` (textura/lava positioning, blur e blend modes). `procedimento.css` (importado no RootLayout) provê estilos adicionais específicos.
- CSS modules por página: `src/app/(client)/procedimento/procedimento.module.css`, `src/app/(client)/agendamentos/agendamentos.module.css`, `src/app/(client)/meu-perfil/meu-perfil.module.css`. `ClientFullScreenLayout.module.css` controla ocultação da `brand-texture-overlay` e wrapper geral.
- Riscos de bleed são mitigados pelo uso de CSS modules para estilos de página e seletores com prefixo (`client-hero-wrapper`, `procedimento-root`). Há alguns seletores globais (ex.: `.card` genérica) que são sobrescritos pela variante de cliente, mas permanecem restritos a classes explícitas.
- A separação entre tema global (variáveis + fundo/lava) e estilos de página (modules) é clara: variáveis são definidas no `body` e consumidas pelo provider/lava, enquanto a tipografia/spacing de cada página vem de modules ou wrappers compartilhados.

## 6. Lógica de negócio (visão de alto nível)
- Acesso a dados: páginas usam `supabase` (`@/lib/db`) para buscar perfil, agendamentos e serviços; `stripePromise` (`@/lib/stripeClient`) para pagamentos; `buildAvailabilityData` e utilitários em `@/lib/availability` para slots e buffers. Não há alteração de lógica nesta auditoria.
- `/agendamentos` orquestra leitura de agendamentos, normalização de serviços/totais e ações de cancelamento/remarcação com checagem de horários e integração Stripe.
- `/meu-perfil` gerencia sessão do usuário, atualização de dados pessoais e alteração de senha, além de preferências de aparência sincronizadas com `LavaLampProvider` via `refreshPalette`.
- `/procedimento` centraliza seleção de serviços, datas e slots, criando payloads para agendamento/pagamento e ajustando a paleta visual conforme o procedimento escolhido.
- As refatorações de layout/shell mantêm a lógica intacta: o acoplamento principal é visual (variáveis de tema + lava) com chamadas de negócio isoladas nos hooks/utilitários importados.

## 7. Pontos fortes
- Shell de cliente unificado com menu, fundo animado e wrappers reutilizáveis, garantindo consistência visual.
- Uso extensivo de CSS modules e variáveis para isolar estilos e permitir personalização controlada (inclusive via página de perfil).
- `LavaLampProvider` bem encapsulado, com API explícita (`refreshPalette`) e controle de lifecycle das animações/canvases.
- Modularização interna de `/procedimento` com componentes dedicados facilita manutenção sem afetar outras rotas.

## 8. Riscos e pontos de atenção
- Duplicação de wrappers/layouts entre `/procedimento` e os componentes genéricos pode levar a divergências sutis de padding/spacing se evoluírem separadamente.
- Dependência de variáveis CSS globais para cores e opacidades da lava: mudanças globais podem impactar todas as páginas de cliente; ausência de valores válidos pode afetar renderização do fundo.
- Seletores globais como `.card` em `globals.css` podem interferir em novos componentes se nomes se repetirem sem module.
- Navegação fora do shell (`/checkout`) ainda usa `LavaLampProvider`; qualquer alteração futura no provider deve considerar essa rota especial.

## 9. Oportunidades de melhoria futura
- Avaliar convergência dos wrappers de `/procedimento` com `ClientPageShell/Section` para reduzir duplicidade mantendo a estética atual.
- Extrair padrões recorrentes de “card glass + label” e headers com diamante para componentes compartilhados, mantendo props compatíveis com as páginas existentes.
- Documentar explicitamente o ciclo de vida do fundo (brand-texture-overlay vs. lava) no README/docs para novos contribuidores.
- Considerar testes visuais/navegação para garantir que mudanças em variáveis de tema não causem regressões no fundo ou no menu entre rotas de cliente.
