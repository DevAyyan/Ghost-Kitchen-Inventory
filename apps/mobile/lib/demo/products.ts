/**
 * Demo-mode product facts and recipe diets. No app imports beyond domain types, so the server's tests can
 * check them: shelf lives are conservative (FoodKeeper style) and pass the server's safety floor unchanged.
 */
import type { Diet } from '../domain/diets';
import type { ProductInfo } from '../domain/product-info';

const p = (info: ProductInfo): ProductInfo => info;
/** Storage facts by product name. Names not listed get no answer, and the app falls back to its rough category estimate. */
export const DEMO_PRODUCTS: ProductInfo[] = [
  p({ name: 'Whole milk', category: 'dairy', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 7, freezer: 90 }, highRisk: true, multiUse: true, tags: ['dairy'], tip: 'Keep it on a shelf at the back, not in the door.' }),
  p({ name: 'Eggs', category: 'eggs', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 21, freezer: null }, highRisk: true, multiUse: true, tags: ['egg'], tip: 'Keep them in the carton on a shelf.' }),
  p({ name: 'Chicken breast', category: 'meat', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 2, freezer: 270 }, highRisk: true, multiUse: false, tags: ['meat'], tip: 'Bottom shelf, sealed, so juices cannot drip onto other food.' }),
  p({ name: 'Baby spinach', category: 'vegetable', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 5, freezer: 240 }, highRisk: false, multiUse: false, tags: [], tip: 'Keep it dry. A paper towel in the bag helps.' }),
  p({ name: 'Strawberries', category: 'fruit', homeZone: 'fridge', shelfLifeDays: { pantry: 1, fridge: 3, freezer: 240 }, highRisk: false, multiUse: false, tags: [], tip: 'Wash them only just before eating.' }),
  p({ name: 'Cheddar', category: 'dairy', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 21, freezer: 180 }, highRisk: true, multiUse: true, tags: ['dairy'], tip: 'Wrap it tightly once opened.' }),
  p({ name: 'Sourdough loaf', category: 'bakery', homeZone: 'pantry', shelfLifeDays: { pantry: 4, fridge: 7, freezer: 90 }, highRisk: false, multiUse: true, tags: ['gluten', 'highCarb'], tip: "Slice and freeze what you won't eat in a few days." }),
  p({ name: 'Bananas', category: 'fruit', homeZone: 'pantry', shelfLifeDays: { pantry: 5, fridge: 7, freezer: 90 }, highRisk: false, multiUse: false, tags: ['highCarb'], tip: 'Keep them away from other fruit; they ripen it faster.' }),
  p({ name: 'Greek yogurt', category: 'dairy', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 10, freezer: 60 }, highRisk: true, multiUse: true, tags: ['dairy'], tip: 'Use a clean spoon each time.' }),
  p({ name: 'Carrots', category: 'vegetable', homeZone: 'fridge', shelfLifeDays: { pantry: 3, fridge: 21, freezer: 300 }, highRisk: false, multiUse: true, tags: [], tip: 'Cut off any leafy tops before storing.' }),
  p({ name: 'Avocado', category: 'fruit', homeZone: 'pantry', shelfLifeDays: { pantry: 4, fridge: 7, freezer: null }, highRisk: false, multiUse: false, tags: [], tip: 'Ripen at room temperature, then move it to the fridge.' }),
  p({ name: 'Hummus', category: 'condiment', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 7, freezer: 120 }, highRisk: false, multiUse: true, tags: [], tip: 'Once opened, finish it within a few days.' }),
];

/**
 * Which diets each recorded recipe fits, checked by hand against its ingredient list. Fails closed like
 * the server: a diet is only listed when every ingredient clearly fits it, so anything doubtful (vanilla
 * extract and halal, pasta and egg, stock cubes and gluten, Parmesan rennet and vegetarian) leaves it out.
 */
export const DEMO_RECIPE_FITS: Record<string, Diet[]> = {
  '53219': ['vegetarian', 'pescatarian', 'halal', 'nut-free', 'shellfish-free', 'low-carb'], // Shakshuka
  '52849': ['nut-free', 'shellfish-free'], // Spinach & Ricotta Cannelloni
  '52846': ['egg-free', 'nut-free', 'shellfish-free'], // Chicken & mushroom Hotpot
  '52791': ['vegetarian', 'pescatarian', 'shellfish-free'], // Eton Mess
  '53082': ['vegetarian', 'pescatarian', 'egg-free', 'gluten-free', 'nut-free', 'shellfish-free'], // Strawberries Romanoff
  '52855': ['vegetarian', 'pescatarian', 'dairy-free', 'shellfish-free'], // Banana Pancakes
  '53473': ['vegetarian', 'vegan', 'pescatarian', 'halal', 'dairy-free', 'egg-free', 'nut-free', 'shellfish-free', 'low-carb'], // Curried Spinach
  '52853': ['vegetarian', 'pescatarian', 'dairy-free', 'egg-free', 'gluten-free', 'nut-free', 'shellfish-free'], // Chocolate Avocado Mousse
  '53107': ['vegetarian', 'pescatarian', 'halal', 'egg-free', 'nut-free', 'shellfish-free'], // Avocado dip
  '52955': ['dairy-free', 'nut-free', 'shellfish-free'], // Egg Drop Soup
  '52775': ['vegetarian', 'vegan', 'pescatarian', 'halal', 'dairy-free', 'egg-free', 'shellfish-free'], // Vegan Lasagna
  '52850': ['dairy-free', 'egg-free', 'nut-free', 'shellfish-free'], // Chicken Couscous
};
