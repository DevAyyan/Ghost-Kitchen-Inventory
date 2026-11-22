import { Screen } from '@/components/common/screen';
import { CurrencyChip } from '@/components/currency/currency-chip';
import { CurrencyPicker } from '@/components/currency/currency-picker';
import { ReviewLine } from '@/components/scan/review-line';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { today } from '@/lib/domain/dates';
import { CURRENCY_CHECK_THRESHOLD, rowNeedsCheck, sectionCounts, blankLine, draftTotals, manualDraft, needsExpiry, validateDraft } from '@/lib/domain/draft';
import { shortDate } from '@/lib/domain/dates';
import { findDuplicates } from '@/lib/domain/dupes';
import { daysLeft } from '@/lib/domain/expiry';
import { ZONES, ZONE_ORDER } from '@/lib/domain/catalog';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { useScan } from '@/lib/store/scan-store';
import { toast } from '@/lib/store/toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, Calculator, Coins, Info, Plus, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { manual } = useLocalSearchParams<{ manual?: string }>();
  const { draft, setDraft, patchDraft, addLine } = useScan();
  const defaultCurrency = useSettings((s) => s.settings.defaultCurrency);
  const commitDraft = useApp((s) => s.commitDraft);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = React.useState(false);
  // The rows to check, fixed when the filter is turned on, so a row doesn't vanish while you edit it.
  const [checkIds, setCheckIds] = React.useState<Set<string> | null>(null);
  const onlyCheck = checkIds !== null;
  const patchLine = useScan((s) => s.patchLine);
  const stocked = useApp((s) => s.items);
  const duplicates = React.useMemo(() => (draft ? findDuplicates(draft.lines, stocked) : new Map()), [draft, stocked]);

  React.useEffect(() => {
    // Scan screen sets the draft before navigating here; manual entry starts a blank one.
    if (manual === '1' || !useScan.getState().draft) setDraft(manualDraft(defaultCurrency, today()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    setDraft(null); // leaving review abandons the draft
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  if (!draft) return <View className="bg-background flex-1" />;

  const totals = draftTotals(draft);
  const unconfirmed = draft.lines.filter((l) => needsExpiry(l) && !l.expiryConfirmed);
  // Old receipts can make items "already expired" on arrival; say so instead of silently stocking spoiled food.
  const pastDate = draft.lines.filter((l) => needsExpiry(l) && daysLeft({ expires: l.expires }) < 0);
  const needsCheck = draft.currencyConfidence < CURRENCY_CHECK_THRESHOLD;
  /** Typed in by hand: there's no receipt, so don't call it one. */
  const byHand = draft.source === 'manual';
  const sourceText =
    draft.currencySource === 'user' ? 'Set by you. Amounts were relabeled, not converted.'
    : draft.currencySource === 'default' ? (draft.source === 'manual' ? 'Your default currency.' : 'No currency found on the receipt, so we used your default.')
    : `Detected from ${draft.evidence.join(', ')}.`;

  const setCurrency = (code: string) => {
    const changed = code !== draft.currency;
    patchDraft({ currency: code, currencyConfidence: 1, currencySource: changed || draft.currencySource === 'default' ? 'user' : draft.currencySource, candidates: undefined });
    toast(changed ? `${byHand ? 'Prices' : 'Receipt'} relabeled as ${code}. Amounts were not converted.` : `${code} confirmed`);
  };

  const confirm = () => {
    const err = validateDraft(draft);
    if (err) return toast(err);
    const added = commitDraft(draft);
    toast(`${added.length} item${added.length === 1 ? '' : 's'} moved into the fridge`);
    setDraft(null);
    router.dismissTo('/');
  };

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <View className="border-border h-14 flex-row items-center gap-2 border-b px-2">
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Cancel and go back" className="active:bg-accent h-11 w-11 items-center justify-center rounded-md">
          <Icon as={ArrowLeft} size={20} />
        </Pressable>
        {/* No title here: the page heading right below already names the screen. */}
      </View>

      <Screen needsServer title={draft.source === 'manual' ? 'Add items' : draft.source === 'photo' ? 'What we saw' : 'Check your haul'} description={`${draft.store} · Nothing is added until you confirm.`}>
        {draft.source === 'rules' && (
          <Alert icon={TriangleAlert} iconClassName="text-warning" className="border-warning/60">
            <AlertTitle>Read with basic rules</AlertTitle>
            <AlertDescription>Names stay as printed and categories are guesses. Check each row before you stock the fridge.</AlertDescription>
          </Alert>
        )}
        {draft.warnings.map((w) => (
          <Alert key={w} icon={Info}>
            <AlertDescription>{w}</AlertDescription>
          </Alert>
        ))}

        <View className="gap-2">
          <Text className="text-muted-foreground text-sm">Currency</Text>
          <CurrencyChip code={draft.currency} needsCheck={needsCheck} onPress={() => setPickerOpen(true)} prefix={byHand ? 'Prices in' : 'Receipt currency'} />
          <Text className="text-muted-foreground text-xs">{sourceText}</Text>
        </View>
        {needsCheck && (
          <Alert icon={Coins} iconClassName="text-warning" className="border-warning/60">
            <AlertTitle>Please confirm the currency</AlertTitle>
            <AlertDescription>
              {draft.candidates ? `This receipt only shows a shared symbol, used by ${draft.candidates.join(', ')}. ` : ''}Tap the currency to confirm or change it.
            </AlertDescription>
          </Alert>
        )}
        {totals.mismatch && totals.subtotalMinor !== null && (
          <Alert icon={Calculator} iconClassName="text-warning" className="border-warning/60">
            <AlertTitle>Lines don't add up</AlertTitle>
            <AlertDescription>
              Lines total {formatMoney(totals.allMinor, draft.currency)} but the receipt subtotal is {formatMoney(totals.subtotalMinor, draft.currency)}. A line may be missing.
            </AlertDescription>
          </Alert>
        )}

        <Alert icon={CalendarClock}>
          <AlertTitle>
            {totals.itemCount === 0 ? 'Expiry dates' : `${totals.expiryConfirmed} of ${totals.itemCount} expiry dates checked (optional)`}
          </AlertTitle>
          <AlertDescription>
            Dates are estimates until you check them against the package. You can stock the fridge now; unchecked dates stay marked "est.".
          </AlertDescription>
          {unconfirmed.length > 1 && (
            <Button variant="outline" className="mb-2 ml-6 mt-2 h-11 self-start" onPress={() => setConfirmAllOpen(true)}>
              <Text>Confirm all {unconfirmed.length} remaining dates</Text>
            </Button>
          )}
        </Alert>

        {pastDate.length > 0 && (
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>{pastDate.length} item{pastDate.length === 1 ? ' is' : 's are'} already past {pastDate.length === 1 ? 'its' : 'their'} estimated date</AlertTitle>
            <AlertDescription>
              {pastDate.map((l) => l.name).join(', ')}. The receipt is dated {shortDate(draft.date)}. If the date on the package is later, adjust it below; otherwise these will go straight to the graveyard.
            </AlertDescription>
          </Alert>
        )}

        {draft.lines.length > 3 && (() => {
          const counts = sectionCounts(draft.lines);
          const toCheck = draft.lines.filter((l) => rowNeedsCheck(l, { duplicate: duplicates.has(l.id), now: today() })).length;
          return (
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-muted-foreground flex-1 text-sm">
                {ZONE_ORDER.filter((z) => counts[z] > 0).map((z) => `${ZONES[z].label} ${counts[z]}`).join(' · ') || 'Nothing to stock yet'}
              </Text>
              {(toCheck > 0 || onlyCheck) && (
                <Button variant={onlyCheck ? 'default' : 'outline'} className="h-11" onPress={() => setCheckIds(onlyCheck ? null : new Set(draft.lines.filter((l) => rowNeedsCheck(l, { duplicate: duplicates.has(l.id), now: today() })).map((l) => l.id)))} accessibilityState={{ selected: onlyCheck }}>
                  <Text>{onlyCheck ? 'Show all rows' : `Only the ${toCheck} to check`}</Text>
                </Button>
              )}
            </View>
          );
        })()}
        <View role="list" aria-label="Receipt items" className="border-border overflow-hidden rounded-lg border">
          {draft.lines.filter((l) => !checkIds || checkIds.has(l.id)).map((l) => <ReviewLine key={l.id} line={l} currency={draft.currency} purchased={draft.date} duplicate={duplicates.get(l.id)} />)}
        </View>
        <Button variant="outline" className="h-11 self-start" onPress={() => addLine(blankLine(draft.date))}>
          <Icon as={Plus} size={16} />
          <Text>Add row</Text>
        </Button>
      </Screen>

      {/* Phones: total on its own line, then Cancel and a wide Confirm. Wider: all on one row. */}
      <View className="border-border bg-card flex-row flex-wrap items-center gap-2 border-t px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="w-full md:w-auto md:flex-1">
          <Text className="text-muted-foreground text-xs">Total</Text>
          <Text className="text-lg font-bold tabular-nums">
            {draft.source === 'photo' ? `${totals.itemCount} items` : `${formatMoney(totals.totalMinor, draft.currency)} · ${totals.itemCount} items`}
          </Text>
        </View>
        <Button variant="outline" className="h-11" onPress={leave}><Text>Cancel</Text></Button>
        <Button className="h-11 flex-1 md:flex-none" onPress={confirm}>
          <Text>Confirm & stock fridge</Text>
        </Button>
      </View>

      <ConfirmDialog
        open={confirmAllOpen}
        onOpenChange={setConfirmAllOpen}
        title={`Are these ${unconfirmed.length} dates right?`}
        description="Only confirm if they match the packages. Otherwise go back and adjust them."
        confirmLabel="Yes, all correct"
        cancelLabel="Go back and check"
        onConfirm={() => {
          unconfirmed.forEach((l) => patchLine(l.id, { expiryConfirmed: true }));
          toast(`${unconfirmed.length} expiry dates confirmed`);
        }}>
        <View className="gap-1">
          {unconfirmed.map((l) => (
            <View key={l.id} className="flex-row justify-between gap-3">
              <Text className="text-sm">{l.name}</Text>
              <Text className="text-sm tabular-nums">{shortDate(l.expires)}</Text>
            </View>
          ))}
        </View>
      </ConfirmDialog>

      <CurrencyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={byHand ? 'Prices in' : 'Receipt currency'}
        note={byHand ? 'The currency you paid in. Amounts are relabeled, not converted.' : 'Fixes a wrong guess. Amounts are relabeled, not converted.'}
        value={draft.currency}
        likely={draft.candidates}
        onSelect={setCurrency}
      />
    </View>
  );
}
