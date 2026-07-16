const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { ChatOpenAI } = require('@langchain/openai');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { AIMessage, HumanMessage } = require('@langchain/core/messages');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Inicialização do Banco de Dados SQLite (Local)
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('Erro ao conectar no SQLite:', err.message);
  else console.log('Conectado ao banco SQLite local.');
});

// Criar tabelas de Tutores e Histórico de Conversas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tutores (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo',
      instrucoes TEXT NOT NULL,
      fonte_url TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tutor_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ==================== CRUD DE TUTORES ====================

// Criar Tutor
app.post('/api/tutores', (req, res) => {
  const { id, titulo, instrucoes, fonte_url } = req.body;
  const sql = `INSERT INTO tutores (id, titulo, status, instrucoes, fonte_url) VALUES (?, ?, 'ativo', ?, ?)`;
  db.run(sql, [id, titulo, instrucoes, fonte_url], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Tutor criado com sucesso!' });
  });
});

// Listar Tutores
app.get('/api/tutores', (req, res) => {
  db.all(`SELECT * FROM tutores`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obter Tutor por ID
app.get('/api/tutores/:id', (req, res) => {
  db.get(`SELECT * FROM tutores WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Tutor não encontrado' });
    res.json(row);
  });
});

// Atualizar/Desativar Tutor
app.put('/api/tutores/:id', (req, res) => {
  const { status, instrucoes, fonte_url } = req.body;
  const sql = `UPDATE tutores SET status = ?, instrucoes = ?, fonte_url = ? WHERE id = ?`;
  db.run(sql, [status, instrucoes, fonte_url, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tutor atualizado com sucesso!' });
  });
});

// ==================== ENGINE DO AGENTE DE CHAT ====================

// Função auxiliar para o Agente simular busca de conhecimento sem banco vetorial (RAG via Agent Tools)
async function buscarConhecimentoExterno(url) {
  if (!url) return "";
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const text = await response.text();
    return text.substring(0, 3000); // Limita o tamanho do texto para não estourar o contexto da LLM
  } catch (error) {
    console.error("Erro ao buscar fonte de conhecimento:", error);
    return "";
  }
}

// Rota de Conversação do Widget (Iframe)
app.post('/api/chat', async (req, res) => {
  const { tutorId, sessionId, message } = req.body;

  if (!tutorId || !message) {
    return res.status(400).json({ error: "Faltando parâmetros obrigatórios." });
  }

  // 1. Recuperar as diretrizes do Tutor do Banco de Dados
  db.get(`SELECT * FROM tutores WHERE id = ? AND status = 'ativo'`, [tutorId], async (err, tutor) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!tutor) return res.status(404).json({ error: 'Tutor inativo ou não encontrado.' });

    // 2. Buscar histórico recente da sessão para manter o contexto
    db.all(`SELECT role, content FROM historico WHERE session_id = ? AND tutor_id = ? ORDER BY timestamp DESC LIMIT 10`, 
    [sessionId, tutorId], async (err, historyRows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Inverter a ordem para ficar cronológica
      const history = historyRows.reverse().map(row => {
        return row.role === 'user' ? new HumanMessage(row.content) : new AIMessage(row.content);
      });

      // 3. Estratégia Agêntica: Buscar o conteúdo da fonte HTTP se existir
      let contextoAdicional = "";
      if (tutor.fonte_url) {
        contextoAdicional = await buscarConhecimentoExterno(tutor.fonte_url);
      }

      // 4. Configurar a LLM e o Prompt Template via LangChain
      const model = new ChatOpenAI({
        model: 'gpt-3.5-turbo', // Ou 'gpt-4o-mini'
        temperature: 0.3,
      });

      const promptSystem = `
        Você é um Tutor Inteligente com as seguintes diretrizes:
        ${tutor.instrucoes}

        ${contextoAdicional ? `Use as seguintes informações coletadas da sua base de dados/fonte para enriquecer sua resposta:\n${contextoAdicional}` : ''}
        
        Responda de forma direta e amigável, alinhada à sua persona.
      `;

      const chatPrompt = ChatPromptTemplate.fromMessages([
        ["system", promptSystem],
        new MessagesPlaceholder("history"),
        ["human", "{input}"]
      ]);

      try {
        const chain = chatPrompt.pipe(model);
        const response = await chain.invoke({
          history: history,
          input: message
        });

        const reply = response.content;

        // 5. Salvar a nova interação no histórico do banco SQLite
        db.serialize(() => {
          db.run(`INSERT INTO historico (session_id, tutor_id, role, content) VALUES (?, ?, 'user', ?)`, [sessionId, tutorId, message]);
          db.run(`INSERT INTO historico (session_id, tutor_id, role, content) VALUES (?, ?, 'assistant', ?)`, [sessionId, tutorId, reply]);
        });

        res.json({ reply });

      } catch (llmError) {
        console.error("Erro na chamada da LLM:", llmError);
        res.status(500).json({ error: "Erro interno no processamento do Tutor." });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
