import { Nav } from '@/components/Nav';
import { About } from '@/components/About';
import { Footer } from '@/components/Footer';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <About />
      <Footer />
    </main>
  );
}
