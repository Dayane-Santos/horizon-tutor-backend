// Teste automatizado simples usando o módulo nativo do Node.js (Item 5.c)
const test = require('node:test');
const assert = require('node:assert');

test('Validando estrutura de mock de resposta do Tutor', async (t) => {
  const mockResposta = { reply: "Olá! Como posso te ajudar hoje?" };
  
  assert.strictEqual(typeof mockResposta.reply, 'string');
  assert.ok(mockResposta.reply.length > 0, 'A resposta do tutor não pode ser vazia');
});