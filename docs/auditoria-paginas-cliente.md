# Auditoria de consistência – páginas de cliente

## Contexto de layout/provedores
- O layout compartilhado `(client)` envolve todas as rotas com `LavaLampProvider` e `ClientFullScreenLayout`, garantindo o shell comum e o fundo animado, exceto para `/checkout`.【F:src/app/(client)/layout.tsx†L1-L33】

## Procedimento (`src/app/(client)/procedimento/page.tsx`)
- **Uso de layout:** usa o wrapper `client-hero-wrapper` dentro do shell global, herdando o provider do layout.【F:src/app/(client)/procedimento/page.tsx†L2134-L2153】
- **Pontos fortes:**
  - Integra diretamente com `useLavaLamp` para atualizar a paleta global, mantendo o fundo sincronizado com as escolhas do usuário.【F:src/app/(client)/procedimento/page.tsx†L1181-L1192】【F:src/app/(client)/procedimento/page.tsx†L380-L424】
  - Estrutura principal com `page` / `center` / `glass` segue o padrão visual das demais páginas, com hierarquia clara de seções e labels.【F:src/app/(client)/procedimento/page.tsx†L2134-L2190】
- **Inconsistências / riscos:**
  - Não há CSS module ou arquivo dedicado; os estilos dependem de classes globais, aumentando risco de bleed e dificultando isolamento quando comparado às outras páginas que usam módulos.【F:src/app/(client)/procedimento/page.tsx†L2134-L2167】
  - Manipula diretamente variáveis CSS globais (cores, fontes, lava) no `documentElement`, o que pode sobrepor configurações de outras páginas se o usuário navegar sem recarregar a aplicação.【F:src/app/(client)/procedimento/page.tsx†L380-L424】
  - Código extenso com múltiplos wrappers e controles em uma única árvore JSX, o que dificulta inspeção de acessibilidade e potencialmente duplica lógica de apresentação (ex.: múltiplas grids/cards inline em vez de componentes reutilizáveis).【F:src/app/(client)/procedimento/page.tsx†L2134-L2205】

## Agendamentos (`src/app/(client)/agendamentos/page.tsx`)
- **Uso de layout:** segue o mesmo wrapper `client-hero-wrapper` e é coberto pelo provider do layout; adiciona classe `styles.wrapper` para ajustes locais sem redefinir o fundo.【F:src/app/(client)/agendamentos/page.tsx†L1148-L1179】
- **Pontos fortes:**
  - Utiliza CSS module dedicado, mantendo estilos isolados (wrapper, subtítulo, cartões de filtro, etc.).【F:src/app/(client)/agendamentos/page.tsx†L14-L15】【F:src/app/(client)/agendamentos/agendamentos.module.css†L1-L80】
  - Estrutura visual segue padrão de `page` → `center` → `glass` com labels e grids consistentes com as demais páginas.【F:src/app/(client)/agendamentos/page.tsx†L1148-L1185】
  - Lógica de negócio (filtro, paginação, pagamentos) permanece desacoplada de temas globais; não altera variáveis do provider.
- **Inconsistências / riscos:**
  - Depende de tokens globais (`glass`, `card`) para vários elementos; embora estilizados via módulo, não há guardrails para manter padding/margens idênticos ao padrão se esses tokens mudarem.
  - Wrapper próprio (`styles.wrapper`) adiciona cor e altura mínima; diferença sutil em comparação ao uso puro do shell pode gerar leve discrepância de contraste se o tema global for alterado.【F:src/app/(client)/agendamentos/agendamentos.module.css†L12-L21】

## Meu Perfil (`src/app/(client)/meu-perfil/page.tsx`)
- **Uso de layout:** reutiliza `client-hero-wrapper` com `styles.wrapper`, alinhado ao shell e provider globais.【F:src/app/(client)/meu-perfil/page.tsx†L760-L779】
- **Pontos fortes:**
  - Estilos encapsulados em CSS module, incluindo animações de revelação e grid responsivo do formulário, evitando vazamento para outras páginas.【F:src/app/(client)/meu-perfil/page.tsx†L15-L20】【F:src/app/(client)/meu-perfil/meu-perfil.module.css†L1-L75】
  - Estrutura de seções clara (`page` → `center` → `glass`) com labels e grid de campos bem delimitados, mantendo consistência visual com as demais páginas.【F:src/app/(client)/meu-perfil/page.tsx†L760-L810】
  - Lógica de perfil (carregamento, persistência) isolada do shell; interações de avatar e formulários ficam dentro do card principal.
- **Inconsistências / riscos:**
  - Tal como a página de procedimento, manipula variáveis CSS globais via `commitVar`/`refreshPalette`, podendo alterar tema/bubbles de forma persistente para outras rotas se não houver reset explícito.【F:src/app/(client)/meu-perfil/page.tsx†L204-L212】
  - O módulo define wrapper com `min-height` e cor herdada; ajustes de cor podem divergir se o tema global mudar, embora o escopo continue isolado.【F:src/app/(client)/meu-perfil/meu-perfil.module.css†L1-L5】

## Recomendações finais
- **Alinhamento geral:** As três páginas compartilham o shell `client-hero-wrapper` e herdam o `LavaLampProvider`, mantendo a estrutura base consistente.
- **Ajustes sugeridos:**
  - Introduzir CSS module (ou componente de seção reutilizável) para `procedimento` a fim de isolar estilos e reduzir risco de bleed.
  - Considerar extrair a manipulação de variáveis CSS para um hook ou serviço centralizado que restabeleça valores ao desmontar a página, evitando que `procedimento` e `meu-perfil` deixem resíduos de tema em outras rotas.
  - Padronizar wrappers adicionais (`styles.wrapper`) para garantir que cores/contraste sigam os tokens globais e manter padding/spacing alinhados entre páginas.

**Conclusão:** as páginas estão majoritariamente alinhadas em layout e estrutura, mas `procedimento` carece de modularidade de estilos e tanto `procedimento` quanto `meu-perfil` alteram variáveis globais sem isolamento, o que indica pendências antes de declarar pleno alinhamento e boas práticas.
