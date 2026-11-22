import { useSettings } from '@/lib/store/settings-store';
import { largerText } from '@/lib/text-scale';
import { cn } from '@/lib/utils';
import { Platform, TextInput } from 'react-native';

function Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const large = useSettings((s) => s.settings.largeText);
  const scale = large ? largerText : (c: string) => c;
  return (
    <TextInput
      className={scale(cn(
        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 font-pixel flex-row items-center border-2 px-3 py-1 text-base leading-5 sm:h-9',
        props.editable === false &&
        cn(
          'opacity-50',
          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
        ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className
      ))}
      {...props}
    />
  );
}

export { Input };
