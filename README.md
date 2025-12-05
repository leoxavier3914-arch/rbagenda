# rbagenda

rbagenda é um aplicativo web para gerenciamento de agendamentos e pagamentos online. O projeto foi construído com Next.js, Supabase e Stripe, priorizando performance e facilidade de implantação.

## Visão geral

- **Frontend:** Next.js (App Router) com Tailwind CSS.
- **Backend:** APIs Edge/Route do Next.js e funções do Supabase.
- **Banco de dados:** Supabase Postgres.
- **Pagamentos:** Stripe Checkout e webhooks para sincronização.

Se você precisa apenas rodar localmente, siga o passo a passo rápido abaixo. As seções seguintes trazem detalhes de configuração, rotinas de manutenção e dicas para publicar o projeto.

## Como rodar localmente

1. **Pré-requisitos**
   - Node.js 18+ e npm 10+.
   - Conta no Supabase com um projeto criado.
   - Chaves de teste do Stripe (publishable e secret) para habilitar os fluxos de checkout.

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente** em `.env.local`.
   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   > Ao publicar, replique as chaves do Stripe e do Supabase no provedor de hospedagem (ex.: Vercel) para evitar falhas em webhooks ou cron jobs.

4. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

O aplicativo ficará disponível em [http://localhost:3000](http://localhost:3000).

### Webhook do Stripe

Cadastre no painel do Stripe um endpoint apontando para `https://SEU-DOMINIO/api/webhooks/stripe` e selecione ao menos os eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Use o segredo configurado no Stripe na variável `STRIPE_WEBHOOK_SECRET`. Esse webhook mantém os pagamentos sincronizados (aprovações, falhas e estornos) e confirma automaticamente o agendamento após pagamento aprovado. Em ambiente local, você pode usar o [Stripe CLI](https://stripe.com/docs/stripe-cli/webhooks) para ouvir eventos e repassá-los para `http://localhost:3000/api/webhooks/stripe`.

### Agendador de rotinas (cron)

Opção 1
Para que agendamentos com opção "pagar depois" sejam automaticamente cancelados após 2 h sem pagamento e para finalizar agendamentos passados, utilize um agendador que invoque a função `cron-maintain-appointments` incluída neste repositório.


1. Certifique-se de ter o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e faça login no projeto (`supabase login`).
2. Implante a função executando:
   ```bash
   supabase functions deploy cron-maintain-appointments --project-ref <seu-projeto>
   ```
3. No painel do Supabase, crie um **Scheduled Function** com frequência de 15 minutos apontando para `cron-maintain-appointments`.
4. Defina as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente da função (em `Functions > cron-maintain-appointments > Settings`).

A função lê diretamente as tabelas `appointments` e `appointment_payment_totals` usando a service role e replica a lógica de `src/lib/appointments.ts`, finalizando compromissos passados e cancelando pendentes sem sinal pago dentro do Supabase.

 
#### Opção 2 — GitHub Actions

Caso o Supabase Scheduler não esteja disponível no plano do projeto, utilize o workflow `.github/workflows/maintain-appointments.yml`:

1. No GitHub, acesse **Settings → Secrets and variables → Actions** e cadastre os segredos `SUPABASE_FUNCTION_URL` (URL pública da função) e `SUPABASE_SERVICE_ROLE_KEY` (chave service role).
2. O workflow executa a cada 15 minutos (`cron: "*/15 * * * *"`) e faz um `POST` na função Edge. A execução manual também fica disponível em **Actions → Maintain Supabase appointments → Run workflow**.
3. A função Edge deve estar implantada e com as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` configuradas em seu ambiente, pois ela usa a service role para atualizar as tabelas.

## Scripts disponíveis

- `npm run dev`: inicia o servidor de desenvolvimento com Turbopack.
- `npm run build`: gera a versão otimizada para produção.
- `npm run start`: inicia o servidor em modo produção.
- `npm run lint`: executa a verificação de lint com ESLint.
- `npm run test`: roda os testes unitários escritos com `tsx --test`.

## Publicação

Para publicar na Vercel (sugerido):

1. Conecte o repositório no painel da Vercel e escolha framework **Next.js**.
2. Defina todas as variáveis listadas em `.env.local` em **Project Settings → Environment Variables**.
3. Opcionalmente ative a proteção de preview para evitar chamadas reais ao Stripe em branches de revisão.
4. Após o deploy, cadastre o webhook do Stripe apontando para o domínio gerado (veja seção acima) e valide os endpoints de API.

Se preferir outro provedor, garanta que as rotas do Next.js sejam executadas em ambiente Node 18+ e que variáveis de ambiente de Stripe/Supabase estejam disponíveis.

## Testes e qualidade

- Lint: `npm run lint`
- Testes unitários: `npm run test`

Os testes cobrem a lógica de agendamentos (cancelamento automático, confirmações pós-pagamento etc.). Execute-os antes de abrir pull requests para garantir que as rotinas críticas se mantenham estáveis.

## Estrutura do projeto

Todo o código-fonte está na pasta `src/`, seguindo o padrão do App Router do Next.js. Configurações adicionais ficam nos arquivos `next.config.ts`, `tailwind.config.js` e `tsconfig.json`.

## Instalação como PWA

A aplicação está configurada para ser instalada na tela inicial em dispositivos iOS e Android por meio de um manifesto Web App (`/manifest.webmanifest`). Para personalizar os ícones exibidos durante a instalação, adicione arquivos PNG na pasta `public/icons/` (não versionados neste repositório) mantendo os seguintes nomes e dimensões:

| Arquivo | Dimensão | Uso principal |
| --- | --- | --- |
| `icon-192.png` | 192×192 | ícone padrão exigido pelo Chrome/Android |
| `icon-512.png` | 512×512 | ícone de alta resolução para Android e desktops |
| `maskable-icon-512.png` | 512×512 | ícone com área segura para Android (maskable) |
| `apple-touch-icon.png` | 180×180 | ícone exibido ao adicionar à tela inicial no iOS |

Recomenda-se gerar os arquivos em PNG com fundo transparente ou cor sólida, respeitando as dimensões indicadas. Após a substituição, não é necessário alterar nenhum outro arquivo: o Next.js publica automaticamente o manifesto e referencia os ícones nos metadados da aplicação.
