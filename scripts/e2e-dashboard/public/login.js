const form = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const senhaInput = document.getElementById('login-senha');
const credentialsStep = document.getElementById('credentials-step');
const mfaStep = document.getElementById('mfa-step');
const subtitle = document.getElementById('subtitle');
const errorEl = document.getElementById('error');
const btnSubmit = document.getElementById('btn-submit');
const btnBack = document.getElementById('btn-back');
const otpInputs = [...document.querySelectorAll('#otp-inputs input')];

let mfaActive = false;

function showError(message) {
  if (!message) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function setLoading(loading) {
  btnSubmit.disabled = loading;
  btnSubmit.textContent = loading ? 'Entrando...' : mfaActive ? 'Confirmar MFA' : 'Entrar no painel';
}

function setMfaStep(active) {
  mfaActive = active;
  credentialsStep.classList.toggle('hidden', active);
  mfaStep.classList.toggle('hidden', !active);
  subtitle.textContent = active
    ? 'Informe o código de 6 dígitos do seu autenticador.'
    : 'Entre com sua conta de super administrador para acessar o dashboard de testes E2E.';
  btnSubmit.textContent = active ? 'Confirmar MFA' : 'Entrar no painel';
  if (active) {
    otpInputs[0]?.focus();
  } else {
    otpInputs.forEach((el) => (el.value = ''));
  }
}

function readOtp() {
  return otpInputs.map((el) => el.value.trim()).join('');
}

otpInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 1);
    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Backspace' && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });
  input.addEventListener('paste', (ev) => {
    ev.preventDefault();
    const digits = (ev.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    digits.split('').forEach((d, i) => {
      if (otpInputs[i]) otpInputs[i].value = d;
    });
    otpInputs[Math.min(digits.length, 5)]?.focus();
  });
});

btnBack.addEventListener('click', () => {
  showError('');
  setMfaStep(false);
});

async function checkSession() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.ok) {
    window.location.replace('/');
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showError('');

  const email = emailInput.value.trim();
  const senha = senhaInput.value;
  const totp = mfaActive ? readOtp() : undefined;

  if (!mfaActive && (!email || !senha)) {
    showError('Informe e-mail e senha.');
    return;
  }
  if (mfaActive && totp.length !== 6) {
    showError('Informe o código de 6 dígitos do autenticador.');
    return;
  }

  setLoading(true);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha, totp }),
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.mfaRequired) {
        setMfaStep(true);
        showError(data.error ?? 'Informe o código do autenticador (MFA).');
        return;
      }
      showError(data.error ?? 'Não foi possível entrar.');
      return;
    }
    window.location.replace('/');
  } catch {
    showError('Erro de rede ao tentar entrar.');
  } finally {
    setLoading(false);
  }
});

void checkSession();
