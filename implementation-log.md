# Implementation Log

Este arquivo registra implementações realizadas no projeto.

## Formato obrigatório de cada entrada
- Data: YYYY-MM-DD
- Horário: HH:MM (local)
- Implementação: <nome>
- Resumo: <1-3 linhas>
- Motivo: <1-2 linhas>

- Data: 2026-02-07
- Horário: 22:47
- Implementação: Reestruturação do modal de resumo do procedimento
- Resumo: Ajustado layout e hierarquia do modal para título/subtítulo, lista editável, observação, aviso e totais, mantendo o design system.
- Motivo: Adequar o resumo final ao fluxo solicitado antes do pagamento.

- Data: 2026-02-07
- Horário: 23:59
- Implementação: Botões Trocar mais discretos no modal de resumo
- Resumo: Reduzido tamanho e largura mínima dos botões Trocar para não competir com o conteúdo.
- Motivo: Diminuir destaque visual dos botões dentro do resumo.

- Data: 2026-02-08
- Horário: 00:08
- Implementação: Remoção do subtítulo do modal de resumo
- Resumo: Retirado o texto “Revise e ajuste se necessário.” do modal.
- Motivo: Solicitação do usuário para simplificar o cabeçalho.

- Data: 2026-02-08
- Horário: 00:21
- Implementação: Título do modal de resumo em Fraunces e maior
- Resumo: Aumentado tamanho e aplicado Fraunces apenas no título “Resumo” dentro do modal.
- Motivo: Dar mais presença visual ao título conforme solicitado.

- Data: 2026-02-08
- Horário: 00:22
- Implementação: Aumento do título “Resumo” no modal
- Resumo: Ajustado o tamanho do título com clamp maior para dar mais presença.
- Motivo: Título ainda estava pequeno conforme print do usuário.

- Data: 2026-02-08
- Horário: 00:24
- Implementação: Título “Resumo” maior com override
- Resumo: Aumentado o clamp do título e forçado o tamanho com !important.
- Motivo: O aumento anterior não ficou perceptível no print.

- Data: 2026-02-08
- Horário: 00:25
- Implementação: Reversão do ajuste de título do modal
- Resumo: Removido o override do título “Resumo” no modal.
- Motivo: Evitar gambiarras/!important conforme solicitado.

- Data: 2026-02-08
- Horário: 00:28
- Implementação: Título maior no modal de resumo via classe dedicada
- Resumo: Adicionada prop opcional de classe de título no ClientModal e aplicado tamanho maior ao título do resumo.
- Motivo: Aumentar o título de forma limpa, sem hacks ou !important.

- Data: 2026-02-08
- Horário: 00:33
- Implementação: Aumento adicional do título “Resumo”
- Resumo: Subido o clamp do tamanho do título para dar mais presença visual.
- Motivo: Usuário ainda não percebeu diferença no tamanho.

- Data: 2026-02-08
- Horário: 00:35
- Implementação: Aumento do título “Resumo” com maior especificidade
- Resumo: Ajustado o seletor para `.summaryModal .summaryTitle` para vencer a cascata sem !important.
- Motivo: O tamanho anterior era sobrescrito pelo CSS global do modal.

- Data: 2026-02-08
- Horário: 00:36
- Implementação: Ajuste de padding vertical no modal de resumo
- Resumo: Reduzido padding-top/padding-bottom do modal para compensar o título maior mantendo simetria.
- Motivo: Evitar aumento visual do modal com o título ampliado.

- Data: 2026-02-08
- Horário: 00:38
- Implementação: Ajuste fino de espaçamento do título e corpo do modal de resumo
- Resumo: Reduzido padding vertical do modal, ajustada margem do título e gap do corpo para centralizar melhor.
- Motivo: Título parecia alto e o modal não aparentava redução de altura.

- Data: 2026-02-08
- Horário: 00:41
- Implementação: Ajuste de respiro do modal de resumo
- Resumo: Reduzido padding vertical e removido margin-top do título para equilibrar topo e base.
- Motivo: Espaço acima do título estava maior que o espaço abaixo do botão cancelar.

- Data: 2026-02-08
- Horário: 00:47
- Implementação: Padding do modal de resumo com override por especificidade
- Resumo: Alterado `.summaryModal` para `.summaryModal.summaryModal` e aplicado `padding: 16px 24px` para vencer o `padding` do ClientModal sem !important.
- Motivo: Equalizar respiro topo/base e compensar título maior sem aumentar o modal.

- Data: 2026-02-08
- Horário: 00:53
- Implementação: Balanceamento visual do padding topo/base do modal de resumo
- Resumo: Ajustado padding para `12px 24px 20px` para equalizar respiro percebido entre topo/título e base/botão.
- Motivo: Apesar do padding igual, o botão inferior “come” espaço visual; precisava compensação mantendo a mesma altura total.

- Data: 2026-02-08
- Horário: 00:56
- Implementação: Fonte Tropical Avenue no título do modal de resumo
- Resumo: Adicionada @font-face global e aplicado "Tropical Avenue" apenas ao título "Resumo".
- Motivo: Trocar a fonte do título por uma opção mais marcante, sem afetar o resto do modal.

- Data: 2026-02-08
- Horário: 01:00
- Implementação: Placeholder de observação no modal de resumo
- Resumo: Alterado placeholder para “Observação... (opcional)”.
- Motivo: Clarificar o campo onde o usuário coloca observações ao agendar.

- Data: 2026-02-08
- Horário: 01:10
- Implementação: Texto informativo do sinal no modal de resumo
- Resumo: Substituído aviso por duas linhas explicando desconto do sinal e pagamento do restante no dia.
- Motivo: Mensagem mais direta e alinhada ao fluxo do atendimento.

- Data: 2026-02-08
- Horário: 01:11
- Implementação: Destaque em negrito no aviso do sinal
- Resumo: Aplicado <strong> em SINAL e RESTANTE no texto informativo.
- Motivo: Dar ênfase rápida aos termos-chave.

- Data: 2026-02-08
- Horário: 01:13
- Implementação: Botão Trocar mais discreto
- Resumo: Reduzida altura do pill e opacidade do texto do botão Trocar.
- Motivo: Manter foco no valor escolhido.

- Data: 2026-02-08
- Horário: 01:14
- Implementação: Bloco financeiro com mais respiro no modal
- Resumo: Adicionado margin/padding e divisor sutil acima dos totais.
- Motivo: Dar ritmo visual e separar a seção financeira final.

- Data: 2026-02-08
- Horário: 02:08
- Implementação: Layout dos botões do resumo em linha 50/50
- Resumo: Ajustado o container das ações para flex row e botões com largura igual e bordas menos arredondadas.
- Motivo: Deixar os dois botões lado a lado abaixo dos totais, com formato mais “quadrado”.

- Data: 2026-02-08
- Horário: 02:15
- Implementação: Forçar botões do resumo na mesma linha
- Resumo: Ajustado container das ações para não quebrar linha e manter 50/50.
- Motivo: Botões ainda estavam empilhando.

- Data: 2026-02-08
- Horário: 02:16
- Implementação: Forçar botões 50/50 no modal de resumo
- Resumo: Override local para largura 50% e min-width zero nos botões do resumo.
- Motivo: Evitar quebra causada por min-width global de 160px.

- Data: 2026-02-08
- Horário: 02:21
- Implementação: Botões do resumo lado a lado (fix CSS Modules)
- Resumo: Substituído seletor `:global(.modalButton)` por `button` dentro de `.summaryActions.summaryActions` para evitar hash de CSS Modules e forçar 50/50 na mesma linha.
- Motivo: `.modalButton` não existe como classe literal no DOM (CSS Modules), por isso as regras não aplicavam.

