# rbagenda

rbagenda é um aplicativo web desenvolvido com Next.js para gerenciamento de agendamentos e integrações com Supabase e Pagar.me.

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
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   PAGARME_API_KEY=sk_test_xxx
   PAGARME_WEBHOOK_SECRET=uma_senha_bem_forte
   # Opcional: sobrescreva a URL base da API se necessário
   # PAGARME_API_URL=https://api.pagar.me/core/v5
   ```
   > Garanta que as chaves do Pagar.me estejam configuradas também no provedor de hospedagem (ex.: Vercel) ao publicar a aplicação.

3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O aplicativo ficará disponível em [http://localhost:3000](http://localhost:3000).

### Webhook do Pagar.me

Cadastre no painel do Pagar.me um endpoint apontando para `https://SEU-DOMINIO/api/webhooks/pagarme` e selecione ao menos os eventos:

- `order.paid`
- `order.payment_failed`
- `order.canceled`
- `charge.refunded`
- `charge.canceled`

Use o segredo (HMAC) configurado no Pagar.me na variável `PAGARME_WEBHOOK_SECRET`. Esse webhook mantém os pagamentos sincronizados (aprovações, falhas e estornos) e confirma automaticamente o agendamento após pagamento aprovado.

## Scripts disponíveis

- `npm run dev`: inicia o servidor de desenvolvimento com Turbopack.
- `npm run build`: gera a versão otimizada para produção.
- `npm run start`: inicia o servidor em modo produção.
- `npm run lint`: executa a verificação de lint com ESLint.

## Estrutura do projeto

Todo o código-fonte está na pasta `src/`, seguindo o padrão do App Router do Next.js. Configurações adicionais ficam nos arquivos `next.config.ts`, `tailwind.config.js` e `tsconfig.json`.
