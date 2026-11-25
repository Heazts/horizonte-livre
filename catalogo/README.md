# Catálogo e decisões

- `recursos.json`: inventário técnico local, gerado a partir dos ZIPs. Contém
  caminhos e nomes de origem e é ignorado pelo Git.
- `permissoes.json`: decisões editoriais por ID de recurso, incluindo a confirmação
  informada pelo responsável pelo projeto para o acervo inicial.
- `../site/catalogo.json`: versão pública sem caminhos locais, gerada com
  `npm run catalogo` e validada com `npm run check`.

Uma decisão de acesso deve conter `status`, `url`, `fonte`, `titular` e
`dataRevisao`. Uma decisão `autorizado` requer também
`licencaOuAutorizacao`. A URL deve usar HTTPS. Ao alterar uma decisão, gere
novamente o catálogo e faça a validação. Consulte a política de conteúdo.

A classificação e o ano são inferidos do caminho dentro do ZIP. Se houver
anos conflitantes, o ano permanece desconhecido. Estas informações são
sugestões, não conferência do conteúdo dos PDFs.
