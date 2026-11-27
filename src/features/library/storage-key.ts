/**
 * Where the visitor's library lives in localStorage. The local repository reads and writes it, the sign-in merge
 * folds it into the account, and deleting the account removes it from this device.
 */
export const GUEST_LIBRARY_KEY = 'telaviva:library:v1';
