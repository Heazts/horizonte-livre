# Horizonte Livre

**Estudar abre caminhos.**

Horizonte Livre é um espaço gratuito para encontrar recursos educacionais e
organizar os estudos. Começa com o ENEM e abre espaço para Encceja, matemática
e outras jornadas. O projeto foi pensado para funcionar em celular ou
computador, com interface leve e sem cadastro.

## O que está disponível

- Links diretos às páginas oficiais de provas e gabaritos do INEP para ENEM e
  Encceja e à página de provas e soluções da OBMEP.
- Índice pesquisável com downloads individuais de **564 arquivos de 9 coleções**.
  O tipo e o ano são sugestões extraídas do nome e podem precisar de revisão.
- Favoritos, lista de tarefas e cronômetro de foco. Favoritos e tarefas ficam
  neste navegador; não há contas nem sincronização.
- Uma cópia local dos arquivos do portal, após o primeiro acesso, quando o
  navegador permitir armazenamento. Os sites externos e os PDFs não ficam
  automaticamente disponíveis offline.

O responsável pelo projeto informou que a redistribuição das coleções foi
aprovada. Os arquivos são oferecidos como anexos da release do GitHub; os
originais locais permanecem preservados. A disponibilidade das provas
oficiais também depende de suas instituições.

## Executar localmente

Requer Node.js 22 ou mais recente e não exige instalar dependências:

```sh
npm run dev
```

Abra http://127.0.0.1:8080/. Se a porta estiver ocupada, encerre somente o
processo que você reconhecer antes de iniciar. Abrir `site/index.html`
diretamente pode impedir o carregamento da busca e do modo offline.

Para conferir o catálogo e rodar os testes:

```sh
npm run check
npm test
```

## Estrutura

```text
site/                     Portal estático e catálogo público
catalogo/permissoes.json  Decisões de publicação por recurso
catalogo/recursos.json    Inventário local ignorado pelo Git
acervo/triagem/           Arquivos extraídos, ignorados pelo Git
scripts/                  Extração, geração, validação e servidor local
docs/                     Políticas e roteiro
.github/workflows/        Verificação e publicação no GitHub Pages
```

## Atualizar o acervo

O inventário local é gerado por `scripts/extrair-acervo.ps1` a partir dos
ZIPs na pasta pai. Ele preserva a proveniência; não o execute sobre uma
extração já existente, porque o extrator não sobrescreve destinos.

Depois da revisão de um item, registre uma decisão em
`catalogo/permissoes.json` usando o ID do recurso. Para `link_para_fonte`,
informe `url` HTTPS, `fonte`, `titular` e `dataRevisao` (AAAA-MM-DD). Para
`autorizado`, informe também `licencaOuAutorizacao`, com comprovação. A URL
deve apontar para o recurso já disponibilizado pela fonte ou a uma cópia cuja
redistribuição tenha sido autorizada. Consulte a política antes de publicar.

```sh
npm run catalogo
npm run check
npm test
```

O gerador requer o inventário local e não faz upload de PDFs. O validador
funciona também em uma cópia do GitHub sem esse inventário. Arquivos novos
começam em revisão; decisões são guardadas separadamente para não serem
perdidas em uma nova extração.

## GitHub e publicação

Leia [o guia de publicação](docs/PUBLICAR_NO_GITHUB.md). A raiz do repositório
deve ser esta pasta, **não a pasta pai** que contém os ZIPs. Revise os nomes
expostos no catálogo e os resultados dos testes antes de publicá-lo. Os
workflows enviam apenas `site/` ao GitHub Pages e só publicam depois de validar
o catálogo.

Leia a [política de conteúdo](docs/POLITICA_DE_CONTEUDO.md), o
[compromisso de acessibilidade](docs/ACESSIBILIDADE.md) e o
[roteiro](docs/ROADMAP.md). Contribuições são bem-vindas conforme
[CONTRIBUTING.md](CONTRIBUTING.md).

O código tem licença MIT. Os materiais educacionais e as marcas citadas têm
suas próprias condições de uso; essa licença não se aplica a eles.
