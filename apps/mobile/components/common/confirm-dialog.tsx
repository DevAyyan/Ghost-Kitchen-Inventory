import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Text } from '@/components/ui/text';
import { buttonVariants } from '@/components/ui/button';
import * as React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  /** Optional secondary choice rendered next to cancel, e.g. "Use Tesseract only". */
  onCancel?: () => void;
}

/** Controlled shadcn-style AlertDialog for confirmations that change data. */
export function ConfirmDialog({
  open, onOpenChange, title, description, children, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel onPress={onCancel}>
            <Text>{cancelLabel}</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={onConfirm} className={destructive ? buttonVariants({ variant: 'destructive' }) : undefined}>
            <Text className={destructive ? 'text-white' : undefined}>{confirmLabel}</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
