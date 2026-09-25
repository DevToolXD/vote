import type * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'xlarge' | 'large' | 'medium' | 'small';
  variant?: 'fill' | 'weak';
  color?: 'primary' | 'danger' | 'dark' | 'light';
  display?: 'inline' | 'block' | 'full';
  loading?: boolean;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface BottomCTAProps { children: React.ReactNode; fixed?: boolean; className?: string }
export declare function BottomCTA(props: BottomCTAProps): React.ReactElement;

export interface TopProps {
  title: React.ReactNode; subtitle?: React.ReactNode; subtitleTop?: React.ReactNode;
  upper?: React.ReactNode; lower?: React.ReactNode; right?: React.ReactNode;
  size?: 'medium' | 'large'; as?: 'h1' | 'h2' | 'h3'; className?: string;
}
export declare function Top(props: TopProps): React.ReactElement;

export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  left?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; right?: React.ReactNode;
  arrow?: boolean; divider?: boolean; onClick?: React.MouseEventHandler<HTMLElement>;
}
export declare function ListRow(props: ListRowProps): React.ReactElement;
/** Initial in a 40px grey100 circle, for ListRow `left`. */
export declare function Avatar(props: { children: React.ReactNode }): React.ReactElement;

export interface BorderProps { variant?: 'full' | 'padding24' | 'height16'; className?: string }
export declare function Border(props: BorderProps): React.ReactElement;

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'box' | 'line' | 'big' | 'hero';
  label?: React.ReactNode; help?: React.ReactNode; hasError?: boolean; suffix?: React.ReactNode; focused?: boolean;
}
export declare function TextField(props: TextFieldProps): React.ReactElement;

export interface SwitchProps { checked?: boolean; defaultChecked?: boolean; onChange?: (next: boolean) => void; disabled?: boolean; 'aria-label': string; className?: string }
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface BadgeProps {
  color?: 'blue' | 'teal' | 'green' | 'red' | 'yellow' | 'elephant';
  variant?: 'weak' | 'fill'; size?: 'xsmall' | 'small' | 'medium' | 'large'; children: React.ReactNode; className?: string;
}
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface ToastProps { open: boolean; text: React.ReactNode; icon?: React.ReactNode; onClose?: () => void; duration?: number; multiline?: boolean; inline?: boolean; className?: string }
export declare function Toast(props: ToastProps): React.ReactElement | null;

export interface ConfirmDialogProps {
  open: boolean; title: React.ReactNode; description?: React.ReactNode;
  onConfirm?: () => void; onClose?: () => void; confirmLabel?: string; closeLabel?: string; danger?: boolean;
}
export declare function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement | null;

export interface BottomSheetProps { open: boolean; onClose?: () => void; title?: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; cta?: React.ReactNode }
export declare function BottomSheet(props: BottomSheetProps): React.ReactElement | null;

declare global {
  interface Window {
    TossStyle: {
      Button: typeof Button; BottomCTA: typeof BottomCTA; Top: typeof Top; ListRow: typeof ListRow; Avatar: typeof Avatar;
      Border: typeof Border; TextField: typeof TextField; Switch: typeof Switch; Badge: typeof Badge; Toast: typeof Toast;
      ConfirmDialog: typeof ConfirmDialog; BottomSheet: typeof BottomSheet;
    };
  }
}
