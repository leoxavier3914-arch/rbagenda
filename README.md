# rbagenda

rbagenda é um aplicativo web desenvolvido com Next.js para gerenciamento de agendamentos e integrações com Supabase e Stripe.

## Requisitos

- Node.js 18 ou superior
- npm 10 ou superior

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente em `.env.local`.
   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   > Garanta que as chaves do Stripe estejam configuradas também no provedor de hospedagem (ex.: Vercel) ao publicar a aplicação.

3. Execute o servidor de desenvolvimento:
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

Use o segredo configurado no Stripe na variável `STRIPE_WEBHOOK_SECRET`. Esse webhook mantém os pagamentos sincronizados (aprovações, falhas e estornos) e confirma automaticamente o agendamento após pagamento aprovado.

## Scripts disponíveis

- `npm run dev`: inicia o servidor de desenvolvimento com Turbopack.
- `npm run build`: gera a versão otimizada para produção.
- `npm run start`: inicia o servidor em modo produção.
- `npm run lint`: executa a verificação de lint com ESLint.

## Estrutura do projeto

Todo o código-fonte está na pasta `src/`, seguindo o padrão do App Router do Next.js. Configurações adicionais ficam nos arquivos `next.config.ts`, `tailwind.config.js` e `tsconfig.json`.
