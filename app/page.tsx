import { redirect } from 'next/navigation';

// The (app) layout sends a visitor without a session to /login.
export default function Home() {
  redirect('/dashboard');
}
