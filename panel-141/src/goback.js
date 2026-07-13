'use strict';
// Ctrl+N = voltar em qualquer tela
// Funciona interceptando keypress antes de inquirer resolver o prompt atual.

let _flag = false;

function setup() {
  // inquirer ja chama readline.emitKeypressEvents(stdin) ao iniciar.
  // Precisamos esperar o primeiro prompt abrir antes de ouvir.
  // Usamos o evento 'keypress' que o inquirer habilita.
  process.stdin.on('keypress', (str, key) => {
    if (key && key.ctrl && key.name === 'n') {
      _flag = true;
      // Emite um Enter falso para desbloquear o prompt atual
      process.stdin.emit('keypress', '\r', {
        name: 'return', ctrl: false, shift: false, meta: false,
      });
    }
  });
}

// Chama apos cada prompt. Retorna true e reseta o flag se Ctrl+N foi pressionado.
function voltou() {
  if (_flag) { _flag = false; return true; }
  return false;
}

module.exports = { setup, voltou };
