# Antes de publicar

1. Revise `site/catalogo.json`, `catalogo/permissoes.json`, os textos e as
   políticas. Nome de arquivo ou metadado também pode expor informação
   pessoal. Confirme os direitos antes de divulgar qualquer cópia.
2. Execute `npm run check`, `npm test` e, com o inventário local disponível,
   `node scripts/gerar-catalogo.mjs --check`.
3. Crie o repositório com **esta pasta do projeto como raiz**. Os ZIPs estão
   na pasta pai e nunca devem ser adicionados ao histórico.
4. Verifique os arquivos que o Git vai incluir com `git status --short` e
   `git check-ignore` para o acervo e `catalogo/recursos.json`. `.gitignore`
   não remove arquivos já rastreados; revise o histórico caso eles já tenham
   sido adicionados.
5. Configure um contato privado de segurança e remoção. Revise a licença do
   código e as condições de cada recurso publicado.
6. Após enviar o código, em Settings → Pages → Build and deployment, escolha
   GitHub Actions. O workflow valida o catálogo e publica somente `site/`.
   Acompanhe a execução em Actions e abra a URL fornecida pelo Pages.

O projeto não contém conta de usuário nem backend. Criar o repositório,
enviar código e configurar o Pages são passos separados de simplesmente
preparar os arquivos locais.
