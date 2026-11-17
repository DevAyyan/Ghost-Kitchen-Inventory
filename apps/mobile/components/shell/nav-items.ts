import { Cauldron } from '@/components/halloween/lab-icons';
import { CalendarDays, Refrigerator, ScanLine, Settings, Tombstone, Wallet, type LucideIcon } from 'lucide-react-native';

/**
 * Route name (file in app/(tabs)) -> nav presentation. Phones get five tabs (design contract): Settings
 * sits in the top bar and the Graveyard is opened from the Ledger.
 */
export const NAV_ITEMS: { route: string; label: string; icon: LucideIcon; phone: boolean }[] = [
  { route: 'index', label: 'Fridge', icon: Refrigerator, phone: true },
  { route: 'scan', label: 'Scan', icon: ScanLine, phone: true },
  { route: 'recipes', label: 'Recipes', icon: Cauldron, phone: true },
  { route: 'plan', label: 'Plan', icon: CalendarDays, phone: true },
  { route: 'ledger', label: 'Ledger', icon: Wallet, phone: true },
  { route: 'graveyard', label: 'Graveyard', icon: Tombstone, phone: false },
  { route: 'settings', label: 'Settings', icon: Settings, phone: false },
];
