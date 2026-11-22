import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PIXEL_ICONS } from './pixel-icons';

type IconProps = LucideProps & {
  as: LucideIcon;
} & React.RefAttributes<LucideIcon>;

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  // Pixel-art version when there is one, so the whole UI shares the kitchen's look.
  const pixel = PIXEL_ICONS[(IconComponent as { displayName?: string }).displayName ?? ''];
  if (pixel) {
    const flat = StyleSheet.flatten(props.style as StyleProp<ViewStyle & { color?: string }>) ?? {};
    const size = Number(props.size ?? flat.width ?? 14);
    const color = (props.color as string | undefined) ?? flat.color ?? 'currentColor';
    const { color: _c, width: _w, height: _h, ...rest } = flat;
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={rest}
        aria-hidden={props['aria-hidden']}
        accessibilityElementsHidden={props.accessibilityElementsHidden}
        importantForAccessibility={props.importantForAccessibility}
        // Crisp edges on web: the paths sit on whole grid pixels, so no anti-aliased blur at small sizes.
        {...(Platform.OS === 'web' ? { shapeRendering: 'crispEdges' } : {})}>
        <Path d={pixel} fill={color} />
      </Svg>
    );
  }
  return <IconComponent {...props} />;
}

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
    },
  },
});

/**
 * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.
 *
 * This component allows you to render any Lucide icon while applying utility classes
 * using `nativewind`. It avoids the need to wrap or configure each icon individually.
 *
 * @component
 * @example
 * ```tsx
 * import { ArrowRight } from 'lucide-react-native';
 * import { Icon } from '@/registry/components/ui/icon';
 *
 * <Icon as={ArrowRight} className="text-red-500" size={16} />
 * ```
 *
 * @param {LucideIcon} as - The Lucide icon component to render.
 * @param {string} className - Utility classes to style the icon using Nativewind.
 * @param {number} size - Icon size (defaults to 14).
 * @param {...LucideProps} ...props - Additional Lucide icon props passed to the "as" icon.
 */
/** Native-only ways to hide from screen readers. On web, aria-hidden does it and these would reach the <svg>. */
const NATIVE_HIDDEN =
  Platform.OS === 'web' ? {} : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);

function Icon({ as: IconComponent, className, size = 14, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <IconImpl
      as={IconComponent}
      className={cn('text-foreground', textClass, className)}
      size={size}
      // Icons are decorative: every icon sits next to text or inside a control with its own label,
      // so screen readers skip them instead of announcing an unnamed graphic.
      aria-hidden
      {...NATIVE_HIDDEN}
      {...props}
    />
  );
}

export { Icon };
