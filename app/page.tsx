import { redirect } from 'next/navigation';

// Phase 1: redirect to lobby directly
// Phase 2: this will become the Splash/Auth screen
export default function Home() {
  redirect('/lobby');
}
