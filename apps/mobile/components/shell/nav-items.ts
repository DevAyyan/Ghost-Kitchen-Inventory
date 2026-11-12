import { CalendarDays, ChefHat, Refrigerator, ScanLine, Settings, Skull, Wallet, type LucideIcon } from 'lucide-react-native';

/**
 * Route name (file in app/(tabs)) -> nav presentation. Phones get five tabs (design contract): Settings
 * sits in the top bar and the Graveyard is opened from the Ledger.
 */
export const NAV_ITEMS: { route: string; label: string; icon: LucideIcon; phone: boolean }[] = [
  { route: 'index', label: 'Fridge', icon: Refrigerator, phone: true },
  { route: 'scan', label: 'Scan', icon: ScanLine, phone: true },
  { route: 'recipes', label: 'Recipes', icon: ChefHat, phone: true },
  { route: 'plan', label: 'Plan', icon: CalendarDays, phone: true },
  { route: 'ledger', label: 'Ledger', icon: Wallet, phone: true },
  { route: 'graveyard', label: 'Graveyard', icon: Skull, phone: false },
  { route: 'settings', label: 'Settings', icon: Settings, phone: false },
];
