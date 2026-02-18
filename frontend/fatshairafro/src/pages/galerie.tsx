import { Link } from "wouter";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import Gallery from "@/components/Gallery";
import { Calendar, ArrowRight } from "lucide-react";

export default function GaleriePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Full Cinematic Gallery */}
      <div className="pt-16">
        <Gallery showHeader={true} showFilters={true} cinematicStyle={true} />
      </div>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-zinc-950 to-zinc-900">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <span className="inline-block px-4 py-1.5 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-full mb-4 border border-amber-500/30">
            Envie du même résultat ?
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Réservez votre <span className="text-amber-500">transformation</span>
          </h2>
          <p className="text-white/60 mb-8 max-w-2xl mx-auto">
            Partagez une photo de la galerie avec Halimah et elle vous proposera le service adapté.
            Chaque coiffure est personnalisée selon vos envies.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/reserver">
              <Button size="lg" className="btn-african px-10">
                <Calendar className="mr-2 h-5 w-5" />
                Réserver avec Halimah
              </Button>
            </Link>
            <Link href="/services">
              <Button size="lg" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                Voir les tarifs
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
