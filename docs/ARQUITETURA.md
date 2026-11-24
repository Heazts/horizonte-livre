# Arquitetura

O portal é estático: HTML, CSS e JavaScript sem dependências externas. É
servido por `site/` e publicado pelo GitHub Pages. Os dados de tarefas e
favoritos ficam no `localStorage` do dispositivo; não há servidor de contas,
telemetria nem banco de dados.

```text
ZIPs locais → extrator → inventário local ─┐
                                           ├→ gerador → catálogo público → portal
                    decisões editoriais ───┘
```

O inventário técnico e o acervo são ignorados pelo Git. O catálogo público
contém apenas metadados selecionados, sem caminhos de arquivos locais. A
validação impede URLs para itens em revisão, exige HTTPS e decisão editorial
para acesso e licença ou autorização para redistribuição.

O service worker guarda somente a interface e o catálogo do próprio site
após o primeiro acesso bem-sucedido. Não armazena sites externos ou PDFs. O
funcionamento depende de HTTPS ou localhost e do armazenamento permitido pelo
navegador; não garante acesso em aparelhos sem conexão inicial.

Para uma fase futura, um banco pode modelar fontes, coleções, recursos,
permissões, provas, questões e gabaritos. Cada conteúdo precisará de origem
e permissão antes da publicação; progresso pessoal deve permanecer local por
padrão. Nenhum banco ou simulado interativo de questões está implementado.
