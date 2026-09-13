import {
  Armchair,
  BookOpen,
  Camera,
  Disc3,
  Flower2,
  Gamepad2,
  Glasses,
  Headphones,
  LampDesk,
  Radio,
  Shirt,
  ShoppingBag,
  Smartphone,
  Tag,
  Watch,
} from "lucide-react";

const objects = [
  Disc3,
  LampDesk,
  Camera,
  BookOpen,
  Flower2,
  Shirt,
  Headphones,
  Gamepad2,
  Radio,
  ShoppingBag,
  Armchair,
  Glasses,
  Smartphone,
  Watch,
  Tag,
];

/** Rein dekorative, lokale Linienillustration hinter dem Market-Inhalt. */
export function MarketSketchBackground() {
  return (
    <div className="market-sketch-bg" aria-hidden="true">
      <div className="market-sketch-grid">
        {objects.map((Icon, index) => (
          <div className="market-sketch-object" key={index}>
            <Icon strokeWidth={1.25} />
          </div>
        ))}
      </div>
    </div>
  );
}
