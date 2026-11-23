# Convite de associação

`/membership/apply` recebe a solicitação pública. A aprovação administrativa cria o usuário e mantém a solicitação em `APPROVED`, aguardando o primeiro acesso.

Na aprovação por e-mail, o frontend valida `{ userId, activationLink }` na resposta de `POST /admin/membership-applications/{id}/approve/access-link`, conforme o DTO do backend. A action retorna somente `userId` ao componente; a URL de ativação não é exibida nem guardada no cache administrativo. A confirmação da interface representa o sucesso da operação e a solicitação de envio, sem comprovar aceite SMTP ou entrega na caixa de entrada.

A listagem de solicitações não fornece `userId`. A interface usa o ID retornado pela aprovação somente durante a sessão atual da tela para ações de senha provisória; o reenvio do convite usa o ID da solicitação e continua disponível após recarregar.

O convite abre `/membership/activate?token=...`, separado da ativação de contas em `/account/activate` e da recuperação de senha. A página remove o token da barra de endereço e solicita `GET /membership-applications/activate?token=...`, sem cache. Somente 204 libera o formulário; a validação não consome o convite.

O formulário exige senha de 8 a 72 caracteres e confirmação igual. A action envia `{ token, newPassword }` via POST na mesma rota. O 204 não contém JSON e encaminha ao login normal, sem autenticação automática. O backend define a senha, consome o token e conclui o primeiro acesso; o frontend nunca atribui `COMPLETED` por aprovação ou reenvio.

Os códigos `ACTIVATION_TOKEN_NOT_FOUND`, `ACTIVATION_TOKEN_EXPIRED` e `ACTIVATION_TOKEN_ALREADY_USED` têm mensagens próprias e orientação para solicitar reenvio à administração. Falhas transitórias permitem tentar validar novamente. A conclusão também trata expiração/uso ocorridos após a validação inicial.

Na lista administrativa, solicitações `APPROVED` com e-mail permitem `POST /admin/membership-applications/{id}/activation-link/resend`. O frontend aceita 204 sem JSON e atualiza a lista com o estado informado pelo backend.

Os testes Jest em `tests/membershipActivation.spec.ts` verificam métodos, payloads, 204, erros e limites. O cenário Playwright em `tests/browser/login/membership-activation.spec.ts` cobre entrada sem token e retorno ao login. A composição usa os campos e formulário compartilhados; não há story própria com chamadas de servidor reais.

Para testar com a API local em execução no perfil `dev`, use `npx playwright test --config=playwright.contracts.config.ts membership-activation.spec.mjs`. A suíte inicia um frontend dev isolado e usa as credenciais locais do helper existente, sem imprimi-las. Cobre aprovação administrativa, reenvio após reload, invalidação do convite anterior, GET repetido sem consumo, POST com 204, transição para `COMPLETED`, convite usado, senha divergente e login normal. Também cobre invalidação entre GET e POST. A expiração é injetada como resposta HTTP 410; não modifica datas no banco. No perfil `dev`, o envio de e-mail é simulado.

Os candidatos usam CPFs sintéticos e e-mails `example.invalid`. Solicitações ainda pendentes de primeiro acesso são rejeitadas ao encerrar o teste; contas que concluíram o acesso permanecem no banco local. Convites ficam apenas em memória e traces estão desativados nessa suíte para não persistir credenciais bearer.
