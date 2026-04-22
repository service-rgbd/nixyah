export const PASSWORD_POLICY_HINT = "8 caracteres minimum, avec au moins 2 chiffres et 1 caractere special.";

export function getPasswordPolicyError(password: string): string | null {
  if (password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caracteres.";
  }

  if ((password.match(/\d/g)?.length ?? 0) < 2) {
    return "Le mot de passe doit contenir au moins 2 chiffres.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins 1 caractere special.";
  }

  return null;
}
