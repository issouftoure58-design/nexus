import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CartIcon } from "@/components/cart/CartIcon";

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/services", label: "Services" },
  { href: "/galerie", label: "Galerie" },
  { href: "/a-propos", label: "À propos" },
  { href: "/reserver", label: "Réserver" },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("client_token");
    setIsLoggedIn(!!token);
  }, []);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-amber-100 bg-white/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/logo/logo-icon.svg"
              alt="Fat's Hair-Afro"
              className="h-12 w-12 group-hover:scale-105 transition-transform"
            />
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg text-gold-gradient">
                Fat's Hair-Afro
              </h1>
              <p className="text-xs text-zinc-500">Coiffure Afro à Franconville</p>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location === link.href
                    ? "bg-amber-100 text-amber-700"
                    : "text-zinc-600 hover:text-amber-600 hover:bg-amber-50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <CartIcon />
            <Link
              href={isLoggedIn ? "/mon-compte" : "/mon-compte/connexion"}
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <User className="h-4 w-4" />
              <span className="hidden lg:inline">{isLoggedIn ? "Mon Compte" : "Connexion"}</span>
            </Link>
            <a
              href="tel:+33939240269"
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden lg:inline">09 39 24 02 69</span>
            </a>
            <a
              href="https://wa.me/18302894929"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden lg:inline">WhatsApp</span>
            </a>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-amber-100 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                    location === link.href
                      ? "bg-amber-100 text-amber-700"
                      : "text-zinc-600 hover:text-amber-600 hover:bg-amber-50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={isLoggedIn ? "/mon-compte" : "/mon-compte/connexion"}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-4 py-3 mt-2 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <User className="h-4 w-4" />
                {isLoggedIn ? "Mon Compte" : "Connexion"}
              </Link>
              <div className="flex gap-2 mt-4 pt-4 border-t border-amber-100">
                <a
                  href="tel:+33939240269"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Appeler
                </a>
                <a
                  href="https://wa.me/18302894929"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
