const TELEMETRY_STORAGE_KEY = 'telaviva-telemetry-optin';

const getOptInState = () => {
  try {
    const stored = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    return stored ? stored === 'true' : true;
  } catch (error) {
    console.warn('Não foi possível ler a preferência de telemetria:', error);
    return true;
  }
};

const isTelemetryEnabled = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return getOptInState();
};

export const setTelemetryPreference = (enabled) => {
  try {
    localStorage.setItem(TELEMETRY_STORAGE_KEY, String(Boolean(enabled)));
  } catch (error) {
    console.warn('Não foi possível persistir a preferência de telemetria:', error);
  }
};

export const trackEvent = (name, payload = {}) => {
  if (!isTelemetryEnabled()) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[Telemetry] Evento:', name, payload);
  }

};

export const trackError = (error, context = {}) => {
  if (!error) {
    return;
  }

  const metadata = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    status: error.status,
    code: error.code,
    context,
  };

  if (!isTelemetryEnabled()) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Telemetry] Erro capturado:', metadata);
  }

};

export const withErrorTracking = async (operationName, fn) => {
  try {
    const result = await fn();
    trackEvent(operationName, { status: 'success' });
    return result;
  } catch (error) {
    trackError(error, { operationName });
    trackEvent(operationName, { status: 'error' });
    throw error;
  }
};


