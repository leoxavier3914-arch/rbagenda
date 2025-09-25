# rbagenda

rbagenda é um aplicativo web desenvolvido com Next.js para gerenciamento de agendamentos e integrações com Supabase e Mercado Pago.

## Requisitos

- Node.js 18 ou superior
- npm 10 ou superior

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente em `.env.local`.
3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O aplicativo ficará disponível em [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

- `npm run dev`: inicia o servidor de desenvolvimento com Turbopack.
- `npm run build`: gera a versão otimizada para produção.
- `npm run start`: inicia o servidor em modo produção.
- `npm run lint`: executa a verificação de lint com ESLint.

## Estrutura do projeto

Todo o código-fonte está na pasta `src/`, seguindo o padrão do App Router do Next.js. Configurações adicionais ficam nos arquivos `next.config.ts`, `tailwind.config.js` e `tsconfig.json`.
