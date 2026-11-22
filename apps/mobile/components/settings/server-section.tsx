import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { apiBase } from '@/lib/api';
import { useServer } from '@/lib/store/server-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { Section, StatusLine } from './parts';

export function ServerSection() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const { status, reachable, lastError, check } = useServer();
  const [url, setUrl] = React.useState(s.apiUrl);
  const [token, setToken] = React.useState(s.apiToken);
  const accounts = useServer((st) => st.auth?.provider === 'clerk');
  const [testing, setTesting] = React.useState(false);
  // Typed but not saved: shown so an edit isn't silently lost when leaving the screen.
  const dirty = url.trim().replace(/\/+$/, '') !== s.apiUrl || token.trim() !== s.apiToken;

  const save = async () => {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean && !/^https?:\/\/[^\s/]+/i.test(clean)) { toast('Enter a full address, like https://kitchen.example.com'); return; }
    update({ apiUrl: clean, apiToken: token.trim() });
    setTesting(true);
    const st = await check();
    setTesting(false);
    toast(st ? 'Connected to your server' : "Couldn't connect. Check the address.");
  };

  return (
    <Section title="Server">
      {s.demoMode && <View className="mb-3"><StatusLine state="warn" text="Demo mode is on, so this server isn't used until you turn it off." /></View>}
      <Text className="text-muted-foreground mb-3 text-sm">
        Receipt reading, shelf-life lookups, recipes and exchange rates run on your Ghost Kitchen server. Your fridge itself works offline.
      </Text>
      <View className="gap-1.5">
        <Label nativeID="api-url">Server address</Label>
        <Input
          aria-labelledby="api-url"
          value={url}
          onChangeText={setUrl}
          placeholder={apiBase() || 'https://kitchen.example.com'}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="h-11"
        />
      </View>
      {/* With accounts on, your sign-in protects the server and the shared token isn't used. */}
      {!accounts && (
        <View className="mt-3 gap-1.5">
          <Label nativeID="api-token">Access token (if your server has one)</Label>
          <Input aria-labelledby="api-token" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} className="h-11" />
        </View>
      )}
      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        <Button className="h-11" onPress={() => void save()} disabled={testing}>
          <Text>{testing ? 'Checking…' : 'Save and test connection'}</Text>
        </Button>
        {dirty && !testing && (
          <View className="flex-row items-center gap-1.5" aria-live="polite">
            <Icon as={TriangleAlert} size={14} className="text-warning" />
            <Text className="text-muted-foreground text-sm">Not saved yet</Text>
          </View>
        )}
      </View>

      {(reachable !== null || testing) && (
        <View className="border-border mt-3 gap-1.5 rounded-md border p-3" aria-live="polite">
          {testing ? (
            <StatusLine state="pending" text="Checking the server…" />
          ) : reachable && status ? (
            <>
              <StatusLine state="ok" text={`Connected to ${apiBase()}`} />
              <StatusLine state={status.db ? 'ok' : 'bad'} text={status.db ? 'Database working' : 'Database unavailable'} />
              <StatusLine state={status.ocr ? 'ok' : 'bad'} text={status.ocr ? 'Receipt text recognition working' : 'Receipt text recognition unavailable'} />
              <StatusLine
                state={status.ai.enabled ? 'ok' : 'warn'}
                text={status.ai.enabled ? `AI: ${status.ai.model}, ${status.ai.usedToday} of ${status.ai.limitPerDay} requests used today` : 'AI not configured on the server: basic receipt reading only'}
              />
              {status.recipes.keyType === 'test' && (
                <StatusLine state="warn" text="Recipes use TheMealDB's free test key: fine for personal use, not for an app-store release." />
              )}
            </>
          ) : (
            <StatusLine state="bad" text={lastError ?? "Can't reach the server."} />
          )}
        </View>
      )}
    </Section>
  );
}
