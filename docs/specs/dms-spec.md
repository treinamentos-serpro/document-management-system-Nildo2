# Especificação - Document Management System

> Especificação funcional e técnica do MVP, derivada de `spec-template.md` e das convenções atuais do repositório.

## 1. Objetivo

Oferecer uma aplicação web simples para que usuários enviem documentos, consultem os próprios envios e baixem documentos armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos pertencentes ao usuário identificado na requisição.
- Download de um documento pertencente ao usuário identificado na requisição.
- Isolamento lógico dos registros por identificador de usuário.
- Interface React para upload, listagem e download, consumindo a API via `fetch` e o prefixo `/api` do proxy Vite.
- Armazenamento dos binários em `backend/storage` e dos metadados em memória durante a execução do processo.

### Fora do escopo

- Provedores externos, armazenamento em nuvem ou banco de dados.
- Persistência de metadados após reinício do backend.
- Autenticação, cadastro de contas, recuperação de senha e gestão de credenciais.
- Versionamento, compartilhamento entre usuários, pastas, busca avançada e edição de documentos.
- Conversão, visualização ou processamento do conteúdo dos arquivos.
- Exclusão de documentos pela interface ou pela API nesta versão.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | A aplicação deve aceitar o envio de um único arquivo por requisição. | Uma requisição válida cria um identificador único, grava o arquivo localmente e retorna os metadados do documento. |
| RF-02 | O upload deve exigir um identificador de usuário não vazio. | Sem `X-User-Id`, a API retorna `400` e não mantém arquivo nem metadados do envio. |
| RF-03 | O sistema deve rejeitar upload sem arquivo, arquivo vazio ou arquivo acima do limite configurado. | A API retorna erro documentado e não deixa arquivo parcial ou registro persistido em memória. |
| RF-04 | A aplicação deve listar os documentos do usuário identificado. | A resposta inclui somente documentos cujo `owner` corresponde ao `X-User-Id` da requisição. |
| RF-05 | A aplicação deve permitir baixar um documento por identificador. | Um usuário proprietário recebe o conteúdo binário com cabeçalhos de download apropriados. |
| RF-06 | O sistema deve impedir que um usuário baixe documento pertencente a outro usuário. | Para documento inexistente ou pertencente a outro usuário, a API retorna `404`, sem revelar a existência do registro. |
| RF-07 | O frontend deve apresentar o estado da operação e erros retornados pela API. | Upload, listagem e download têm feedback de sucesso ou falha; a listagem pode ser atualizada após upload. |
| RF-08 | O sistema deve manter o endpoint existente de verificação de saúde. | `GET /health` continua respondendo com estado saudável quando o backend está disponível. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos enviados devem ser gravados somente no filesystem local, usando Multer com `diskStorage`; o diretório padrão é `backend/storage`. |
| RNF-02 | Os metadados devem permanecer em memória nesta fase. Reiniciar o backend invalida a listagem e os downloads registrados, ainda que arquivos antigos continuem no disco. |
| RNF-03 | A configuração operacional deve usar variáveis de ambiente, incluindo `PORT`, `DMS_STORAGE_DIR` e `MAX_FILE_SIZE_BYTES`. |
| RNF-04 | O limite padrão de upload deve ser 10 MiB (`10485760` bytes), substituível por `MAX_FILE_SIZE_BYTES` com valor inteiro positivo. |
| RNF-05 | O nome físico do arquivo deve ser gerado pelo servidor a partir de um identificador imprevisível; o nome original não pode ser usado como caminho físico. |
| RNF-06 | Caminhos de armazenamento devem ser resolvidos e validados no backend. Entradas do cliente não podem selecionar caminhos ou escapar do diretório configurado. |
| RNF-07 | A API deve responder em JSON para erros e metadados, e em conteúdo binário somente para downloads bem-sucedidos. Mensagens destinadas ao usuário devem estar em português. |
| RNF-08 | O código backend deve usar CommonJS e manter a separação `routes -> controllers -> services -> repositories`; as camadas internas não devem depender de Express ou de detalhes HTTP. |
| RNF-09 | O frontend deve usar componentes funcionais e Hooks, com chamadas HTTP centralizadas em `services/` e sem acessar o filesystem diretamente. |
| RNF-10 | O MVP pressupõe ambiente local ou confiável. `X-User-Id` identifica logicamente o proprietário, mas não autentica o usuário nem constitui proteção contra falsificação do cabeçalho. |

## 5. Modelo de dados

### Documento (registro em memória)

| Campo | Tipo | Visibilidade | Descrição |
| --- | --- | --- | --- |
| `id` | string (UUID) | API e interno | Identificador único criado pelo servidor. |
| `originalName` | string | API e interno | Nome do arquivo informado pelo cliente, tratado como dado e nunca como caminho. |
| `size` | number | API e interno | Tamanho do arquivo em bytes. |
| `uploadedAt` | string (ISO 8601 UTC) | API e interno | Data e hora em que o upload foi aceito. |
| `owner` | string | API e interno | Identificador obtido de `X-User-Id`. |
| `storedName` | string | Somente interno | Nome físico gerado pelo servidor e usado para localizar o arquivo no diretório de armazenamento. Não deve ser retornado pela API. |

- O repositório em memória associa `id` aos metadados e ao nome físico armazenado.
- Os dados de entrada não podem definir `id`, `owner`, `uploadedAt` ou `storedName`.
- A ordenação da listagem é decrescente por `uploadedAt`; em empate, a implementação deve manter uma ordenação determinística.
- Os registros desaparecem ao encerrar ou reiniciar o processo. A remoção automática dos arquivos órfãos deixados por reinícios não faz parte do MVP.

## 6. Contratos de API

### Convenções comuns

- O frontend chama os caminhos públicos abaixo sob `/api`. O proxy de desenvolvimento Vite remove esse prefixo e encaminha a requisição ao backend local.
- Rotas internas do Express: `POST /upload`, `GET /documents` e `GET /documents/:id/download`.
- Requisições que operam sobre dados de usuário exigem `X-User-Id` com valor não vazio. Espaços externos podem ser removidos; valor vazio após normalização é inválido.
- Respostas de erro usam o formato `{ "error": { "code": "CODIGO", "message": "Mensagem em português" } }`.
- A API não implementa autenticação. O cabeçalho de usuário é uma convenção de identidade para o MVP local, não uma credencial confiável.

### `POST /api/upload`

Rota backend: `POST /upload`.

- Cabeçalho: `X-User-Id: <identificador>`.
- Entrada: `multipart/form-data`, campo de arquivo obrigatório chamado `file`, com exatamente um arquivo.
- Limite: `MAX_FILE_SIZE_BYTES`; padrão de 10 MiB. Não há allowlist de extensões nesta versão. Arquivos vazios são rejeitados.
- Sucesso: `201 Created`, `Content-Type: application/json`.

```json
{
  "data": {
    "id": "uuid",
    "originalName": "relatorio.pdf",
    "size": 2048,
    "uploadedAt": "2026-10-06T12:00:00.000Z",
    "owner": "usuario-123"
  }
}
```

Erros previstos:

| HTTP | Código | Condição |
| --- | --- | --- |
| `400` | `USER_ID_REQUIRED` | Cabeçalho ausente ou vazio. |
| `400` | `FILE_REQUIRED` | Campo `file` ausente ou arquivo vazio. |
| `400` | `TOO_MANY_FILES` | Mais de um arquivo enviado. |
| `413` | `FILE_TOO_LARGE` | Arquivo excede o limite configurado. |
| `500` | `STORAGE_ERROR` | Falha ao gravar o arquivo ou registrar os metadados. |

Em falha após gravação do arquivo, o backend deve tentar remover o arquivo parcial para evitar órfãos criados pela própria requisição.

### `GET /api/documents`

Rota backend: `GET /documents`.

- Cabeçalho: `X-User-Id: <identificador>`.
- Sucesso: `200 OK`, `Content-Type: application/json`.
- A resposta contém uma lista, inclusive quando vazia, filtrada pelo proprietário.

```json
{
  "data": [
    {
      "id": "uuid",
      "originalName": "relatorio.pdf",
      "size": 2048,
      "uploadedAt": "2026-10-06T12:00:00.000Z",
      "owner": "usuario-123"
    }
  ]
}
```

Erros previstos: `400 USER_ID_REQUIRED` para cabeçalho ausente ou vazio; `500 INTERNAL_ERROR` para falha inesperada ao consultar os metadados.

### `GET /api/documents/:id/download`

Rota backend: `GET /documents/:id/download`.

- Cabeçalho: `X-User-Id: <identificador>`.
- Sucesso: `200 OK`, corpo binário, `Content-Disposition: attachment` com nome original devidamente sanitizado e `Content-Type` conhecido ou `application/octet-stream`.
- O arquivo só pode ser localizado pelo registro interno e pelo nome físico gerado pelo servidor.

Erros previstos: `400 USER_ID_REQUIRED` para cabeçalho ausente ou vazio; `404 DOCUMENT_NOT_FOUND` se o identificador não existir, pertencer a outro usuário ou se o arquivo registrado não estiver disponível; `500 STORAGE_ERROR` para falha de leitura não classificada como ausência.

### `GET /health`

- Sem autenticação ou `X-User-Id`.
- Sucesso: `200 OK`, JSON `{ "status": "ok" }`.

## 7. Decisões arquiteturais

### Backend

- `routes/`: registra caminhos, middleware de upload e encaminhamento ao controller.
- `controllers/`: lê parâmetros e cabeçalhos HTTP, aplica validação básica e traduz resultados/erros em respostas HTTP.
- `services/`: aplica regras de negócio, propriedade dos documentos, validações e coordena armazenamento e metadados.
- `repositories/`: grava e lê binários no filesystem local e mantém os metadados em memória.
- A composição das dependências e middlewares fica no ponto de entrada Express. Serviços e repositórios não devem conhecer `req`, `res` ou tipos específicos do Express.
- Multer deve usar `diskStorage` apontado para o diretório local configurado; nenhum serviço de terceiros pode receber ou armazenar os arquivos.

### Frontend

- Componentes React funcionais organizados em componentes, páginas e serviços.
- O serviço HTTP centraliza `fetch`, prefixo `/api`, `X-User-Id`, tratamento de erros e operações de documentos.
- A interface permite selecionar e enviar um arquivo, consultar a lista e iniciar download; não acessa diretamente o filesystem.

### Identidade e segurança

- Para viabilizar o isolamento lógico sem introduzir autenticação fora do escopo, o cliente fornece `X-User-Id` nas operações de documento.
- Como o cliente pode forjar esse valor, essa estratégia não é adequada para uma implantação exposta a usuários não confiáveis. Autenticação e autorização fortes ficam como evolução futura e devem substituir essa convenção antes de exposição pública.

## 8. Plano de execução

1. Definir configuração, composição da aplicação e contratos comuns de erro, preservando `GET /health`.
2. Implementar persistência local de arquivos com Multer `diskStorage` e repositório de metadados em memória; definir geração de nomes físicos e limpeza em falhas.
3. Implementar os casos de uso de upload, listagem filtrada por proprietário e download com validação de propriedade.
4. Expor os casos de uso nas rotas e controllers Express, tratando limites do Multer, códigos HTTP e respostas JSON/binárias.
5. Construir a interface React de upload, listagem, feedback de erros e download, consumindo os contratos via `fetch` e `/api`.
6. Integrar frontend e backend pelo proxy Vite e verificar os fluxos completos, erros, isolamento entre proprietários e comportamento após reinício.

> Este plano é uma sequência futura de trabalho. Nesta entrega, somente este documento de especificação é criado; nenhum arquivo de implementação do backend ou frontend faz parte do escopo.

## 9. Critérios de aceite do MVP

- Um usuário pode enviar arquivo válido e recebe metadados com identificador único.
- O arquivo é gravado somente no diretório local configurado e o nome original não controla seu caminho físico.
- A listagem mostra apenas os documentos do `X-User-Id` informado e retorna lista vazia quando não há registros.
- O proprietário consegue baixar o conteúdo com nome de download apropriado; outro identificador não consegue acessar o documento.
- Entradas ausentes, arquivo vazio, excesso de tamanho e falhas de armazenamento retornam erros documentados e não expõem detalhes internos.
- O proxy Vite encaminha os caminhos `/api` para as rotas Express correspondentes.
- O comportamento de perda dos metadados após reinício está documentado e é aceito para o MVP.
