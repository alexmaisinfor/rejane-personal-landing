# Rejane Bispo — landing page

Landing page responsiva em HTML, CSS e JavaScript, com servidor Node.js e banco SQLite para avaliações por convite. Não exige dependências npm adicionais.

## Executar localmente

Requer Node.js 24 ou superior (usa `node:sqlite`). Na pasta do projeto:

```powershell
npm install
npm start
```

Abra http://localhost:8000. Para conferir a sintaxe: `npm run check`.

O servidor local atende somente em 127.0.0.1. Para publicar o formulário, será necessária hospedagem com Node.js, HTTPS e disco persistente para `data/`; hospedagem somente estática não salva avaliações. Defina `SITE_URL` com o domínio publicado ao gerar convites. Faça backup do SQLite com a aplicação parada ou com uma ferramenta de backup SQLite; não copie apenas o arquivo principal enquanto houver escrita em WAL.

## Avaliações por convite

### Painel de aprovação pelo navegador

Execute `npm run reviews:admin` para gerar um link privado de `/aprovacoes.html`, válido por 30 dias. Guarde o link: quem tiver acesso a ele poderá moderar avaliações e criar convites. A chave fica no fragmento da URL; o servidor armazena somente o hash. Não compartilhe esse link com alunos. O painel permite ver relatos e fotos pendentes, aprovar, rejeitar, retirar publicações e gerar/copiar convites para alunos. Os convites dos alunos continuam distintos do acesso administrativo.

Para trocar os acessos administrativos, execute localmente `node reviews-admin.mjs revoke-access` e gere outro link. Os links antigos deixarão de funcionar.

### Fotos

O aluno pode enviar uma foto JPG, PNG ou WebP de até 5 MB e 16 megapixels. O servidor valida e decodifica a imagem com Sharp, remove metadados e converte para WebP de até 800 × 800. A foto fica no banco e só é acessível publicamente quando a avaliação está aprovada. O painel pode visualizar a foto pendente com autenticação. O consentimento inclui a publicação da imagem. Sem foto, o card mostra a inicial do nome.

### Histórico de acessos

O servidor registra somente o instante (`accessed_at`, em milissegundos UTC) de cada GET bem-sucedido de `/` ou `/index.html`. Não guarda IP, agente do navegador, origem, cookies ou identificação do visitante. Atualizações, testes e robôs contam como acessos: não é uma contagem de pessoas únicas. HEAD, arquivos estáticos, formulários e painel não são contabilizados. Os registros ficam no SQLite e aparecem no painel autenticado em “Acessos ao site”, com horário de Brasília, 50 por página. Somente novos acessos são registrados; não há retroatividade. O histórico não é enviado ao GitHub.

O formulário fica em `/avaliar.html`. Ele exige um convite individual, válido por 7 dias, com um único envio. O token é armazenado como hash no banco e fica no fragmento do link. Guarde o link como uma credencial e envie somente ao aluno convidado. Quem tiver o link poderá utilizá-lo.

```powershell
# Criar um link individual; o comando imprime a URL completa.
npm run reviews:invite

# Listar avaliações aguardando revisão.
npm run reviews:pending

# Publicar ou rejeitar uma avaliação pelo ID da lista.
node reviews-admin.mjs approve 1
node reviews-admin.mjs reject 2

# Retirar do site um relato aprovado, se solicitado.
node reviews-admin.mjs unpublish 1
```

Somente avaliações aprovadas aparecem na landing page. São exibidas três inicialmente, com botão “Mostrar mais” que carrega outras três por vez. Até três avaliações podem ser fixadas pelo painel, na categoria Publicadas, usando “Fixar” e “Desafixar”. As fixadas aparecem primeiro; as vagas restantes recebem as mais recentes. A ordem dentro de cada grupo é por data e ID decrescentes. Ao retirar uma publicação, sua fixação é removida automaticamente. O limite é garantido em transação no banco, inclusive com múltiplos acessos administrativos.

A API pública usa paginação por cursor (`/api/reviews?cursor=...`) sem limite total de 12. A ordem reflete o estado atual: se houver moderação ou mudança nas fixações durante a navegação, atualizar a página recompõe a lista. A interface evita duplicar um mesmo comentário já exibido.

O formulário recolhe nome público, nota, relato, foto opcional e consentimento. Não envia e-mail nem WhatsApp automaticamente. Use `unpublish ID` para retirar do site uma avaliação já aprovada.

Os dados ficam em `data/reviews.sqlite`, excluídos do Git e inacessíveis diretamente pelo servidor HTTP. A moderação está disponível no painel autenticado e no terminal. A interface do painel pode abrir sem acesso; os dados e ações exigem a chave privada.

Testes: `npm test`. Verificação de sintaxe: `npm run check`.

## Conteúdo

### Agendamento por WhatsApp

Os botões “Agendar” do cabeçalho e “Quero começar” da apresentação abrem o mesmo modal. Ele exige nome, WhatsApp brasileiro com DDD e aceite de privacidade; a observação é opcional. A página `privacidade.html` descreve o encaminhamento dos dados. Ao continuar, o formulário salva a solicitação no SQLite via `/api/appointments` antes de abrir o WhatsApp com a mensagem preenchida. O registro inclui nome, telefone, plano, agenda, adicional, observação e autorização. Não utiliza armazenamento local do navegador. Fechar antes de continuar limpa os campos sem salvar. Uma solicitação salva não confirma envio da mensagem nem reserva de horário. Se o salvamento falhar, o formulário mantém os campos para tentar novamente. Um identificador de solicitação evita duplicar o mesmo envio. Como os dados compõem o endereço de destino, eles podem ficar no histórico do navegador e passam ao serviço WhatsApp ao abri-lo.

Os seis botões “Quero esse plano” também abrem o modal, com resumo do plano, valor mensal e frequência. A mensagem indica interesse e pede confirmação de disponibilidade. Os dados do pacote são lidos do próprio card para acompanhar alterações de conteúdo. No Online, a aula presencial demonstrativa de R$ 200 é uma opção adicional desmarcada por padrão; a mensagem só menciona o adicional se selecionado. Fechar o modal limpa os campos e o plano escolhido. Os botões gerais continuam sem associação a um plano.

Nos planos presenciais de 1x a 5x, a primeira opção de agenda é obrigatória, com exatamente a quantidade de dias do plano e um horário para cada dia. “Adicionar alternativa de agenda” permite uma segunda opção: ao ativá-la, é necessário preenchê-la completamente ou removê-la. Dias não podem se repetir dentro de uma opção. A segunda opção pode compartilhar dias com a primeira, mas não pode ser idêntica (mesmos dias e horários, independentemente da ordem). As duas opções seguem na mensagem do WhatsApp como preferências sujeitas a confirmação, sem reserva automática. Formulário geral e Online não exigem agenda semanal. As escolhas são descartadas ao fechar o modal.

Implementação: `assets/contact-modal.js`, regras e formatação em `assets/contact-utils.mjs`. Os demais links de WhatsApp mantêm seu funcionamento anterior.

- Textos e planos: `index.html`. Depoimentos publicados: banco SQLite, renderizados por `assets/reviews.js`.
- Cores, fontes e responsividade: `assets/style.css`.
- Mensagens e número do WhatsApp: `assets/app.js`; mantenha os links HTML sincronizados para navegação sem JavaScript.
- Instagram: https://www.instagram.com/rejanepersonaltrainer/
- E-mail: rejanebs23@gmail.com.
- WhatsApp: +55 61 98292-0780.

## Foto de destaque

Origem indicada: https://www.instagram.com/p/DXYF4TZDAnZ/

A foto indicada foi salva localmente em `assets/rejane.jpg` (640 × 640 pixels). Substitua esse arquivo por uma versão de maior resolução quando disponível. Recomendação: proporção vertical, mínimo 800 px de largura, WebP otimizado.

## Antes de publicar

Confirmar serviços, valores, condições, disponibilidade e registro profissional. Os depoimentos ilustrativos foram removidos: apenas relatos aprovados serão exibidos. Não foram inventadas estatísticas de alunos, anos de experiência ou avaliações. As fontes Google Fonts são a única dependência visual externa e têm fontes locais de fallback; podem ser hospedadas localmente.

### Solicitações no painel

O painel privado tem uma seção de solicitações de agendamento com consulta por data, nome, WhatsApp, plano, observações e alternativas de agenda, em páginas de 50 registros. A API exige o mesmo acesso administrativo das avaliações. Os registros e seus dados pessoais ficam no banco excluído do Git, sem associação aos registros de acesso anônimos.

Os dias permitidos são segunda a sexta-feira, e os horários são selecionados em combo de 06:00 a 17:00, de hora em hora. Cada aula dura uma hora, portanto 17:00 é o último início disponível.
