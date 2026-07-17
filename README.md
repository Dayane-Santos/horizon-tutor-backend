# Horizon Smart Tutors - Backend (MVP) 🧠

Este é o repositório de backend para a plataforma de gestão de tutores personalizados, desenvolvido como parte do processo seletivo da DOT Digital Group.

A API fornece um sistema completo para o cadastro de tutores[cite: 1], gerenciamento de fontes de conhecimento via requisições HTTP em tempo real[cite: 1], manutenção de sessão ativa e histórico de conversas em banco local[cite: 1].

## 🗺️ Diagrama de Arquitetura (Item 8.a)

[ Painel Admin ] (admin.html)  --- (Gerencia Tutores via REST API) ---\
                                                                             |
                                                                             v
[ Navegador ] ---> [ Site Integrador (Host) ] ---> [ iframe (widget.html) ] ---> [ Backend Express (server.js) ]
                                                            ^                     | (Orquestração LangChain)
                                                            |                     |
                                                     (Histórico na             [ SQLite ] (Banco Local)
                                                        Sessão)                   |
                                                            |                     v
                                                            \------------- [ OpenAI API ] (LLM)
                                                                                  | (Estratégia Agêntica)
                                                                                  v
                                                                           [ URL da Fonte ] (txt/json)

## 🛠️ Tecnologias e Arquitetura

- **Runtime:** Node.js com framework Express (Rápido, leve e de fácil manutenção).
- **Banco de Dados:** SQLite (Armazenamento em arquivo local nativo, garantindo portabilidade imediata)[cite: 1].
- **Orquestração de IA:** LangChain (Utilizado para estruturar prompts de sistema, carregar histórico de mensagens e gerenciar a execução do LLM)[cite: 1].
- **Estratégia Agêntica:** Em conformidade com o PRD, o sistema evita o uso de RAG vetorial clássico ou bancos vetoriais dedicados[cite: 1]. Em vez disso, o agente realiza um fetch em tempo real nas fontes de conhecimento configuradas, extraindo o contexto diretamente sob demanda para alimentar o prompt do modelo (GPT-3.5-Turbo ou superior)[cite: 1].

## ⚙️ Decisões de Arquitetura (Justificativas do PRD)

1. **Uso de SQLite:** Escolhido por sua simplicidade e por dispensar dependências de infraestrutura pesada para um MVP[cite: 1].
2. **LangChain:** Escolhido para garantir que o fluxo de conversação mantenha o contexto histórico de até 10 mensagens por sessão[cite: 1], de forma estruturada e em conformidade com as boas práticas de engenharia de prompt.
3. **Desenvolvimento Assistido por IA:** Conforme especificado na restrição de processo[cite: 1], este código foi desenvolvido de forma 100% assistida utilizando as ferramentas **Gemini** (concepção, arquitetura e lógica estrutural) e **Cursor** (refinamento de código e depuração em tempo real)[cite: 1].
4. **Omissão de Rate Limit (Segurança):** Optou-se por omitir um middleware de rate limit complexo neste MVP para priorizar a simplicidade da entrega inicial. Para produção, recomenda-se a implementação de um limitador de requisições por IP utilizando Redis ou o pacote express-rate-limit.
5. **Formatação e Qualidade (Item 5.c):** O código foi integralmente formatado utilizando extensões de Prettier/ESLint integradas diretamente no editor de código assistido (Cursor) durante todo o fluxo de desenvolvimento.

## 🚀 Como Rodar o Projeto Localmente

1. Clone este repositório.
2. Instale as dependências executando:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` na raiz do projeto com a chave da OpenAI:
   ```env
   OPENAI_API_KEY=sua_chave_openai
   PORT=3001
   ```
   > A variável `PORT` é opcional e, se omitida, o servidor utiliza a porta `3001` por padrão.
4. Inicie o servidor:
   ```bash
   npm start
   ```
5. Na primeira execução, o SQLite cria automaticamente o arquivo `database.sqlite` com as tabelas `tutores` e `historico`.

O servidor estará disponível em `http://localhost:3001`.

## 🔮 Próximos Passos para Evolução em Produção (Item 8.b)

Caso o MVP evolua para um produto comercial e escalável em ambiente de produção, as seguintes melhorias são planejadas:

1. **Migração do Banco de Dados:** Substituir o SQLite por um banco relacional robusto (PostgreSQL) para suportar múltiplas conexões simultâneas e garantir alta disponibilidade.
2. **Isolamento de Tenant (Multi-tenancy):** Implementar isolamento lógico de dados para garantir que clientes diferentes não consigam visualizar ou acessar tutores de outras organizações.
3. **Segurança Avançada e Autenticação:** Implementar autenticação JWT de duas vias para a comunicação entre o host pai e o widget, evitando spoofing de identidade de tutor.
4. **Cache de Fontes de Conhecimento:** Implementar uma camada de cache (Redis) para as fontes HTTP externas, evitando realizar um novo fetch a cada mensagem enviada na mesma sessão (o que reduz latência e consumo de banda).
5. **Rate Limiting Real:** Adicionar limitação de requisições por endereço IP e por API Key de cliente para evitar ataques de negação de serviço (DoS) e controle de custos de API.
