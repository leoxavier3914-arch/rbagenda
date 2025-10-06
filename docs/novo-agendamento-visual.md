# Experiência visual após a reorganização do novo agendamento

A composição da página ficou dividida em três camadas principais:

1. **Hero no topo do body**  
   - O bloco do hero sai do `FlowShell` e do container `page`.  
   - Ele se alinha ao centro da viewport, ocupando até 860px de largura e mantendo um espaçamento superior responsivo (`margin: clamp(28px, 6vw, 56px)`).  
   - O título principal usa a fonte com peso 750 e tamanho fluido (`clamp(2.2rem, 5vw, 3.4rem)`), com sombra suave para se destacar sobre o fundo degradê.  
   - O subtítulo fica logo abaixo, com texto centralizado, cor suavemente atenuada (`var(--muted)`) e largura máxima de 640px para preservar legibilidade.

2. **Invólucro do FlowShell (`shellWrapper`)**  
   - Logo abaixo do hero, surge um invólucro centralizado com largura fluida (até 1400px em telas largas).  
   - Ele utiliza `position: relative` para abrigar duas camadas: o `page` (fundo) e o `FlowShell` em si.  
   - As bordas são arredondadas (`var(--radius-xl)`), combinando com os cartões internos e mantendo o visual coeso.

3. **Container `page` como fundo absoluto**  
   - O `page` fica absolutamente posicionado atrás do conteúdo do FlowShell, herdando o mesmo raio e ocupando toda a largura e altura do invólucro.  
   - O plano de fundo aplica um degradê translúcido com desfoque (`backdrop-filter: blur(22px)`), borda sutil (`var(--stroke)`) e sombra projetada, criando a sensação de cartão de vidro.  
   - Por estar com `pointer-events: none`, ele atua apenas como camada decorativa, garantindo que interações ocorram diretamente nos componentes do fluxo.

### Dentro do FlowShell

- Todo o conteúdo interativo permanece dentro do `FlowShell`, agora empilhado acima do fundo graças ao `z-index: 1` aplicado aos extras.  
- Os cartões (`.card`) exibem um segundo degradê translúcido, com animação de entrada suave (`cardRevealIn`) que move e desfoca levemente o bloco antes de revelar.  
- A tipografia segue em tons claros (`var(--ink)`), com labels em caixa alta e cor suavizada para criar hierarquia visual.  
- Os grids de “pílulas” para escolher tipos e técnicas distribuem os botões em colunas responsivas (`minmax(140px, 1fr)`), mantendo consistência mesmo em telas menores.

### Sensação geral

O resultado final é um layout em camadas: o hero respira no topo em destaque, enquanto o fluxo fica encapsulado num cartão translúcido que acompanha a largura exata do FlowShell. O fundo degradê escuro cobre toda a viewport, e a combinação de sombras e desfoques entrega um aspecto premium, com foco nas ações principais sem sacrificar a clareza das informações.
