// The /conta copy. The first block is fixed by the plan ("Valores fixados"); the rest is this page's own.

export const CONFIRM_WORD = 'EXCLUIR';
export const DELETE_TEXT = 'Isso apaga sua conta e toda a sua lista para sempre. Digite EXCLUIR para confirmar.';
export const CONFIRM_LABEL = 'Digite EXCLUIR';
export const DELETE_FOREVER = 'Excluir para sempre';
export const REAUTH_TEXT = 'Por segurança, entre de novo para excluir a conta.';
export const ACCOUNT_DELETED = 'Conta excluída.';
export const SIGN_OUT_ANYWAY = 'Sair mesmo assim';
/** "Sair" with actions still in the offline queue. */
export const unsentActions = (n: number) =>
  n === 1
    ? 'Você tem 1 ação não enviada. Sair agora descarta essa ação.'
    : `Você tem ${n} ações não enviadas. Sair agora descarta essas ações.`;

export const DELETE_ERROR = 'Não foi possível excluir sua conta agora. Tente de novo.';
export const WRONG_ACCOUNT = 'Entre com a mesma conta que você quer excluir.';
export const STALE_ACCOUNT = 'A conta aberta mudou em outra aba. Confira e tente de novo.';
export const PASSWORD_MISSING = 'Digite sua senha.';
export const EXPORT_ERROR = 'Não foi possível exportar seus dados. Tente de novo.';

export const PROVIDER_LABEL = { google: 'Google', password: 'E-mail e senha' } as const;
