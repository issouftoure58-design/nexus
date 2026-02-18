import { Link } from 'wouter';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export function CartIcon() {
  const { itemCount } = useCart();

  return (
    <Link href="/panier">
      <Button
        variant="ghost"
        size="icon"
        className="relative text-zinc-700 hover:text-amber-600 hover:bg-amber-50"
      >
        <ShoppingBag className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center animate-in zoom-in-50 duration-200">
            {itemCount > 9 ? '9+' : itemCount}
          </span>
        )}
        <span className="sr-only">Panier ({itemCount} articles)</span>
      </Button>
    </Link>
  );
}
