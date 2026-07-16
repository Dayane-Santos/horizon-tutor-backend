# Horizon Smart Tutors - Backend (MVP) 🧠

Este é o repositório de backend para a plataforma de gestão de tutores personalizados da **Oásis Tech & Horizon**, desenvolvido como parte do processo seletivo da DOT Digital Group.

A API fornece um sistema completo para o cadastro de tutores[cite: 1], gerenciamento de fontes de conhecimento via requisições HTTP em tempo real[cite: 1], manutenção de sessão ativa e histórico de conversas em banco local[cite: 1].

## 🛠️ Tecnologias e Arquitetura

- **Runtime:** Node.js com framework Express (Rápido, leve e de fácil manutenção).
- **Banco de Dados:** SQLite (Armazenamento em arquivo local nativo, garantindo portabilidade imediata)[cite: 1].
- **Orquestração de IA:** LangChain (Utilizado para estruturar prompts de sistema, carregar histórico de mensagens e gerenciar a execução do LLM)[cite: 1].
- **Estratégia Agêntica:** Em conformidade com o PRD, o sistema evita o uso de RAG vetorial clássico ou bancos vetoriais dedicados[cite: 1]. Em vez disso, o agente realiza um fetch em tempo real nas fontes de conhecimento configuradas, extraindo o contexto diretamente sob demanda para alimentar o prompt do modelo (GPT-3.5-Turbo ou superior)[cite: 1].

## ⚙️ Decisões de Arquitetura (Justificativas do PRD)

1. **Uso de SQLite:** Escolhido por sua simplicidade e por dispensar dependências de infraestrutura pesada para um MVP[cite: 1].
2. **LangChain:** Escolhido para garantir que o fluxo de conversação mantenha o contexto histórico de até 10 mensagens por sessão[cite: 1], de forma estruturada e em conformidade com as boas práticas de engenharia de prompt.
3. **Desenvolvimento Assistido por IA:** Conforme especificado na restrição de processo[cite: 1], este código foi desenvolvido de forma 100% assistida utilizando as ferramentas **Gemini** (concepção, arquitetura e lógica estrutural) e **Cursor** (refinamento de código e depuração em tempo real)[cite: 1].

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
