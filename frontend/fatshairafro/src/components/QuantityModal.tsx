import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Minus, Plus } from 'lucide-react';

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, totalPrice: number, totalDuration: number) => void;
  serviceName: string;
  pricePerUnit: number; // en euros
  durationPerUnit: number; // en minutes
  unitName: string;
}

export function QuantityModal({
  isOpen,
  onClose,
  onConfirm,
  serviceName,
  pricePerUnit,
  durationPerUnit,
  unitName,
}: QuantityModalProps) {
  const [quantity, setQuantity] = useState(1);

  const totalPrice = quantity * pricePerUnit;
  const totalDuration = quantity * durationPerUnit;

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}`;
  };

  useEffect(() => {
    if (isOpen) setQuantity(1);
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(quantity, totalPrice, totalDuration);
    onClose();
  };

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value) || 1;
    setQuantity(Math.min(50, Math.max(1, num)));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{serviceName}</DialogTitle>
          <DialogDescription>
            Ce service est facturé par {unitName}. Indiquez la quantité souhaitée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sélecteur de quantité */}
          <div className="space-y-2">
            <Label>Combien de {unitName}s avez-vous à réparer ?</Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-20 text-center text-lg font-semibold"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(50, quantity + 1))}
                disabled={quantity >= 50}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Prix unitaire :</span>
              <span className="font-medium">{pricePerUnit}€ / {unitName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Durée par {unitName} :</span>
              <span className="font-medium">{durationPerUnit} min</span>
            </div>
            <div className="border-t border-amber-200 my-2" />
            <div className="flex justify-between font-semibold">
              <span>Prix total :</span>
              <span className="text-amber-600">{totalPrice}€</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Durée estimée :</span>
              <span className="text-amber-600">{formatDuration(totalDuration)}</span>
            </div>
          </div>

          {/* Note importante */}
          <div className="flex items-start gap-2 text-xs text-zinc-500">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Prix sous réserve du nombre exact le jour du RDV. Si le nombre de {unitName}s
              diffère, le prix sera ajusté.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} className="bg-amber-500 hover:bg-amber-600">
            Ajouter au panier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
