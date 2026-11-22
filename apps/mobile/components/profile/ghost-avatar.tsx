import { GHOSTS } from '@/components/fridge/ghost-sprites';
import { pixelated } from '@/components/fridge/pixel-effects';
import { AVATAR_HEX, type Avatar } from '@/lib/domain/profile';
import { Image, View } from 'react-native';

/** A person's pixel ghost on their colour. Decorative: their name is always shown or spoken next to it. */
export function GhostAvatar({ avatar, size = 40 }: { avatar: Avatar; size?: number }) {
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center border-2 border-black/50"
      style={{ width: size, height: size, backgroundColor: AVATAR_HEX[avatar.colour] ?? AVATAR_HEX.mint }}>
      <Image
        source={GHOSTS[Math.abs(avatar.ghost) % GHOSTS.length]}
        fadeDuration={0}
        style={[{ width: size * 0.8, height: size * 0.8, resizeMode: 'stretch' }, pixelated]}
      />
    </View>
  );
}
