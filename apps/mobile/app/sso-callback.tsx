import { Redirect } from 'expo-router';

/**
 * Where Google sign-in returns. On Android the browser session catches it first; on web the sign-in gate
 * (components/auth/auth-gate.tsx) finishes it. Either way, the fridge is next.
 */
export default function SsoCallback() {
  return <Redirect href="/" />;
}
