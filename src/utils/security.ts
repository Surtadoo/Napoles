// Proteção de código, anti-debug, anti-inspeção e ofuscação em runtime
export function initAntiInspectionAndProtection() {
  if (typeof window === 'undefined') return;

  // 1. Bloquear menu de contexto do botão direito
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // 2. Bloquear atalhos de desenvolvedor: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+Shift+C
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K
    if (e.ctrlKey && e.shiftKey && (
      e.key === 'I' || e.key === 'i' ||
      e.key === 'J' || e.key === 'j' ||
      e.key === 'C' || e.key === 'c' ||
      e.key === 'K' || e.key === 'k'
    )) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Command/Mac shortcuts
    if (e.metaKey && e.altKey && (
      e.key === 'I' || e.key === 'i' ||
      e.key === 'J' || e.key === 'j' ||
      e.key === 'C' || e.key === 'c' ||
      e.key === 'U' || e.key === 'u'
    )) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U (Ver código-fonte)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S (Salvar página)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  // 3. Limpeza constante do console
  const clearConsoleLoop = () => {
    try {
      if (typeof console !== 'undefined') {
        console.clear();
        console.log('%c[LIVEDC SECURITY SHIELD]', 'color: #10b981; font-weight: bold; font-size: 14px;', 'Código protegido e criptografado.');
      }
    } catch {
      // Ignora erro
    }
  };
  setInterval(clearConsoleLoop, 2500);

  // 4. Detecção básica de DevTools aberta
  let devtoolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
      }
    } else {
      devtoolsOpen = false;
    }
  }, 1000);
}
