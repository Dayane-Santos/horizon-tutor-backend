const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==================== TRATAMENTO SEGURO DA CHAVE DA API ====================
// Lê do .env de forma segura e remove espaços ou aspas que possam quebrar a requisição
const rawKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, "") : "";

if (!apiKey) {
  console.error("\n❌ [ERRO CRÍTICO] Nenhuma chave de API foi encontrada no seu arquivo .env!");
} else {
  console.log(`\n✅ [OK] Chave de API detectada com sucesso! Começa com: ${apiKey.substring(0, 6)}...\n`);
}
// ===========================================================================

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
    res.json({ message: 'Tutor updated successfully!' });
  });
});

// ==================== ENGINE DO AGENTE DE CHAT ====================

// Função auxiliar para buscar conhecimento externo de URLs
async function buscarConhecimentoExterno(url) {
  if (!url) return "";
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const text = await response.text();
    return text.substring(0, 3000); // Limita o tamanho para evitar estourar o contexto
  } catch (error) {
    console.error("Erro ao buscar fonte de conhecimento:", error);
    return "";
  }
}

// Rota de Conversação do Widget (Iframe) utilizando chamada direta à API do Gemini
app.post('/api/chat', async (req, res) => {
  const { tutorId, sessionId, message } = req.body;
  console.log(`[LOG - CHAT] Nova mensagem recebida. Sessão: ${sessionId} | Tutor: ${tutorId}`);

  if (!tutorId || !message) {
    return res.status(400).json({ error: "Faltando parâmetros obrigatórios." });
  }

  // 1. Recuperar as diretrizes do Tutor do Banco de Dados
  db.get(`SELECT * FROM tutores WHERE id = ? AND status = 'ativo'`, [tutorId], async (err, tutor) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!tutor) return res.status(404).json({ error: 'Tutor inativo ou não encontrado.' });

    // 2. Buscar histórico recente para manter a memória da conversa (últimas 10 mensagens)
    db.all(`SELECT role, content FROM historico WHERE session_id = ? AND tutor_id = ? ORDER BY timestamp DESC LIMIT 10`, 
    [sessionId, tutorId], async (err, historyRows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Inverter a ordem das linhas para que fiquem em ordem cronológica (antigas primeiro)
      const history = historyRows.reverse().map(row => {
        return {
          role: row.role === 'user' ? 'user' : 'model',
          parts: [{ text: row.content }]
        };
      });

      // 3. Buscar o conteúdo da fonte HTTP se existir
      let contextoAdicional = "";
      if (tutor.fonte_url) {
        contextoAdicional = await buscarConhecimentoExterno(tutor.fonte_url);
      }

      // 4. Injetar as instruções de persona e RAG diretamente na estrutura de mensagens
      const systemInstructionText = `INSTRUÇÕES DE PERSONA (Siga estritamente):
Você é um Tutor Inteligente com as seguintes diretrizes:
${tutor.instrucoes}

${contextoAdicional ? `Use as seguintes informações coletadas da sua base de dados/fonte para enriquecer sua resposta:\n${contextoAdicional}` : ''}

Responda de forma direta e amigável, alinhada à sua persona.
---`;

      // Preparamos o payload injetando a instrução inicial para o modelo aceitar o contexto de forma universal
      const contents = [];
      
      contents.push({
        role: 'user',
        parts: [{ text: `${systemInstructionText}\n\nEntendido. Responda apenas "Entendi as instruções e estou pronto para conversar."` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: "Entendi as instruções e estou pronto para conversar." }]
      });

      // Adiciona o histórico de conversas anterior
      contents.push(...history);

      // Adiciona a nova mensagem enviada pelo usuário
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      try {
        if (!apiKey) {
          throw new Error("Chave de API do Gemini não configurada.");
        }

        // 5. Chamada direta de API usando a rota v1beta com a chave segura
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: contents,
              generationConfig: {
                temperature: 0.3
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Erro na API do Gemini");
        }

        const reply = data.candidates[0].content.parts[0].text;

        // 6. Salvar as novas interações no histórico do banco SQLite
        db.serialize(() => {
          db.run(`INSERT INTO historico (session_id, tutor_id, role, content) VALUES (?, ?, 'user', ?)`, [sessionId, tutorId, message]);
          db.run(`INSERT INTO historico (session_id, tutor_id, role, content) VALUES (?, ?, 'assistant', ?)`, [sessionId, tutorId, reply]);
        });

        res.json({ reply });

      } catch (llmError) {
        console.error("Erro ao chamar o Gemini diretamente:", llmError.message);
        res.status(500).json({ error: "Erro interno no processamento do Tutor." });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));