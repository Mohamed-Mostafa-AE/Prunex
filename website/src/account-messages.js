export function friendlyAccountError(error, fallback) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) {
    return "That email and password don't match. Try again.";
  }
  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    return "Verify your email before signing in.";
  }
  if (code.includes("user_already_exists") || message.includes("already registered") || message.includes("already been registered")) {
    return "An account already uses that email. Sign in to continue.";
  }
  if (code.includes("otp_expired") || message.includes("expired") || message.includes("invalid token")) {
    return "That verification link has expired. Request a new one.";
  }
  if (code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Wait a little, then try again.";
  }
  if (code.includes("weak_password") || message.includes("password should") || message.includes("password is too weak")) {
    return "Choose a stronger password and try again.";
  }
  if (message.includes("manual linking") || message.includes("identity linking")) {
    return "Account linking is temporarily unavailable. Try again later.";
  }
  if (message.includes("redirect") || message.includes("not allowed")) {
    return "This account link isn't configured for this site. Contact support.";
  }
  if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) {
    return "Prunex couldn't reach the account service. Check your connection and try again.";
  }
  if (message.includes("valid email")) {
    return "Enter a valid email address.";
  }
  if (message.includes("at least 12 characters")) {
    return "Choose a password with at least 12 characters.";
  }
  if (message.includes("already has a permanent sign-in identity")) {
    return "This browser is already linked to an account. Sign in to continue.";
  }
  return fallback;
}
