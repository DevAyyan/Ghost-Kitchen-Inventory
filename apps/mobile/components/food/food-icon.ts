import type { Category } from '@/lib/domain/types';
import {
  Apple, Banana, Bean, Beef, Beer, Cake, Carrot, Cherry, Citrus, Coffee, Cookie, Croissant, CupSoda, Droplets, Drumstick,
  Egg, Fish, Grape, Ham, IceCreamCone, Leaf, LeafyGreen, Milk, Nut, Package, Pizza, Salad, Sandwich, Shrimp, Snowflake,
  Soup, Wheat, Wine, type LucideIcon,
} from 'lucide-react-native';

/** Neutral line icons per category, used when nothing more specific matches the name. */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  vegetable: Carrot, fruit: Apple, herbs: Leaf, produce: Salad, dairy: Milk, meat: Beef, fish: Fish, eggs: Egg, leftovers: Soup,
  bakery: Croissant, dry: Wheat, frozen: Snowflake, condiment: Droplets, drink: CupSoda, other: Package,
};

/**
 * Words in a food's name -> a more specific icon, so a shelf of produce isn't a row of identical carrots.
 * First match wins; checked against whole words, so "pineapple" isn't "apple" and "eggplant" isn't "egg".
 */
const BY_WORD: [RegExp, LucideIcon][] = [
  [/\b(apples?|pears?)\b/, Apple],
  [/\bbananas?\b/, Banana],
  [/\b(cherr(y|ies)|strawberr(y|ies)|raspberr(y|ies)|blueberr(y|ies)|berr(y|ies)|plums?)\b/, Cherry],
  [/\bgrapes?\b/, Grape],
  [/\b(lemons?|limes?|oranges?|citrus|grapefruits?|mandarins?|clementines?)\b/, Citrus],
  [/\bavocados?\b/, Apple],
  [/\b(spinach|lettuce|kale|cabbage|chard|rocket|arugula|greens?|bok choy|leeks?|celery|cilantro|coriander|parsley|basil|mint|herbs?)\b/, LeafyGreen],
  [/\b(salad|cucumbers?|tomato(es)?|peppers?|courgettes?|zucchini)\b/, Salad],
  [/\b(carrots?|parsnips?|potato(es)?|onions?|garlic|radish(es)?|beets?|beetroot|mushrooms?)\b/, Carrot],
  [/\b(beans?|lentils?|chickpeas?|peas)\b/, Bean],
  [/\b(nuts?|almonds?|walnuts?|peanuts?|cashews?)\b/, Nut],
  [/\b(chicken|turkey|duck|drumsticks?|wings?)\b/, Drumstick],
  [/\b(ham|bacon|sausages?|salami|pork)\b/, Ham],
  [/\b(beef|steak|mince|lamb)\b/, Beef],
  [/\b(prawns?|shrimps?|crab|lobster)\b/, Shrimp],
  [/\b(fish|salmon|tuna|cod|haddock|mackerel|sardines?)\b/, Fish],
  [/\beggs?\b/, Egg],
  [/\b(milk|cream|yogh?urt|kefir)\b/, Milk],
  [/\b(ice cream|gelato|sorbet)\b/, IceCreamCone],
  [/\b(cheese|cheddar|mozzarella|feta|brie|parmesan)\b/, Pizza],
  [/\b(pizza)\b/, Pizza],
  [/\b(sandwich(es)?|wraps?)\b/, Sandwich],
  [/\b(bread|sourdough|baguette|rolls?|bagels?|croissants?)\b/, Croissant],
  [/\b(cakes?|muffins?|brownies?)\b/, Cake],
  [/\b(cookies?|biscuits?)\b/, Cookie],
  [/\b(rice|pasta|flour|oats|cereal|noodles?|quinoa)\b/, Wheat],
  [/\b(soup|stew|curry|leftovers?|chili)\b/, Soup],
  [/\b(coffee|tea)\b/, Coffee],
  [/\b(wine)\b/, Wine],
  [/\b(beer|cider)\b/, Beer],
  [/\b(juice|soda|cola|water)\b/, CupSoda],
];

/** The most specific icon for a food: by its name when one matches, else by its category. */
export function foodIcon(category: Category, name?: string): LucideIcon {
  if (name) {
    const n = name.toLowerCase();
    for (const [re, icon] of BY_WORD) if (re.test(n)) return icon;
  }
  return CATEGORY_ICON[category];
}
