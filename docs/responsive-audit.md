# Auditoria de responsividade

**Status: análise estática inicial concluída; inspeção visual e correções ainda pendentes.**

Este relatório registra o inventário de rotas, evidências encontradas no código e a ordem de trabalho. A revisão inicial percorreu as 58 entradas `page.tsx`, o shell compartilhado, componentes compartilhados de formulário/tabela/modal e padrões de layout dos módulos. Não há aprovação visual de nenhuma rota nesta etapa.

## Escopo e evidência

- 58 páginas/entradas App Router foram inventariadas em `src/app` (incluindo páginas interceptadas e páginas de API apenas para distinguir rotas de interface).
- 41 arquivos de specs Playwright existem em `tests/browser`; cobrem amostras de Feed, publicações, login, finanças, campos, tabelas, calendário e home, não uma varredura de todas as rotas autenticadas.
- `playwright.config.ts` define viewports 375×812, 768×1024 e 1440×900 para Chromium, Firefox e WebKit; axe roda em Chromium a 375 e 1440. Os tamanhos solicitados 320, 430, 1024, 1366 e 1920 ainda não fazem parte dessa matriz.
- O ambiente de browser visual do computador não está disponível nesta sessão. A configuração de browser local existe, mas a sua execução deve ser feita com os três destinos locais de `.env.example` e API sintética; nenhuma API remota deve ser usada. Até haver execução, causas e manifestações visuais abaixo são classificadas como evidência estática.

## Inventário de rotas de interface

Rotas agrupadas pelo domínio do App Router; `(...)` são route groups, não segmentos da URL.

| Módulo | Rotas |
|---|---|
| Público e institucional | `/`, `/equipe`, `/contato`, `/termos-de-uso`, `/termo-de-imagem`, `/termo-de-risco`, `/politica-de-privacidade` |
| Autenticação e associação | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account/activate`, `/membership/activate`, `/membership/apply`, `/first-access/password` |
| Área do associado | `/agenda`, `/avisos`, `/configuracoes`, `/eventos`, `/financeiro`, `/feed`, `/feed/new`, `/feed/[id]`, `/feed/[id]/edit`, `/feed/[id]/register`, `/notificacoes`, `/profile`, `/servicos`, `/tutoriais`; entradas de slot `/feed/@modal` e `/feed/@modal/[...catchAll]` |
| Administração | `/admin`, `/admin/dados-medicos`, `/admin/dependentes`, `/admin/ferramentas`, `/admin/gestao-financeira`, `/admin/gestao-financeira/cobrancas`, `/admin/gestao-financeira/movimentacoes`, `/admin/pagamentos`, `/admin/pagamentos/[id]`, `/admin/publications`, `/admin/publications/event`, `/admin/publications/event/[id]`, `/admin/publications/notice`, `/admin/publications/notice/[id]`, `/admin/publications/service`, `/admin/publications/service/[id]`, `/admin/roles-permissoes`, `/admin/tools`, `/admin/users`, `/admin/users/new`, `/admin/users/[id]`, `/admin/veiculos` |
| Entradas interceptadas | `/feed/new`, `/feed/[id]`, `/feed/[id]/edit`, `/feed/[id]/register` e `/admin/users/[id]` (apresentação em modal quando navegada por slot; quatro páginas feed e uma página de usuário) |

O inventário também encontrou rotas técnicas sob `/api/*`; elas não são telas e ficam fora da validação visual.

## Achados priorizados

Os pontos marcados como **risco estático** exigem reprodução no browser antes de serem tratados como defeito visual confirmado.

| ID / prioridade | Página ou componente | Evidência e possível manifestação | Causa provável / arquivo | Correção recomendada |
|---|---|---|---|---|
| RA-01 · Médio · risco estático | Shell autenticado, todas as rotas do dashboard | O container de rolagem aplica `overflow-x-hidden`; se um filho exceder a largura, a parte excedente pode ser cortada sem uma barra que revele o problema. | Regra no shell global: `src/components/common/layout-admin/DashboardShell.tsx`. | Percorrer rotas autenticadas e localizar o filho que excede; corrigir seu grid/flex/min-width. Manter a contenção global somente se a inspeção demonstrar que não oculta conteúdo útil. |
| RA-02 · Médio · risco estático | Agenda mensal em celular | Cabeçalho e calendário usam sete colunas em todas as larguras, com dias de pelo menos 96px de altura e conteúdo de evento dentro de cada célula. Em 320–430px, cada célula fica estreita e pode truncar nomes/títulos ou tornar a grade difícil de ler. | `grid-cols-7`, conteúdo de eventos e `overflow-hidden` em `src/components/pages/agenda/index.tsx`. | Validar em 320/375/430. Se houver perda de leitura, manter o resumo mensal compacto e oferecer apresentação mobile de eventos acessível por dia, sem remover navegação/calendário. |
| RA-03 · Médio · confirmado no código, falta validação visual | Abas do perfil | São cinco botões em grade; no mobile cada botão tem ícone 22px mais padding vertical de 8px por lado (38px de altura nominal), abaixo do alvo de toque confortável de 44px definido no guia do projeto. | Classes `p-2` sem altura mínima mobile em `src/components/pages/profile/index.tsx`. | Dar altura/alvo mínimo de 44px sem estourar a grade e conferir foco/toque em 320/375. |
| RA-04 · Baixo · risco estático | Home pública, seção de indicadores | Três indicadores ficam em três colunas mesmo em 320px, com gap de 16px e fontes de 30px. Pode haver quebra de rótulo ou aperto visual. | `grid-cols-3` sem breakpoint em `src/components/pages/root/HomeClient.tsx`. | Validar com fontes reais em 320/375; reduzir gap/tamanho de forma fluida se a hierarquia ficar comprometida. |
| RA-05 · Alto · lacuna de validação | Rotas autenticadas e administrativas | A suíte existente cobre fluxos selecionados, mas não demonstra reflow/overflow em todas as 58 rotas, estados vazios/cheios ou diálogos de cada domínio. | Cobertura listada em `tests/browser/`; configurações sem varredura global. | Construir uma matriz de rotas e estados com fixtures locais; executar amostras representativas por módulo e ampliar a suíte onde a inspeção revelar regressões. |
| RA-06 · Médio · lacuna de viewports | Toda a aplicação | Os viewports Playwright não incluem cinco larguras obrigatórias (320, 430, 1024, 1366, 1920). | Projetos definidos em `playwright.config.ts`. | Adicionar cobertura das larguras ausentes aos testes responsivos apropriados e executar nos três engines quando o tempo/cobertura justificar; preservar projetos existentes. |
| RA-07 · Médio · shell/navegação, risco estático | Barra superior autenticada | O nome do usuário some abaixo de `md`, enquanto sino, tema e avatar permanecem; a barra tem altura fixa de 56px. Nomes/ações e largura mínima devem ser conferidos em 320px e com zoom. | `h-14`, controles em linha em `src/components/common/layout-admin/Topbar.tsx`. | Verificar colisão, foco e áreas de toque em viewport estreita; ajustar shrink/gap apenas se observado. |
| RA-08 · Baixo · shell/navegação, risco estático | Sidebar mobile | O painel ocupa 256px fixos; em 320px deixa uma faixa pequena do fundo e sua transição dura 1000ms. | `width: 256px` e transições em `src/components/common/layout-admin/Sidebar.module.css`. | Validar painel, backdrop, rolagem de navegação e movimento reduzido em 320px; dimensionar pelo viewport e encurtar animação caso prejudique interação. |
| RA-09 · Médio · validação de componentes | Tabelas, modais, popovers e formulários compartilhados | Há wrappers de tabela com `overflow-x-auto` e vários modais limitados por altura; isso é um padrão útil, mas não prova que ações, conteúdo largo e foco permaneçam utilizáveis em celular. | `src/components/common/table/*`, `src/components/common/modal/*`, `src/components/common/input/*` e modais de módulos. | Validar scroll interno, cabeçalho/ações, teclado, safe area, altura dinâmica e foco nos consumidores, sem remover dados/ações. |

## Plano de execução e checklist

Avançar por etapa após registrar evidência e validar a anterior. O checklist marca análise estática; os estados de correção/teste continuam pendentes até execução real.

| Etapa | Escopo | Análise | Problemas registrados | Correções | Mobile | Tablet | Desktop | Funcional | Aprovada |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | Inventário geral / plano | [x] | [x] (estáticos e lacunas) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 1 | Shell, container e navegação compartilhada | [x] | [x] (RA-01, RA-07, RA-08) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | Home pública e páginas institucionais | [x] | [x] (RA-04) | [ ] | [x] (home, 7 larguras) | [x] (home) | [x] (home) | [ ] | [ ] |
| 3 | Dashboard, agenda, feed e publicações | [x] | [x] (RA-02, lacunas RA-05/06) | [x] (lista mobile da agenda) | [ ] | [ ] | [ ] | [ ] | [ ] |
| 4 | Listagens e cadastros administrativos | [x] | [x] (lacunas RA-05/06) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 5 | Finanças, pagamentos e dashboards | [x] | [x] (lacunas RA-05/06) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 6 | Perfil, configurações e dados pessoais | [x] | [x] (RA-03, lacunas RA-05/06) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 7 | Formulários, tabelas, diálogos e componentes compartilhados | [x] | [x] (RA-09) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 8 | Autenticação, associação e rotas restantes | [x] | [x] (lacunas RA-05/06) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

### Matriz de larguras obrigatórias

| 320 | 375 | 430 | 768 | 1024 | 1366 | 1920 |
|---:|---:|---:|---:|---:|---:|---:|
| [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

Para cada grupo, verificar overflow horizontal indevido, conteúdo cortado/sobreposto, textos longos, áreas de toque, navegação/teclado, formulários, tabelas e rolagem de diálogos. A aprovação exige evidência visual e funcional no browser; lint ou compilação não são substitutos.

## Registro de execução

- **Home pública:** Chromium percorreu 320, 375, 430, 768, 1024, 1366 e 1920px no build local já disponível. Em todas as larguras, `documentElement.scrollWidth` e `body.scrollWidth` coincidiram com a largura da viewport; a captura completa em 320px foi inspecionada e não mostrou conteúdo cortado. Isso cobre somente a Home, não as páginas institucionais nem seus estados e interações.
- **Agenda:** foi adicionada uma lista mobile dos dias com eventos/aniversários, preservando a grade mensal a partir de 768px. Cada linha abre o mesmo diálogo de detalhes que a célula do calendário. Correção ainda sem validação visual ou funcional autenticada.
- **ESLint:** `npx eslint src/components/pages/agenda/index.tsx` concluiu sem apontamentos.
- **TypeScript:** `npx tsc --noEmit --pretty false` continua bloqueado por tipos gerados preexistentes em `.next/dev/types/validator.ts`, que referenciam as páginas ausentes `admin/gestao-eventos` e `admin/gestao-publicacoes`; não apontou erros no arquivo de agenda antes dessas falhas.
- **Playwright padrão:** a coleta de 1.751 cenários funcionou após informar as origens locais. A tentativa de executar `tests/browser/home/home-layout.spec.ts` falhou antes dos testes porque `next dev` interrompe a inicialização com um aviso de segurança da versão instalada. A verificação manual via `next start` cobriu a Home; nenhuma suíte foi declarada aprovada.
- **Próximo passo bloqueante:** validar shell autenticado e lista/grade da agenda com sessão e API sintéticas pelo runner browser, sem backend remoto. Até essa validação, a etapa 3 não deve avançar para feed/publicações.

## Limitações da auditoria inicial

- Esta etapa foi estática. As manifestações potenciais não devem ser reportadas como falhas visuais reproduzidas.
- O browser integrado não está disponível nesta sessão. A configuração local Playwright depende de origens locais (`PLAYWRIGHT_APP_URL`, `PLAYWRIGHT_STORYBOOK_URL`, `PLAYWRIGHT_API_URL`) e da API HTTP sintética; não foi obtida captura autenticada de todos os módulos.
- A matriz atual não satisfaz as sete larguras pedidas; RA-06 registra essa diferença. O ajuste deve ocorrer dentro da etapa de testes, sem mascarar falhas com `overflow-x-hidden`.
- Esta auditoria preserva as alterações já presentes no workspace, inclusive a árvore de dependentes e componentes de publicações.
